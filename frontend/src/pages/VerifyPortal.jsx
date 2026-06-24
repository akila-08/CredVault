import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import API from "../api/client";
import verifierBg from "../assets/verifier.png";

const portalBg = {
  backgroundImage: `linear-gradient(135deg, rgba(7,20,60,0.72) 0%, rgba(10,30,80,0.65) 100%), url(${verifierBg})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
  backgroundColor: "#07142a",
  minHeight: "100vh",
};

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();
  const cls = `badge-${normalized}`;
  return <span className={`badge ${cls}`}>{normalized}</span>;
}

/*function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}*/
function formatDate(value) {
  if (!value) return "-";

  const utcValue = value.endsWith("Z")
    ? value
    : `${value}Z`;

  return new Date(utcValue).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function VerifyPortal() {
  const [authenticated, setAuthenticated] = useState(false);
  const [verifier, setVerifier] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestingOwnership, setRequestingOwnership] = useState(false);

  useEffect(() => {
    const checkSessionExpiry = () => {
      const expiry =
        localStorage.getItem("cv_verifier_expiry");

      if (!expiry) return;

      if (Date.now() > Number(expiry)) {
        localStorage.removeItem("cv_verifier_token");
        localStorage.removeItem("cv_verifier_expiry");

        setAuthenticated(false);
        setVerifier(null);

        toast.error(
          "Session expired. Please login again."
        );
      }
    };

    checkSessionExpiry();

    const interval = setInterval(
      checkSessionExpiry,
      10000
    );

    const token =
      localStorage.getItem("cv_verifier_token");

    if (!token) {
      return () => clearInterval(interval);
    }

    setAuthenticated(true);

    API.get("/api/verifiers/profile")
      .then(({ data }) => {
        setVerifier(data.verifier);
      })
      .catch(() => {
        localStorage.removeItem("cv_verifier_token");
        localStorage.removeItem("cv_verifier_expiry");

        setAuthenticated(false);
        setVerifier(null);
      });

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authenticated) loadRequests();
  }, [authenticated]);

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  function handleLoginChange(e) {
    setLoginForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  function handlePasswordChange(e) {
    setPasswordForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function loadRequests() {
    setRequestsLoading(true);
    try {
      const { data } = await API.get("/api/verification-requests/verifier");
      setRequests(data.requests || []);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        toast.error("Session expired. Please log in again.");
      } else {
        toast.error(err.response?.data?.message || err.message);
      }
    } finally {
      setRequestsLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const { data } = await API.post("/api/verifiers/login", loginForm);
      localStorage.setItem("cv_verifier_token", data.token);

      localStorage.setItem(
        "cv_verifier_expiry",
        (Date.now() + 24 * 60 * 60 * 1000).toString()
      );

      setVerifier(data.verifier);
      setAuthenticated(true);

      toast.success("Verifier login successful");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("cv_verifier_token");
    localStorage.removeItem("cv_verifier_expiry");

    setAuthenticated(false);
    setVerifier(null);

    setLoginForm({
      email: "",
      password: "",
    });

    setFile(null);
    setResult(null);
    setRequests([]);
    setProfileOpen(false);

    toast("Logged out");
  }

  async function submitPasswordChange(e) {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      await API.post("/api/verifiers/change-password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success("Password changed");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      const { data } = await API.get("/api/verifiers/profile");
      setVerifier(data.verifier);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (!file) {
      toast.error("Upload the certificate PDF");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("certificate", file);
      const { data } = await API.post("/api/credentials/verify", fd);
      setResult(data);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        toast.error("Session expired. Please log in again.");
      } else {
        toast.error(err.response?.data?.message || err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function requestOwnershipVerification() {
    if (!result?.credentialId) {
      toast.error("Credential metadata was not found for this certificate");
      return;
    }

    setRequestingOwnership(true);
    try {
      const { data } = await API.post("/api/verification-requests", {
        credential_id: result.credentialId,
      });
      toast.success(data.alreadyExists ? "Verification request already exists" : "Verification request sent to student");
      await loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRequestingOwnership(false);
    }
  }

  const statusConfig = {
    VALID: { label: "Certificate Valid", cls: "alert-success" },
    REVOKED: { label: "Revoked - Certificate was revoked by the university", cls: "alert-warning" },
    INVALID: { label: "Invalid - Not found on blockchain", cls: "alert-error" },
  };

  const currentRequest = result?.credentialId
    ? requests.find((request) => request.credential_id === result.credentialId)
    : null;

  if (!authenticated) {
    return (
      <div className="page" style={portalBg}>
        <div className="container" style={{ maxWidth: 460, paddingTop: "4rem", paddingBottom: "4rem" }}>
          <div className="card" style={{ padding: "2.5rem" }}>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</div>
              <h2 style={{ color: "#f0f6ff" }}>Verifier Login</h2>
              <p style={{ marginTop: "0.5rem", color: "#93c5fd" }}>Use the email and password sent by the admin.</p>
            </div>
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="input-group">
                <label>Email</label>
                <input className="input" type="email" name="email" value={loginForm.email} onChange={handleLoginChange} placeholder="verifier@example.com" required />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input className="input" type="password" name="password" value={loginForm.password} onChange={handleLoginChange} placeholder="Password" required />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loginLoading}>
                {loginLoading ? <><span className="spinner" /> Logging in...</> : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }
  console.log("REQUESTS:", requests);
  return (
    <div className="page" style={portalBg}>
      <div className="container" style={{ maxWidth: 980, paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          <div>
            <h2>Verify a Certificate</h2>
            <p style={{ marginTop: "0.35rem" }}>
              Signed in as {verifier?.organization_name || "Verifier"} ({verifier?.email})
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="btn btn-outline btn-sm" onClick={() => setProfileOpen((p) => !p)}>
              Profile
            </button>
            <button className="btn btn-outline btn-sm" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {profileOpen && (
          <div className="card" style={{ marginBottom: "2rem" }}>
            <h3 style={{ color: "#f1f5f9", marginBottom: "1rem" }}>Verifier Profile</h3>
            <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
              <div>
                <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.2rem" }}>Organization</p>
                <p style={{ color: "#f1f5f9" }}>{verifier?.organization_name}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.2rem" }}>Email</p>
                <p style={{ color: "#f1f5f9" }}>{verifier?.email}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.2rem" }}>Password Changed</p>
                <p style={{ color: "#f1f5f9" }}>{verifier?.password_changed_at ? new Date(verifier.password_changed_at).toLocaleString() : "Not changed yet"}</p>
              </div>
            </div>

            <hr className="divider" />
            <h3 style={{ color: "#f1f5f9", marginBottom: "1rem" }}>Change Password</h3>
            <form onSubmit={submitPasswordChange} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="grid-3">
                <div className="input-group">
                  <label>Current Password</label>
                  <input className="input" type="password" name="current_password" value={passwordForm.current_password} onChange={handlePasswordChange} required />
                </div>
                <div className="input-group">
                  <label>New Password</label>
                  <input className="input" type="password" name="new_password" value={passwordForm.new_password} onChange={handlePasswordChange} minLength={8} required />
                </div>
                <div className="input-group">
                  <label>Confirm Password</label>
                  <input className="input" type="password" name="confirm_password" value={passwordForm.confirm_password} onChange={handlePasswordChange} minLength={8} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={passwordLoading} style={{ alignSelf: "flex-start" }}>
                {passwordLoading ? <><span className="spinner" /> Saving...</> : "Change Password"}
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div
              {...getRootProps()}
              className={`dropzone${isDragActive ? " active" : ""}`}
              style={{ textAlign: "center", padding: "3rem 2rem" }}
            >
              <input {...getInputProps()} />
              {file ? (
                <>
                  <p style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "1rem" }}>{file.name}</p>
                  <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.3rem" }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setResult(null);
                    }}
                    style={{ marginTop: "0.75rem", background: "none", border: "none", color: "#f43f5e", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontWeight: 500 }}>Drag and drop the certificate PDF here</p>
                  <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
                    or <span style={{ color: "#818cf8" }}>click to browse</span>
                  </p>
                </>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !file}
              style={{ alignSelf: "center", fontSize: "1rem", padding: "0.75rem 2.5rem" }}
            >
              {loading ? <><span className="spinner" /> Verifying on-chain...</> : "Verify on Blockchain"}
            </button>
          </form>
        </div>

        {result && (
          <div style={{ marginTop: "2rem", animation: "fadeUp 0.4s ease" }}>
            {(() => {
              const cfg = statusConfig[result.status] || statusConfig.INVALID;
              return (
                <>
                  <div className={`alert ${cfg.cls}`} style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                    {cfg.label}
                  </div>

                  {result.status !== "INVALID" && result.onChain && (
                    <div className="card">
                      <h3 style={{ color: "#f1f5f9", marginBottom: "1.25rem" }}>On-chain Record</h3>
                      <div className="grid-2">
                        {[
                          { label: "Status", value: result.status },
                          { label: "Issuing University", value: result.onChain.issuingUniversity || result.onChain.issuedBy },
                          { label: "Issued At", value: result.onChain.issuedAt ? new Date(result.onChain.issuedAt).toLocaleString() : "-" },
                          { label: "Student Wallet", value: result.onChain.studentWallet, mono: true },
                        ].map(({ label, value, mono }) => (
                          <div key={label}>
                            <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.2rem" }}>{label}</p>
                            <p style={{ fontSize: "0.875rem", color: "#f1f5f9", fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>{value}</p>
                          </div>
                        ))}
                      </div>

                      {result.metadata && (
                        <>
                          <hr className="divider" />
                          <h4 style={{ color: "#94a3b8", marginBottom: "1rem", fontSize: "0.85rem", textTransform: "uppercase" }}>Certificate Details</h4>
                          <div className="grid-2">
                            {[
                              { label: "Student", value: result.metadata.student_name },
                              { label: "Student Email", value: result.metadata.student_email || "-" },
                              { label: "Register No.", value: result.metadata.register_number },
                              { label: "Degree", value: result.metadata.degree },
                              { label: "Branch", value: result.metadata.branch },
                              { label: "Issue Date", value: result.metadata.issue_date },
                              { label: "Institution", value: result.metadata.institution },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.2rem" }}>{label}</p>
                                <p style={{ fontSize: "0.875rem", color: "#f1f5f9" }}>{value}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <hr className="divider" />
                      <p style={{ fontSize: "0.75rem", color: "#475569" }}>
                        Document Hash: <span className="mono" style={{ color: "#6366f1" }}>{result.credentialHash}</span>
                      </p>

                      {result.status === "VALID" && (
                        <>
                          <hr className="divider" />
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                            <div>
                              <p style={{ fontWeight: 600, color: "#f1f5f9", marginBottom: "0.2rem" }}>Ownership Verification</p>
                              <p style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                Request approval from the student. MetaMask opens only in the Student Portal.
                              </p>
                            </div>

                            {currentRequest ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                <StatusBadge status={currentRequest.status} />
                                <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Requested {formatDate(currentRequest.created_at)}</span>
                              </div>
                            ) : (
                              <button
                                className="btn btn-sm"
                                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", whiteSpace: "nowrap" }}
                                onClick={requestOwnershipVerification}
                                disabled={requestingOwnership}
                              >
                                {requestingOwnership ? <><span className="spinner" /> Sending...</> : "Request Ownership Verification"}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        <div className="card" style={{ marginTop: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <h3 style={{ color: "#f1f5f9" }}>Verification Requests</h3>
            <button className="btn btn-outline btn-sm" onClick={loadRequests} disabled={requestsLoading}>
              {requestsLoading ? <><span className="spinner" /> Refreshing...</> : "Refresh"}
            </button>
          </div>

          {requestsLoading && !requests.length ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#475569" }}><span className="spinner" /></div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#475569" }}>
              <p>No ownership verification requests yet.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Student Email</th>
                    <th>Certificate</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td style={{ color: "#f1f5f9", fontWeight: 500 }}>{request.credential?.student_name || "-"}</td>
                      <td>{request.student_email}</td>
                      <td>{request.credential ? `${request.credential.degree} / ${request.credential.branch}` : request.credential_id}</td>
                      <td><StatusBadge status={request.status} /></td>
                      <td>{formatDate(request.created_at)}</td>
                      <td>{formatDate(request.completed_at)}</td>
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