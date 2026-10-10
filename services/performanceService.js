import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { ethers } from "ethers";
import supabase from "./supabaseService.js";
import { bloomFilter, getBloomStatus } from "../utils/bloomFilter.js";

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const reader = new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    ["function credentialExists(bytes32 credentialHash) view returns (bool)"],
    provider,
);

function summarize(times) {
    const ordered = [...times].sort((a, b) => a - b);
    return {
        samples: times.length,
        meanMs: Number((times.reduce((sum, value) => sum + value, 0) / times.length).toFixed(3)),
        medianMs: Number(ordered[Math.floor((ordered.length - 1) * 0.5)].toFixed(3)),
        p95Ms: Number(ordered[Math.ceil(ordered.length * 0.95) - 1].toFixed(3)),
    };
}

async function measure(items, operation) {
    const times = [];
    const values = [];
    for (const item of items) {
        const start = performance.now();
        values.push(await operation(item));
        times.push(performance.now() - start);
    }
    return { ...summarize(times), times, values };
}

export async function getPerformanceRuns() {
    const [{ data, error }, bloom] = await Promise.all([
        supabase.from("performance_runs").select("id,run_type,sample_count,metrics,created_at")
            .order("created_at", { ascending: false }).limit(20),
        Promise.resolve(getBloomStatus()),
    ]);
    if (error) throw error;
    return { runs: data || [], bloom };
}

export async function runSearchBenchmark() {
    const bloom = getBloomStatus();
    if (!bloom.ready) throw new Error(`Bloom filter is not ready${bloom.error ? `: ${bloom.error}` : ""}`);

    const { data, error } = await supabase.from("credentials").select("document_hash")
        .not("document_hash", "is", null).limit(500);
    if (error) throw error;
    const existing = [...new Set((data || []).map(row => row.document_hash).filter(Boolean))];
    if (!existing.length) throw new Error("No stored certificate hashes are available for the search benchmark");

    const sampleCount = Math.min(10, existing.length);
    const present = existing.slice(0, sampleCount);
    const absent = Array.from({ length: sampleCount }, () => `0x${randomBytes(32).toString("hex")}`);

    async function runCase(hashes) {
        const bloomCheck = await measure(hashes, hash => bloomFilter.mightContain(hash));
        const chainLookup = await measure(hashes, hash => reader.credentialExists(hash));
        const bloomThenChain = await measure(hashes, async hash => {
            if (!bloomFilter.mightContain(hash)) return false;
            return reader.credentialExists(hash);
        });
        const supabaseLookup = await measure(hashes, async hash => {
            const result = await supabase.from("credentials").select("id")
                .eq("document_hash", hash).maybeSingle();
            if (result.error) throw result.error;
            return Boolean(result.data);
        });
        return {
            bloomOnly: summarize(bloomCheck.times),
            directBlockchain: summarize(chainLookup.times),
            bloomThenBlockchain: summarize(bloomThenChain.times),
            directDatabase: summarize(supabaseLookup.times),
            bloomMaybeCount: bloomCheck.values.filter(Boolean).length,
            blockchainFoundCount: chainLookup.values.filter(Boolean).length,
            databaseFoundCount: supabaseLookup.values.filter(Boolean).length,
        };
    }

    const metrics = {
        methodology: "Sequential per-hash timings; stored certificate hashes are present samples; random 32-byte hashes are absent samples. Bloom-gated lookup calls the blockchain only when the filter says maybe.",
        bloom: getBloomStatus(),
        present: await runCase(present),
        absent: await runCase(absent),
        absentBloomFalsePositives: null,
    };
    metrics.absentBloomFalsePositives = metrics.absent.bloomMaybeCount;

    const { data: saved, error: saveError } = await supabase.from("performance_runs").insert({
        run_type: "search",
        sample_count: sampleCount,
        metrics,
    }).select("id,run_type,sample_count,metrics,created_at").single();
    if (saveError) throw saveError;
    return saved;
}

