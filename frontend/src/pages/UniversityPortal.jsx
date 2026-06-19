import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import API from "../api/client";

function truncate(addr) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}

function LoginStep({ onLogin }) {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    if (!window.ethereum) {
      toast.error("MetaMask not detected. Please install MetaMask.");
      return;
    }
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const { data: nonceRes } = await API.get(`/api/auth/nonce/${address}`);
      const nonce = nonceRes.nonce;

      const domain = window.location.host;
      const origin = window.location.origin;
      const issuedAt = new Date().toISOString();
      const preparedMsg = [
        `${domain} wants you to sign in with your Ethereum account:`,
        address,
        "",
        "Sign in to CredVault University Portal",
        "",
        `URI: ${origin}`,
        "Version: 1",
        "Chain ID: 80002",
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
      ].join("\n");

      const signature = await signer.signMessage(preparedMsg);

      const { data: loginRes } = await API.post("/api/auth/login", {
        message: preparedMsg,
        signature,
        address,
      });

      localStorage.setItem("cv_uni_token", loginRes.token);
      localStorage.setItem("cv_uni_info", JSON.stringify(loginRes.university));
      toast.success(`Welcome, ${loginRes.university.name}!`);
      onLogin(loginRes.university);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "calc(100vh - 70px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        <div className="card" style={{ textAlign: "center", padding: "3rem 2.5rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>CV</div>
          <h2 style={{ marginBottom: "0.5rem" }}>University Portal</h2>
          <p style={{ marginBottom: "2rem" }}>
            Connect your registered wallet to issue and manage student certificates.
            You only need to sign <strong style={{ color: "#f1f5f9" }}>once</strong> to get a 24-hour session.
          </p>
          <button className="btn btn-primary btn-full" onClick={handleConnect} disabled={loading}>
            {loading ? <><span className="spinner" /> Connecting...</> : "Connect Wallet"}
          </button>
          <p style={{ fontSize: "0.8rem", marginTop: "1rem", color: "#475569" }}>
            Only wallets registered by admin can log in
          </p>
        </div>
      </div>
    </div>
  );
}

function IssueForm({ university, onIssued }) {
  const [form, setForm] = useState({
    student_name: "",
    student_email: "",
    register_number: "",
    degree: "",
    branch: "",
    issue_date: "",
    student_wallet: "",
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  function handleChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      toast.error("Please upload the certificate PDF");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("certificate", file);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));

      const { data } = await API.post("/api/credentials/issue", fd);
      setResult(data);
      toast.success("Certificate issued on-chain!");
      onIssued?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div {...getRootProps()} className={`dropzone${isDragActive ? " active" : ""}`}>
        <input {...getInputProps()} />
        <div className="dropzone-icon">PDF</div>
        {file ? (
          <p style={{ color: "#f1f5f9" }}>{file.name}</p>
        ) : (
          <p>Drag and drop the certificate PDF here, or <span style={{ color: "#818cf8" }}>click to browse</span></p>
        )}
      </div>

      <div className="grid-2">
        {[
          { name: "student_name", label: "Student Name", placeholder: "John Doe" },
          { name: "student_email", label: "Student Email", placeholder: "student@example.com", type: "email" },
          { name: "register_number", label: "Register Number", placeholder: "21CS001" },
          { name: "degree", label: "Degree", placeholder: "B.Tech" },
          { name: "branch", label: "Branch", placeholder: "Computer Science" },
          { name: "issue_date", label: "Issue Date", placeholder: "2024-04-01", type: "date" },
          { name: "student_wallet", label: "Student Wallet (0x)", placeholder: "0xabc..." },
        ].map(({ name, label, placeholder, type }) => (
          <div key={name} className="input-group">
            <label>{label}</label>
            <input
              className="input"
              type={type || "text"}
              name={name}
              value={form[name]}
              onChange={handleChange}
              placeholder={placeholder}
              required
            />
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#818cf8" }}>
        <strong>Issuing as:</strong> {university.name} ({truncate(university.wallet)})
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: "flex-start" }}>
        {loading ? <><span className="spinner" /> Issuing...</> : "Issue Certificate on-chain"}
      </button>

      {result && (
        <div className="alert alert-success">
          <div>
            <p style={{ color: "#86efac", fontWeight: 600 }}>Certificate issued successfully!</p>
            <p style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
              <span className="mono">Tx: {result.txHash}</span>
            </p>
          </div>
        </div>
      )}
    </form>
  );
}

