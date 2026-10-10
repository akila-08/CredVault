import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import API from "../api/client";

const colors = { "Bloom only": "#38bdf8", "Bloom + chain": "#a78bfa", "Direct chain": "#fbbf24", "Direct database": "#34d399" };

function formatMs(value) {
  return `${Number(value || 0).toFixed(2)} ms`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function MetricCard({ title, value, hint, color = "#cbd5e1" }) {
  return <div className="card" style={{ minHeight: 120 }}>
    <p style={{ color: "#94a3b8", fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".08em" }}>{title}</p>
    <p style={{ color, fontSize: "1.55rem", fontWeight: 700, margin: ".55rem 0 .25rem" }}>{value}</p>
    <p style={{ color: "#64748b", fontSize: ".78rem" }}>{hint}</p>
  </div>;
}

function SearchChart({ title, data }) {
  if (!data) return null;
  const values = [data.bloomOnly.meanMs, data.bloomThenBlockchain.meanMs, data.directBlockchain.meanMs, data.directDatabase.meanMs];
  const max = Math.max(...values, 0.01);
  const entries = [
    ["Bloom only", data.bloomOnly],
    ["Bloom + chain", data.bloomThenBlockchain],
    ["Direct chain", data.directBlockchain],
    ["Direct database", data.directDatabase],
  ];
  return <div className="card">
    <h4 style={{ color: "#f1f5f9", marginBottom: ".25rem" }}>{title}</h4>
    <p style={{ color: "#64748b", fontSize: ".8rem", marginBottom: "1rem" }}>Mean lookup time; p95 shown at right</p>
    {entries.map(([name, metric]) => <div key={name} style={{ margin: ".9rem 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#cbd5e1", fontSize: ".82rem", marginBottom: ".35rem" }}>
        <span>{name}</span><span>{formatMs(metric.meanMs)} <span style={{ color: "#64748b" }}>p95 {formatMs(metric.p95Ms)}</span></span>
      </div>
      <div style={{ height: 9, background: "#0f172a", borderRadius: 9, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(1, metric.meanMs / max * 100)}%`, height: "100%", background: colors[name], borderRadius: 9 }} />
      </div>
    </div>)}
  </div>;
}

export default function PerformanceDashboard({ adminKey }) {
  const [runs, setRuns] = useState([]);
  const [bloom, setBloom] = useState(null);
  const [certificateCount, setCertificateCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [benchmarking, setBenchmarking] = useState(false);
  const headers = useMemo(() => ({ "x-admin-key": adminKey }), [adminKey]);

  const load = useCallback(async () => {
    const [performanceResult, bloomResult] = await Promise.all([
      API.get("/api/admin/performance", { headers }),
      API.get("/api/admin/performance/bloom", { headers }),
    ]);
    setRuns(performanceResult.data.runs || []);
    setBloom(bloomResult.data.bloom);
    setCertificateCount(bloomResult.data.certificateCount || 0);
  }, [headers]);

  useEffect(() => {
    load().catch((error) => toast.error(error.response?.data?.message || error.message))
      .finally(() => setLoading(false));
  }, [load]);

  const gasRuns = runs.filter((run) => run.run_type === "gas");
  const searchRuns = runs.filter((run) => run.run_type === "search");
  const latestGas = gasRuns[0];
  const latestSearch = searchRuns[0];
  const transactions = latestGas?.metrics?.transactions || [];
  const maxGas = Math.max(1, ...transactions.map((item) => Number(item.gasUsed || 0)));

  async function runBenchmark() {
    setBenchmarking(true);
    try {
      await API.post("/api/admin/performance/search-benchmark", {}, { headers });
      await load();
      toast.success("Search benchmark complete and saved");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setBenchmarking(false);
    }
  }

  if (loading) return <div className="card">Loading performance data…</div>;

  const stats = bloom?.stats || {};
  return <div style={{ display: "grid", gap: "1rem" }}>
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
      <div>
        <h3 style={{ color: "#f1f5f9" }}>Performance Dashboard</h3>
        <p style={{ color: "#94a3b8", marginTop: ".35rem" }}>Gas costs and certificate search timings for the configured Amoy deployment.</p>
      </div>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <button className="btn btn-outline" onClick={() => load().catch((error) => toast.error(error.response?.data?.message || error.message))}>Refresh</button>
        <button className="btn btn-primary" disabled={benchmarking || !bloom?.ready} onClick={runBenchmark}>
          {benchmarking ? "Benchmark running…" : "Run search benchmark"}
        </button>
      </div>
    </div>

    <div className="grid-2">
      <MetricCard title="Bloom filter" value={bloom?.ready ? "Ready" : "Unavailable"} hint={bloom?.ready ? "Used by certificate verification" : bloom?.error || "Waiting for initialization"} color={bloom?.ready ? "#34d399" : "#f87171"} />
      <MetricCard title="Certificates indexed" value={Number(stats.itemCount || 0).toLocaleString()} hint={`${Number(certificateCount || 0).toLocaleString()} rows in the credentials table`} color="#7dd3fc" />
      <MetricCard title="Bloom memory" value={`${(Number(stats.memoryBytes || 0) / 1024).toFixed(1)} KB`} hint={`${Number(stats.hashCount || 0)} hash positions per item · ${Number(stats.bitSize || 0).toLocaleString()} bits`} />
      <MetricCard title="Estimated false-positive rate" value={`${(Number(stats.estimatedFalsePositiveRate || 0) * 100).toFixed(3)}%`} hint={`Configured target: ${(Number(stats.targetFalsePositiveRate || 0) * 100).toFixed(2)}% · ${(Number(stats.bitOccupancy || 0) * 100).toFixed(1)}% bits occupied`} color="#c4b5fd" />
    </div>

    {!bloom?.ready && <div className="alert alert-warning">The Bloom filter is unavailable, so search benchmarking is disabled. Check the backend startup log and Supabase connection.</div>}

    <div className="card">
      <h3 style={{ color: "#f1f5f9", marginBottom: ".5rem" }}>Gas cost measurements</h3>
      <p style={{ color: "#64748b", fontSize: ".82rem", marginBottom: "1rem" }}>
        Latest saved run: {formatDate(latestGas?.created_at)} · Values are actual receipt gas × gas price; POL only, no USD conversion.
      </p>
      {!transactions.length ? <p style={{ color: "#94a3b8" }}>No gas run saved yet. Configure the MEASURE_* test-wallet variables in the root .env and run <code>npm run measure:gas</code>.</p> :
        <div className="table-wrapper"><table><thead><tr><th>Operation</th><th>Gas used</th><th>Relative</th><th>Cost</th><th>Receipt</th></tr></thead><tbody>
          {transactions.map((item) => <tr key={item.txHash}>
            <td>{item.operation}</td><td>{Number(item.gasUsed).toLocaleString()}</td>
            <td style={{ minWidth: 120 }}><div style={{ height: 8, background: "#0f172a", borderRadius: 8 }}><div style={{ width: `${Number(item.gasUsed) / maxGas * 100}%`, height: "100%", background: "#a78bfa", borderRadius: 8 }} /></div></td>
            <td>{Number(item.costPOL).toFixed(8)} POL</td>
            <td><a href={`https://amoy.polygonscan.com/tx/${item.txHash}`} target="_blank" rel="noreferrer">View receipt</a></td>
          </tr>)}
        </tbody></table></div>}
      {latestGas?.metrics?.totalCostPOL && <p style={{ color: "#cbd5e1", marginTop: "1rem" }}>Total for this run: <strong>{Number(latestGas.metrics.totalCostPOL).toFixed(8)} POL</strong></p>}
    </div>

    <div className="card" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
      <div><h3 style={{ color: "#f1f5f9" }}>Certificate search benchmark</h3><p style={{ color: "#64748b", fontSize: ".82rem", marginTop: ".35rem" }}>Latest run: {formatDate(latestSearch?.created_at)} · sequential lookup timings · up to 10 present and 10 absent hashes</p></div>
      <span style={{ color: "#94a3b8", fontSize: ".82rem" }}>{searchRuns.length} saved runs</span>
    </div>
    {!latestSearch ? <div className="card" style={{ color: "#94a3b8" }}>Run the benchmark to compare Bloom checks, on-chain lookups, and database lookups.</div> : <>
      <div className="grid-2">
        <SearchChart title={`Certificate exists (${latestSearch.metrics.present.blockchainFoundCount}/${latestSearch.sample_count} confirmed on-chain)`} data={latestSearch.metrics.present} />
        <SearchChart title={`Certificate absent (${latestSearch.sample_count} synthetic hashes)`} data={latestSearch.metrics.absent} />
      </div>
      <div className="card" style={{ color: "#94a3b8", fontSize: ".85rem" }}>
        Bloom false positives in absent samples: <strong style={{ color: "#f1f5f9" }}>{latestSearch.metrics.absentBloomFalsePositives}/{latestSearch.sample_count}</strong>.
        A Bloom “maybe” still checks the contract; only a definite “no” skips it. Timings are local backend measurements and vary with RPC and database latency.
      </div>
    </>}

    <div className="card">
      <h4 style={{ color: "#f1f5f9", marginBottom: ".75rem" }}>Saved benchmark history</h4>
      {!runs.length ? <p style={{ color: "#64748b" }}>No benchmark runs stored yet.</p> : <div className="table-wrapper"><table><thead><tr><th>Type</th><th>Samples</th><th>Saved</th></tr></thead><tbody>
        {runs.map((run) => <tr key={run.id}><td>{run.run_type === "gas" ? "Gas cost" : "Search time"}</td><td>{run.sample_count}</td><td>{formatDate(run.created_at)}</td></tr>)}
      </tbody></table></div>}
    </div>
  </div>;
}
