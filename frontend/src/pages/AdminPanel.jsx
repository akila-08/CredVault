import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import API from "../api/client";

export default function AdminPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [universities, setUniversities] = useState([]);
  const [form, setForm] = useState({ name: "", wallet_address: "", contact_email: "" });
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Test the key by calling a protected endpoint
      await API.get("/api/universities", { headers: { "x-admin-key": adminKey } });
      localStorage.setItem("cv_admin_key", adminKey);
      setAuthenticated(true);
      toast.success("Admin access granted");
    } catch {
      toast.error("Invalid admin key");
    } finally {
      setLoading(false);
    }
  }

  async function loadUniversities() {
    try {
      const { data } = await API.get("/api/universities");
      setUniversities(data.universities);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  }

  useEffect(() => {
    if (authenticated) loadUniversities();
  }, [authenticated]);

  // Restore saved key on mount
  useEffect(() => {
    const saved = localStorage.getItem("cv_admin_key");
    if (saved) { setAdminKey(saved); }
  }, []);

  function handleChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    try {
      await API.post("/api/universities", form, {
        headers: { "x-admin-key": adminKey },
      });
      toast.success(`${form.name} registered on-chain! 🎉`);
      setForm({ name: "", wallet_address: "", contact_email: "" });
      loadUniversities();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(wallet, name) {
    if (!confirm(`Remove ${name}? Their wallet will be deauthorized on-chain.`)) return;
    setRemoving(wallet);
    try {
      await API.delete(`/api/universities/${wallet}`, {
        headers: { "x-admin-key": adminKey },
      });
      toast.success(`${name} removed`);
      loadUniversities();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRemoving(null);
    }
  }

  /* ── Key input screen ─────────────────────────────────── */
  if (!authenticated) {
    return (
      <div style={{ minHeight: "calc(100vh - 70px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚙️</div>
            <h2 style={{ marginBottom: "0.5rem" }}>Admin Panel</h2>
            <p style={{ marginBottom: "2rem" }}>Enter the admin API key to manage universities.</p>
            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input
                className="input"
                type="password"
                placeholder="Admin API Key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? <><span className="spinner" /> Verifying…</> : "Unlock Admin Panel"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ── Admin dashboard ──────────────────────────────────── */
  return (
    <div className="page">
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem" }}>
          <div>
            <h2>⚙️ Admin Panel</h2>
            <p style={{ marginTop: "0.25rem" }}>Manage authorized universities</p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { localStorage.removeItem("cv_admin_key"); setAuthenticated(false); }}
          >
            Logout
          </button>
        </div>

        {/* Add university form */}
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#f1f5f9", marginBottom: "1.5rem" }}>Register a New University</h3>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="grid-2">
              <div className="input-group">
                <label>University Name</label>
                <input className="input" name="name" value={form.name} onChange={handleChange} placeholder="Anna University" required />
              </div>
              <div className="input-group">
                <label>Contact Email (optional)</label>
                <input className="input" name="contact_email" type="email" value={form.contact_email} onChange={handleChange} placeholder="admin@university.edu" />
              </div>
            </div>
            <div className="input-group">
              <label>University Wallet Address</label>
              <input className="input" name="wallet_address" value={form.wallet_address} onChange={handleChange} placeholder="0x..." required />
              <p style={{ fontSize: "0.8rem", color: "#475569" }}>
                This wallet will be authorized on-chain via <code style={{ color: "#818cf8" }}>addUniversity()</code>. The university will use MetaMask with this address to log in.
              </p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding} style={{ alignSelf: "flex-start" }}>
              {adding ? <><span className="spinner" /> Registering on-chain…</> : "➕ Add University"}
            </button>
          </form>
        </div>

        {/* Universities list */}
        <div className="card">
          <h3 style={{ color: "#f1f5f9", marginBottom: "1.5rem" }}>
            Registered Universities ({universities.length})
          </h3>

          {universities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🏫</div>
              <p>No universities registered yet.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Wallet Address</th>
                    <th>Contact</th>
                    <th>Registered</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {universities.map((u) => (
                    <tr key={u.id}>
                      <td style={{ color: "#f1f5f9", fontWeight: 600 }}>{u.name}</td>
                      <td className="mono">{u.wallet_address}</td>
                      <td>{u.contact_email || "—"}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={removing === u.wallet_address}
                          onClick={() => handleRemove(u.wallet_address, u.name)}
                        >
                          {removing === u.wallet_address ? <span className="spinner" /> : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
