import { getPerformanceRuns, runSearchBenchmark } from "../services/performanceService.js";
import { getBloomStatus } from "../utils/bloomFilter.js";
import supabase from "../services/supabaseService.js";

export async function getDashboard(req, res) {
    try {
        const { runs, bloom } = await getPerformanceRuns();
        res.json({ success: true, runs, bloom });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function benchmarkSearch(req, res) {
    try {
        const run = await runSearchBenchmark();
        res.json({ success: true, run });
    } catch (err) {
        const status = err.message.startsWith("Bloom filter is not ready") ? 503 : 500;
        res.status(status).json({ success: false, message: err.message });
    }
}

export async function getBloomDashboard(req, res) {
    try {
        const bloom = getBloomStatus();
        const { count, error } = await supabase.from("credentials").select("id", { count: "exact", head: true });
        if (error) throw error;
        res.json({ success: true, bloom, certificateCount: count || 0 });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
