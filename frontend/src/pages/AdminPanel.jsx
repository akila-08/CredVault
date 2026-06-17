import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API from "../api/client";

export default function AdminPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  const [universities, setUniversities] = useState([]);
  const [universityForm, setUniversityForm] = useState({ name: "", wallet_address: "", contact_email: "" });
  const [verifiers, setVerifiers] = useState([]);
  const [verifierForm, setVerifierForm] = useState({ organization_name: "", email: "" });
  const [temporaryPassword, setTemporaryPassword] = useState(null);

  const [loading, setLoading] = useState(false);
  const [addingUniversity, setAddingUniversity] = useState(false);
  const [addingVerifier, setAddingVerifier] = useState(false);
  const [removingUniversity, setRemovingUniversity] = useState(null);
  const [removingVerifier, setRemovingVerifier] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("cv_admin_key");
    if (saved) setAdminKey(saved);
  }, []);

  useEffect(() => {
    if (!authenticated || activeSection !== "university") return;
    loadUniversities();
  }, [authenticated, activeSection]);

  useEffect(() => {
    if (!authenticated || activeSection !== "verifier") return;
    loadVerifiers();
  }, [authenticated, activeSection]);

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await API.get("/api/admin/verify-key", { headers: { "x-admin-key": adminKey } });
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
      setUniversities(data.universities || []);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  }

  async function loadVerifiers() {
    try {
      const { data } = await API.get("/api/verifiers", {
        headers: { "x-admin-key": adminKey },
      });
      setVerifiers(data.verifiers || []);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  }

  function handleUniversityChange(e) {
    setUniversityForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  function handleVerifierChange(e) {
    setVerifierForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleAddUniversity(e) {
    e.preventDefault();
    setAddingUniversity(true);
    try {
      await API.post("/api/universities", universityForm, {
        headers: { "x-admin-key": adminKey },
      });
      toast.success(`${universityForm.name} registered on-chain`);
      setUniversityForm({ name: "", wallet_address: "", contact_email: "" });
      loadUniversities();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setAddingUniversity(false);
    }
  }

  async function handleRemoveUniversity(wallet, name) {
    if (!confirm(`Remove ${name}? Their wallet will be deauthorized on-chain.`)) return;
    setRemovingUniversity(wallet);
    try {
      await API.delete(`/api/universities/${wallet}`, {
        headers: { "x-admin-key": adminKey },
      });
      toast.success(`${name} removed`);
      loadUniversities();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRemovingUniversity(null);
    }
  }

  async function handleAddVerifier(e) {
    e.preventDefault();
    setAddingVerifier(true);
    setTemporaryPassword(null);
    try {
      const { data } = await API.post("/api/verifiers", verifierForm, {
        headers: { "x-admin-key": adminKey },
      });
      if (data.emailSent) {
        toast.success(`Verifier login sent to ${verifierForm.email}`);
      } else {
        toast.success("Verifier registered. Configure SMTP to send emails automatically.");
        setTemporaryPassword(data.temporaryPassword);
      }
      setVerifierForm({ organization_name: "", email: "" });
      loadVerifiers();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setAddingVerifier(false);
    }
  }

  async function handleRemoveVerifier(id, organizationName) {
    if (!confirm(`Remove verifier access for ${organizationName}?`)) return;
    setRemovingVerifier(id);
    try {
      await API.delete(`/api/verifiers/${id}`, {
        headers: { "x-admin-key": adminKey },
      });
      toast.success(`${organizationName} removed`);
      loadVerifiers();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRemovingVerifier(null);
    }
  }

  function logout() {
    localStorage.removeItem("cv_admin_key");
    setAuthenticated(false);
    setActiveSection(null);
  }

  if (!authenticated) {
    return (
      <div style={{ minHeight: "calc(100vh - 70px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
            <h2 style={{ marginBottom: "0.5rem" }}>Admin Panel</h2>
            <p style={{ marginBottom: "2rem" }}>Enter the admin API key to manage universities and verifiers.</p>
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
                {loading ? <><span className="spinner" /> Verifying...</> : "Unlock Admin Panel"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          <div>
            <h2>Admin Panel</h2>
            <p style={{ marginTop: "0.25rem" }}>Choose what you want to manage.</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={logout}>Logout</button>
        </div>

        <div className="grid-2" style={{ marginBottom: "2rem" }}>
          <button
            className={`card${activeSection === "university" ? " active-admin-card" : ""}`}
            onClick={() => setActiveSection("university")}
            style={{ textAlign: "left", cursor: "pointer" }}
          >
            <h3 style={{ color: "#f1f5f9", marginBottom: "0.5rem" }}>University</h3>
            <p>Add new university wallets and remove existing university access.</p>
          </button>
          <button
            className={`card${activeSection === "verifier" ? " active-admin-card" : ""}`}
            onClick={() => setActiveSection("verifier")}
            style={{ textAlign: "left", cursor: "pointer" }}
          >
            <h3 style={{ color: "#f1f5f9", marginBottom: "0.5rem" }}>Verifier</h3>
            <p>Register verifier organizations and send them login credentials.</p>
          </button>
        </div>

        {!activeSection && (
          <div className="alert alert-warning">
            Select University or Verifier to continue.
          </div>
        )}

        {activeSection === "university" && (
          <>
            <div className="card" style={{ marginBottom: "2rem" }}>
              <h3 style={{ color: "#f1f5f9", marginBottom: "1.5rem" }}>Register a New University</h3>
              <form onSubmit={handleAddUniversity} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="grid-2">
                  <div className="input-group">
                    <label>University Name</label>
                    <input className="input" name="name" value={universityForm.name} onChange={handleUniversityChange} placeholder="Anna University" required />
                  </div>
                  <div className="input-group">
                    <label>Contact Email (optional)</label>
                    <input className="input" name="contact_email" type="email" value={universityForm.contact_email} onChange={handleUniversityChange} placeholder="admin@university.edu" />
                  </div>
                </div>
                <div className="input-group">
                  <label>University Wallet Address</label>
                  <input className="input" name="wallet_address" value={universityForm.wallet_address} onChange={handleUniversityChange} placeholder="0x..." required />
                  <p style={{ fontSize: "0.8rem", color: "#475569" }}>
                    This wallet will be authorized on-chain. The university will use MetaMask with this address to log in.
                  </p>
                </div>
                <button type="submit" className="btn btn-primary" disabled={addingUniversity} style={{ alignSelf: "flex-start" }}>
                  {addingUniversity ? <><span className="spinner" /> Registering on-chain...</> : "Add University"}
                </button>
              </form>
            </div>

            <div className="card">
              <h3 style={{ color: "#f1f5f9", marginBottom: "1.5rem" }}>
                Registered Universities ({universities.length})
              </h3>
              {universities.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>
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
                          <td>{u.contact_email || "-"}</td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={removingUniversity === u.wallet_address}
                              onClick={() => handleRemoveUniversity(u.wallet_address, u.name)}
                            >
                              {removingUniversity === u.wallet_address ? <span className="spinner" /> : "Remove"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeSection === "verifier" && (
          <>
            <div className="card" style={{ marginBottom: "2rem" }}>
              <h3 style={{ color: "#f1f5f9", marginBottom: "1.5rem" }}>Register a New Verifier</h3>
              <form onSubmit={handleAddVerifier} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="grid-2">
                  <div className="input-group">
                    <label>Organization Name</label>
                    <input className="input" name="organization_name" value={verifierForm.organization_name} onChange={handleVerifierChange} placeholder="Acme HR Verification" required />
                  </div>
                  <div className="input-group">
                    <label>Email</label>
                    <input className="input" name="email" type="email" value={verifierForm.email} onChange={handleVerifierChange} placeholder="verifier@example.com" required />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={addingVerifier} style={{ alignSelf: "flex-start" }}>
                  {addingVerifier ? <><span className="spinner" /> Adding...</> : "Add Verifier"}
                </button>
              </form>
              {temporaryPassword && (
                <div className="alert alert-warning" style={{ marginTop: "1.5rem" }}>
                  SMTP is not configured, so the password was not emailed. Temporary password: <span className="mono">{temporaryPassword}</span>
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ color: "#f1f5f9", marginBottom: "1.5rem" }}>
                Registered Verifiers ({verifiers.length})
              </h3>
              {verifiers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>
                  <p>No verifiers registered yet.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Organization</th>
                        <th>Email</th>
                        <th>Registered</th>
                        <th>Password Changed</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifiers.map((v) => (
                        <tr key={v.id}>
                          <td style={{ color: "#f1f5f9", fontWeight: 600 }}>{v.organization_name}</td>
                          <td>{v.email}</td>
                          <td>{new Date(v.created_at).toLocaleDateString()}</td>
                          <td>{v.password_changed_at ? new Date(v.password_changed_at).toLocaleDateString() : "-"}</td>
                          <td>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={removingVerifier === v.id}
                              onClick={() => handleRemoveVerifier(v.id, v.organization_name)}
                            >
                              {removingVerifier === v.id ? <span className="spinner" /> : "Remove"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
