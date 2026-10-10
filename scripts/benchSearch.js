import "dotenv/config";
import { performance } from "node:perf_hooks";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const abi = JSON.parse(fs.readFileSync(new URL("../config/abi.v2.json", import.meta.url)));
import { bloomFilter } from "../utils/bloomFilter.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, provider);
const { data, error } = await supabase.from("credentials").select("document_hash").not("document_hash", "is", null).limit(1000);
if (error) throw error;
const hashes = (data || []).map(r => r.document_hash);
if (!hashes.length) throw new Error("No credential hashes found for benchmarking");
hashes.forEach(h => bloomFilter.add(h));
const sample = Array.from({ length: 1000 }, (_, i) => hashes[i % hashes.length]);

async function measure(name, operation) {
  const times = [];
  for (const hash of sample) { const start = performance.now(); await operation(hash); times.push(performance.now() - start); }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`${name}: n=${times.length} meanMs=${mean.toFixed(3)} p95Ms=${times[Math.ceil(times.length * .95) - 1].toFixed(3)}`);
}

await measure("Bloom filter in memory", h => bloomFilter.mightContain(h));
await measure("credentialExists on chain", h => contract.credentialExists(h));
await measure("Supabase document_hash lookup", async h => {
  const result = await supabase.from("credentials").select("id").eq("document_hash", h).maybeSingle();
  if (result.error) throw result.error;
});
