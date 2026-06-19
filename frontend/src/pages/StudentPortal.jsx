import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import API from "../api/client";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();
  const cls = `badge-${normalized}`;
  return <span className={`badge ${cls}`}>{normalized}</span>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

async function getStudentAuthConfig() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Student session expired. Please sign in again.");
  }

  return {
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
    },
  };
}

function buildApprovalMessage({ request, studentEmail }) {
  return [
    "CredVault Ownership Verification",
    `Request ID: ${request.id}`,
    `Credential ID: ${request.credential_id}`,
    `Credential Hash: ${request.credential?.credential_hash || request.credential?.document_hash || ""}`,
    `Student Email: ${String(studentEmail || "").trim().toLowerCase()}`,
    "I approve this ownership verification request.",
  ].join("\n");
}

function AuthPanel({ onLogin }) {
  const [mode, setMode] = useState("login");
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
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>CV</div>
            <h2>Student Portal</h2>
            <p style={{ marginTop: "0.5rem" }}>View certificates issued to your wallet</p>
          </div>

          <div className="tabs" style={{ marginBottom: "1.5rem" }}>
            <button type="button" className={`tab${mode === "login" ? " active" : ""}`} onClick={() => setMode("login")}>Sign In</button>
            <button type="button" className={`tab${mode === "signup" ? " active" : ""}`} onClick={() => setMode("signup")}>Sign Up</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="input-group">
              <label>Email</label>
              <input className="input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input className="input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Password" required />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? <><span className="spinner" /> Loading...</> : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function VerificationRequests({ requests, loading, approving, rejecting, onApprove, onReject, onRefresh }) {
  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="card" style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ color: "#f1f5f9" }}>Pending Verification Requests</h3>
          <p style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
            {pendingCount ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting for your approval.` : "No pending approvals right now."}
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? <><span className="spinner" /> Refreshing...</> : "Refresh"}
        </button>
      </div>

      {loading && !requests.length ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#475569" }}><span className="spinner" /></div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#475569" }}>
          <p>No verification requests found for your student email.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Verifier Name</th>
                <th>Certificate Name</th>
                <th>Request Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td style={{ color: "#f1f5f9", fontWeight: 500 }}>{request.verifier_name || request.verifier_email || "Verifier"}</td>
                  <td>{request.credential ? `${request.credential.degree} / ${request.credential.branch}` : request.credential_id}</td>
                  <td>{formatDate(request.created_at)}</td>
                  <td><StatusBadge status={request.status} /></td>
                  <td>
                    {request.status === "pending" ? (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button className="btn btn-primary btn-sm" onClick={() => onApprove(request)} disabled={approving === request.id || rejecting === request.id}>
                          {approving === request.id ? <><span className="spinner" /> Approving...</> : "Approve Ownership"}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => onReject(request)} disabled={approving === request.id || rejecting === request.id}>
                          {rejecting === request.id ? <><span className="spinner" /> Declining...</> : "Decline"}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{formatDate(request.completed_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CredCard({ cred }) {
  const [copied, setCopied] = useState(false);

  function copyHash() {
    navigator.clipboard.writeText(cred.credential_hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div>
          <p style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {cred.institution}
          </p>
          <h3 style={{ color: "#f1f5f9", marginTop: "0.2rem" }}>{cred.degree}</h3>
          <p style={{ fontSize: "0.875rem" }}>{cred.branch}</p>
        </div>
        <span className={`badge badge-${cred.status === "ACTIVE" ? "active" : "revoked"}`}>
          {cred.status === "ACTIVE" ? "Valid" : "Revoked"}
        </span>
      </div>

      <hr className="divider" style={{ margin: "0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {[
          { label: "Student", value: cred.student_name },
          { label: "Email", value: cred.student_email || "-" },
          { label: "Register No.", value: cred.register_number },
          { label: "Issue Date", value: cred.issue_date },
          { label: "Tx Hash", value: cred.tx_hash ? `${cred.tx_hash.slice(0, 14)}...` : "-", mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label}>
            <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>
              {label}
            </p>
            <p style={{ fontSize: "0.875rem", color: "#f1f5f9", fontFamily: mono ? "monospace" : undefined, wordBreak: mono ? "break-all" : undefined }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        <button className="btn btn-outline btn-sm" onClick={copyHash}>
          {copied ? "Copied" : "Copy Hash"}
        </button>
        <button
          className="btn btn-sm"
          style={{
            background: "rgba(45,212,191,0.1)",
            color: "#2dd4bf",
            border: "1px solid rgba(45,212,191,0.25)",
          }}
          onClick={() => {
            if (!cred.certificate_url) {
              toast.error("Certificate not uploaded yet");
              return;
            }
            window.open(cred.certificate_url, "_blank");
          }}
        >
          View Certificate
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={async () => {
            try {
              if (!cred.certificate_url) {
                toast.error("Certificate not uploaded yet");
                return;
              }
              const response = await fetch(cred.certificate_url);
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${cred.student_name}_certificate.pdf`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            } catch (err) {
              console.error(err);
              toast.error("Failed to download certificate");
            }
          }}
        >
          Download
        </button>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [wallet, setWallet] = useState("");
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setRequestsLoading(true);
    try {
      const config = await getStudentAuthConfig();
      const { data } = await API.get("/api/verification-requests/student", config);
      setRequests(data.requests || []);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function approveRequest(request) {
    if (!window.ethereum) {
      toast.error("MetaMask not detected. Please install MetaMask.");
      return;
    }

    setApproving(request.id);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const message = buildApprovalMessage({ request, studentEmail: user.email });
      const signature = await signer.signMessage(message);
      const config = await getStudentAuthConfig();

      await API.post(`/api/verification-requests/${request.id}/approve`, {
        wallet_address: walletAddress,
        message,
        signature,
      }, config);

      toast.success("Ownership approved");
      await loadRequests();
    } catch (err) {
      if (err.code === 4001 || err.message?.includes("rejected") || err.message?.includes("denied")) {
        toast.error("MetaMask approval was cancelled");
      } else {
        toast.error(err.response?.data?.message || err.message);
      }
    } finally {
      setApproving(null);
    }
  }

  /*async function rejectRequest(id) {
    if (!confirm("Decline this ownership verification request?")) return;

    setRejecting(id);
    try {
      const config = await getStudentAuthConfig();
      await API.post(`/api/verification-requests/${id}/reject`, {}, config);
      toast.success("Ownership request declined");
      await loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRejecting(null);
    }
  }*/
  async function rejectRequest(request) {
  if (!confirm("Decline this ownership verification request?")) return;

  setRejecting(request.id);

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);

    await provider.send("eth_requestAccounts", []);

    const signer = await provider.getSigner();

    const walletAddress = await signer.getAddress();

    const message = [
      "CredVault Ownership Verification",
      `Request ID: ${request.id}`,
      `Credential ID: ${request.credential_id}`,
      `Credential Hash: ${
        request.credential?.credential_hash ||
        request.credential?.document_hash ||
        ""
      }`,
      `Student Email: ${user.email}`,
      "I reject this ownership verification request.",
    ].join("\n");

    const signature = await signer.signMessage(message);

    const config = await getStudentAuthConfig();

    await API.post(
      `/api/verification-requests/${request.id}/reject`,
      {
        wallet_address: walletAddress,
        signature,
        message,
      },
      config
    );

    toast.success("Ownership request declined");

    await loadRequests();
  } catch (err) {
    toast.error(err.response?.data?.message || err.message);
  } finally {
    setRejecting(null);
  }
}


  async function search(e) {
    e.preventDefault();
    const normalised = wallet.trim().toLowerCase();
    if (!normalised) {
      toast.error("Enter your wallet address");
      return;
    }
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2>My Certificates</h2>
            <p style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>{user.email}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onLogout}>Logout</button>
        </div>

        <VerificationRequests
          requests={requests}
          loading={requestsLoading}
          approving={approving}
          rejecting={rejecting}
          onApprove={approveRequest}
          onReject={rejectRequest}
          onRefresh={loadRequests}
        />

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
              {loading ? <><span className="spinner" /> Loading...</> : "View Certificates"}
            </button>
          </form>
        </div>

        {searched && (
          creds.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem", color: "#475569" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>--</div>
              <p>No certificates found for this wallet address.</p>
            </div>
          ) : (
            <div className="grid-2">
              {creds.map((c) => <CredCard key={c.id} cred={c} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function StudentPortal() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setUser(data.session?.user || null))
      .finally(() => setCheckingSession(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    toast("Logged out");
  }

  if (checkingSession) {
    return (
      <div className="page">
        <div className="container" style={{ paddingTop: "4rem", textAlign: "center", color: "#475569" }}>
          <span className="spinner" />
        </div>
      </div>
    );
  }

  if (!user) return <AuthPanel onLogin={setUser} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}


