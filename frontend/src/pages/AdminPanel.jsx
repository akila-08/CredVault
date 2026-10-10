import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API from "../api/client";
import adminBg from "../assets/admin.png";
import IssuerVoting from "../components/IssuerVoting";
import PerformanceDashboard from "../components/PerformanceDashboard";

const portalBg = {
  backgroundImage: `linear-gradient(135deg, rgba(7,20,60,0.72) 0%, rgba(10,30,80,0.65) 100%), url(${adminBg})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
  backgroundColor: "#07142a",
  minHeight: "100vh",
};

export default function AdminPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  const [universities, setUniversities] = useState([]);
  const [verifiers, setVerifiers] = useState([]);
  const [verifierForm, setVerifierForm] = useState({ organization_name: "", email: "" });
  const [temporaryCredentials, setTemporaryCredentials] = useState(null);

  const [loading, setLoading] = useState(false);
  const [addingVerifier, setAddingVerifier] = useState(false);
  const [resendingVerifier, setResendingVerifier] = useState(null);
  const [removingVerifier, setRemovingVerifier] = useState(null);



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

      setAuthenticated(true);
      toast.success("Admin access granted");
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error("Invalid admin key");
      } else {
        toast.error(err.response?.data?.message || err.message);
      }
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

  function handleVerifierChange(e) {
    setVerifierForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleAddVerifier(e) {
    e.preventDefault();
    setAddingVerifier(true);
    setTemporaryCredentials(null);
    try {
      const { data } = await API.post("/api/verifiers", verifierForm, {
        headers: { "x-admin-key": adminKey },
      });
      if (data.emailSent) {
        toast.success(`Verifier login sent to ${verifierForm.email}`);
      } else {
        toast.error(`Verifier registered, but the welcome email was not sent: ${data.emailError || "Check the backend mail configuration."}`);
        setTemporaryCredentials({ email: verifierForm.email, password: data.temporaryPassword });
      }
      setVerifierForm({ organization_name: "", email: "" });
      loadVerifiers();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setAddingVerifier(false);
    }
  }

  async function handleResendVerifierEmail(verifier) {
    if (!confirm(`Resend setup credentials to ${verifier.email}? This resets their current password.`)) return;
    setResendingVerifier(verifier.id);
    setTemporaryCredentials(null);
    try {
      const { data } = await API.post(`/api/verifiers/${verifier.id}/resend-welcome-email`, {}, {
        headers: { "x-admin-key": adminKey },
      });
      if (data.emailSent) {
        toast.success(`Setup email sent to ${verifier.email}. They can change the password from Profile after signing in.`);
      } else {
        toast.error(`Password was reset, but the email was not sent: ${data.emailError || "Check the backend mail configuration."}`);
        setTemporaryCredentials({ email: verifier.email, password: data.temporaryPassword });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setResendingVerifier(null);
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
    setAdminKey("");
    setAuthenticated(false);
    setActiveSection(null);
  }

  if (!authenticated) {
    return (
      <div style={{ ...portalBg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚙️</div>
            <h2 style={{ marginBottom: "0.5rem", color: "#f0f6ff" }}>Admin Panel</h2>
            <p style={{ marginBottom: "2rem", color: "#93c5fd" }}>Enter the admin API key to manage universities and verifiers.</p>
            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input
                className="input"
                type="password"
                placeholder="Admin API Key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
                style={{ color: "#ffffff", caretColor: "#60a5fa" }}
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
    <div className="page" style={portalBg}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div className="admin-header">
          <div>
            <h2>Admin Panel</h2>
            <p style={{ marginTop: "0.25rem" }}>Choose what you want to manage.</p>
          </div>
          <button
  className="btn btn-outline btn-sm admin-logout-btn"
  onClick={logout}
>
  Logout
</button>
        </div>

        <div className="grid-2 admin-selector">
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
          <button
            className={`card${activeSection === "voting" ? " active-admin-card" : ""}`}
            onClick={() => setActiveSection("voting")}
            style={{ textAlign: "left", cursor: "pointer" }}
          >
            <h3 style={{ color: "#f1f5f9", marginBottom: "0.5rem" }}>Issuer Voting</h3>
            <p>Propose issuers and vote with your validator wallet on Polygon Amoy.</p>
          </button>
          <button
            className={`card${activeSection === "performance" ? " active-admin-card" : ""}`}
            onClick={() => setActiveSection("performance")}
            style={{ textAlign: "left", cursor: "pointer" }}
          >
            <h3 style={{ color: "#f1f5f9", marginBottom: "0.5rem" }}>Performance Dashboard</h3>
            <p>Review gas costs, certificate search timings, and Bloom filter activity.</p>
          </button>
        </div>

        {!activeSection && (
          <div className="alert alert-warning">
            Select a dashboard or management section to continue.
          </div>
        )}

        {activeSection === "university" && (
          <>
            <div className="alert alert-warning">Adding and removing university issuers now requires validator votes. Use the Issuer Voting section.</div>
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
                      </tr>
                    </thead>
                    <tbody>
                      {universities.map((u) => (
                        <tr key={u.id}>
                          <td style={{ color: "#f1f5f9", fontWeight: 600 }}>{u.name}</td>
                          <td className="mono">{u.wallet_address}</td>
                          <td>{u.contact_email || "-"}</td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeSection === "voting" && <IssuerVoting adminKey={adminKey} />}

        {activeSection === "performance" && <PerformanceDashboard adminKey={adminKey} />}

        {activeSection === "verifier" && (
          <>
            <div className="card admin-card">
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
                <button
type="submit"
className="btn btn-primary admin-submit-btn"
disabled={addingVerifier}
>
                  {addingVerifier ? <><span className="spinner" /> Adding...</> : "Add Verifier"}
                </button>
              </form>
              {temporaryCredentials && (
                <div className="alert alert-warning" style={{ marginTop: "1.5rem" }}>
                  The welcome email to {temporaryCredentials.email} could not be delivered. Share this temporary password securely and ask the verifier to change it from Profile after signing in: <span className="mono">{temporaryCredentials.password}</span>
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
                        <th>Actions</th>
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
                            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                              <button
                                className="btn btn-outline btn-sm"
                                disabled={resendingVerifier === v.id}
                                onClick={() => handleResendVerifierEmail(v)}
                              >
                                {resendingVerifier === v.id ? <span className="spinner" /> : "Resend setup email"}
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={removingVerifier === v.id}
                                onClick={() => handleRemoveVerifier(v.id, v.organization_name)}
                              >
                                {removingVerifier === v.id ? <span className="spinner" /> : "Remove"}
                              </button>
                            </div>
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
