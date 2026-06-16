import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import API from "../api/client";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

console.log(import.meta.env);

/* ── Auth Panel ──────────────────────────────────────────── */
function AuthPanel({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await supabase.auth.signInWithPassword(form);
      } else {
        result = await supabase.auth.signUp(form);
      }

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        toast.success("Check your email to confirm your account!");
        setMode("login");
        return;
      }

      onLogin(result.data.user);
      toast.success("Welcome to CredVault!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "calc(100vh - 70px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div className="card" style={{ padding: "2.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎓</div>
            <h2>Student Portal</h2>
            <p style={{ marginTop: "0.5rem" }}>View certificates issued to your wallet</p>
          </div>

          {/* Mode toggle */}
          <div className="tabs" style={{ marginBottom: "1.5rem" }}>
            <button className={`tab${mode === "login" ? " active" : ""}`} onClick={() => setMode("login")}>Sign In</button>
            <button className={`tab${mode === "signup" ? " active" : ""}`} onClick={() => setMode("signup")}>Sign Up</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="input-group">
              <label>Email</label>
              <input className="input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input className="input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? <><span className="spinner" /> Loading…</> : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Credential Card ─────────────────────────────────────── */
function CredCard({ cred }) {
  const [copied, setCopied] = useState(false);

  function copyHash() {
    navigator.clipboard.writeText(cred.credential_hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {cred.institution}
          </p>
          <h3 style={{ color: "#f1f5f9", marginTop: "0.2rem" }}>{cred.degree}</h3>
          <p style={{ fontSize: "0.875rem" }}>{cred.branch}</p>
        </div>
        <span className={`badge badge-${cred.status === "ACTIVE" ? "active" : "revoked"}`}>
          {cred.status === "ACTIVE" ? "✓ Valid" : "✕ Revoked"}
        </span>
      </div>

      <hr className="divider" style={{ margin: "0" }} />

      {/* Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {[
          { label: "Student",      value: cred.student_name },
          { label: "Register No.", value: cred.register_number },
          { label: "Issue Date",   value: cred.issue_date },
          { label: "Tx Hash",      value: cred.tx_hash?.slice(0, 14) + "…", mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label}>
            <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>
              {label}
            </p>
            <p style={{ fontSize: "0.875rem", color: "#f1f5f9", fontFamily: mono ? "monospace" : undefined }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button className="btn btn-outline btn-sm" onClick={copyHash}>
          {copied ? "✓ Copied!" : "📋 Copy Hash"}
        </button>
        <a
          href={`${import.meta.env.VITE_API_URL}/api/credentials/verify`}
          className="btn btn-sm"
          style={{ background: "rgba(45,212,191,0.1)", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.25)", textDecoration: "none" }}
          target="_blank" rel="noreferrer"
        >
          🔗 Share Verify Link
        </a>
      </div>
    </div>
  );
}

/* ── Student Dashboard ───────────────────────────────────── */
function Dashboard({ user, onLogout }) {
  const [wallet, setWallet] = useState("");
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(e) {
    e.preventDefault();
    const normalised = wallet.trim().toLowerCase();
    if (!normalised) { toast.error("Enter your wallet address"); return; }
    setLoading(true);
    try {
      const { data } = await API.get(`/api/credentials/mine?student_wallet=${normalised}`);
      setCreds(data.credentials);
      setSearched(true);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem" }}>
          <div>
            <h2>🎓 My Certificates</h2>
            <p style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>{user.email}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onLogout}>Logout</button>
        </div>

        {/* Wallet search */}
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#f1f5f9", marginBottom: "1rem" }}>Enter Your Wallet Address</h3>
          <p style={{ marginBottom: "1.25rem", fontSize: "0.9rem" }}>
            Your certificates are linked to your wallet address on-chain. Enter it to view them.
          </p>
          <form onSubmit={search} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 240 }}
              placeholder="0x..."
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Loading…</> : "View Certificates"}
            </button>
          </form>
        </div>

        {/* Results */}
        {searched && (
          creds.length === 0
            ? <div style={{ textAlign: "center", padding: "4rem", color: "#475569" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📭</div>
                <p>No certificates found for this wallet address.</p>
              </div>
            : <div className="grid-2">
                {creds.map((c) => <CredCard key={c.id} cred={c} />)}
              </div>
        )}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────── */
export default function StudentPortal() {
  const [user, setUser] = useState(null);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    toast("Logged out");
  }

  if (!user) return <AuthPanel onLogin={setUser} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}