function IssuedList({ refresh }) {
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await API.get("/api/credentials/university");
      setCreds(data.credentials);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refresh]);

  async function handleRevoke(credential_hash, name) {
    if (!confirm(`Revoke certificate for ${name}? This action is irreversible on-chain.`)) return;
    setRevoking(credential_hash);
    try {
      await API.post("/api/credentials/revoke", { credential_hash });
      toast.success("Certificate revoked on-chain");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRevoking(null);
    }
  }

  if (loading) return <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}><span className="spinner" /></div>;

  if (!creds.length) return (
    <div style={{ textAlign: "center", padding: "4rem", color: "#475569" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>--</div>
      <p>No certificates issued yet.</p>
    </div>
  );

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Email</th>
            <th>Reg. No</th>
            <th>Degree / Branch</th>
            <th>Issue Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {creds.map((c) => (
            <tr key={c.id}>
              <td style={{ color: "#f1f5f9", fontWeight: 500 }}>{c.student_name}</td>
              <td>{c.student_email || "-"}</td>
              <td className="mono">{c.register_number}</td>
              <td>{c.degree} / {c.branch}</td>
              <td>{c.issue_date}</td>
              <td>
                <span className={`badge badge-${c.status === "ACTIVE" ? "active" : "revoked"}`}>
                  {c.status === "ACTIVE" ? "Active" : "Revoked"}
                </span>
              </td>
              <td>
                {c.status === "ACTIVE" && (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={revoking === c.credential_hash}
                    onClick={() => handleRevoke(c.credential_hash, c.student_name)}
                  >
                    {revoking === c.credential_hash ? <span className="spinner" /> : "Revoke"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UniversityPortal() {
  const [university, setUniversity] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cv_uni_info")); } catch { return null; }
  });
  const [tab, setTab] = useState("issue");
  const [issued, setIssued] = useState(0);

  function handleLogout() {
    localStorage.removeItem("cv_uni_token");
    localStorage.removeItem("cv_uni_info");
    setUniversity(null);
    toast("Logged out");
  }

  if (!university) return <LoginStep onLogin={setUniversity} />;

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2>{university.name}</h2>
            <p style={{ fontSize: "0.85rem", fontFamily: "monospace", color: "#6366f1", marginTop: "0.25rem" }}>
              {university.wallet}
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
        </div>

        <div className="tabs" style={{ marginBottom: "2rem" }}>
          <button className={`tab${tab === "issue" ? " active" : ""}`} onClick={() => setTab("issue")}>
            Issue Certificate
          </button>
          <button className={`tab${tab === "issued" ? " active" : ""}`} onClick={() => { setTab("issued"); setIssued((p) => p + 1); }}>
            Issued Certificates
          </button>
        </div>

        {tab === "issue" && (
          <div className="card">
            <h3 style={{ marginBottom: "1.5rem", color: "#f1f5f9" }}>Issue New Certificate</h3>
            <IssueForm university={university} onIssued={() => setIssued((p) => p + 1)} />
          </div>
        )}

        {tab === "issued" && (
          <div className="card">
            <h3 style={{ marginBottom: "1.5rem", color: "#f1f5f9" }}>Certificates Issued by {university.name}</h3>
            <IssuedList refresh={issued} />
          </div>
        )}
      </div>
    </div>
  );
}
