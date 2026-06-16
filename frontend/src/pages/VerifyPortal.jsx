import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import API from "../api/client";

export default function VerifyPortal() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [ownerStatus, setOwnerStatus] = useState(null); // null | "verifying" | "verified" | "declined" | "mismatch"
  const [ownerAddr, setOwnerAddr] = useState(null);

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) { setFile(accepted[0]); setResult(null); }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [".pdf"] }, maxFiles: 1,
  });

  async function handleVerify(e) {
    e.preventDefault();
    if (!file) { toast.error("Upload the certificate PDF"); return; }
    setLoading(true);
    setResult(null);
    setOwnerStatus(null);
    setOwnerAddr(null);
    try {
      const fd = new FormData();
      fd.append("certificate", file);
      const { data } = await API.post("/api/credentials/verify", fd);
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOwner() {
    if (!window.ethereum) {
      toast.error("MetaMask not detected. The student needs MetaMask installed.");
      return;
    }
    setOwnerStatus("verifying");
    try {
      const expectedWallet = result?.onChain?.studentWallet?.toLowerCase();
      if (!expectedWallet) throw new Error("No student wallet found in on-chain record");

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const signerAddress = (await signer.getAddress()).toLowerCase();

      // Challenge message — unique per certificate
      const challenge = [
        "CredVault Ownership Verification",
        `Certificate: ${result.credentialHash}`,
        "By signing, you confirm you are the rightful owner of this certificate.",
      ].join("\n");

      const signature = await signer.signMessage(challenge);

      // Recover address from signature and compare to on-chain wallet
      const recovered = ethers.verifyMessage(challenge, signature).toLowerCase();
      setOwnerAddr(recovered);

      if (recovered === expectedWallet) {
        setOwnerStatus("verified");
      } else {
        // Signed by a different wallet than the certificate owner
        setOwnerStatus("mismatch");
      }
    } catch (err) {
      // User cancelled MetaMask or another error
      if (err.code === 4001 || err.message?.includes("rejected") || err.message?.includes("denied")) {
        setOwnerStatus("declined");
      } else {
        toast.error(err.message);
        setOwnerStatus(null);
      }
    }
  }

  const statusConfig = {
    VALID:   { icon: "✅", label: "Verified — Authentic Certificate", cls: "alert-success", color: "#22c55e" },
    REVOKED: { icon: "⚠️", label: "Revoked — Certificate was revoked by the university", cls: "alert-warning", color: "#f59e0b" },
    INVALID: { icon: "❌", label: "Invalid — Not found on blockchain (may be forged)", cls: "alert-error", color: "#f43f5e" },
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680, paddingTop: "2rem", paddingBottom: "4rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</div>
          <h2>Verify a Certificate</h2>
          <p style={{ marginTop: "0.5rem", maxWidth: 480, margin: "0.5rem auto 0" }}>
            Upload the original certificate PDF. No other details needed —
            the system verifies authenticity directly on the blockchain.
          </p>
        </div>

        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`dropzone${isDragActive ? " active" : ""}`}
            style={{ textAlign: "center", padding: "3rem 2rem" }}
          >
            <input {...getInputProps()} />
            <div className="dropzone-icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>
              {file ? "📄" : "⬆️"}
            </div>
            {file ? (
              <>
                <p style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "1rem" }}>{file.name}</p>
                <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.3rem" }}>
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                  style={{ marginTop: "0.75rem", background: "none", border: "none", color: "#f43f5e", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  ✕ Remove
                </button>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 500 }}>Drag &amp; drop the certificate PDF here</p>
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
            {loading ? <><span className="spinner" /> Verifying on-chain…</> : "🔗 Verify on Blockchain"}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div style={{ marginTop: "2rem", animation: "fadeUp 0.4s ease" }}>
            {(() => {
              const cfg = statusConfig[result.status] || statusConfig.INVALID;
              return (
                <>
                  <div className={`alert ${cfg.cls}`} style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                    {cfg.icon} {cfg.label}
                  </div>

                  {result.status !== "INVALID" && result.onChain && (
                    <div className="card">
                      <h3 style={{ color: "#f1f5f9", marginBottom: "1.25rem" }}>On-chain Record</h3>
                      <div className="grid-2">
                        {[
                          { label: "Status",             value: result.status },
                          { label: "Issuing University", value: result.onChain.issuingUniversity || result.onChain.issuedBy },
                          { label: "Issued At",          value: result.onChain.issuedAt ? new Date(result.onChain.issuedAt).toLocaleString() : "—" },
                          { label: "Student Wallet",     value: result.onChain.studentWallet, mono: true },
                        ].map(({ label, value, mono }) => (
                          <div key={label}>
                            <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{label}</p>
                            <p style={{ fontSize: "0.875rem", color: "#f1f5f9", fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Off-chain metadata if available */}
                      {result.metadata && (
                        <>
                          <hr className="divider" />
                          <h4 style={{ color: "#94a3b8", marginBottom: "1rem", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Certificate Details</h4>
                          <div className="grid-2">
                            {[
                              { label: "Student",       value: result.metadata.student_name },
                              { label: "Register No.",  value: result.metadata.register_number },
                              { label: "Degree",        value: result.metadata.degree },
                              { label: "Branch",        value: result.metadata.branch },
                              { label: "Issue Date",    value: result.metadata.issue_date },
                              { label: "Institution",   value: result.metadata.institution },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <p style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{label}</p>
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

                      {/* ── Owner Verification (optional) ── */}
                      {result.status === "VALID" && (
                        <>
                          <hr className="divider" />
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                            <div>
                              <p style={{ fontWeight: 600, color: "#f1f5f9", marginBottom: "0.2rem" }}>🔑 Owner Verification</p>
                              <p style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                Ask the student to sign with their MetaMask to confirm ownership
                              </p>
                            </div>

                            {ownerStatus === null && (
                              <button
                                className="btn btn-sm"
                                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", whiteSpace: "nowrap" }}
                                onClick={verifyOwner}
                              >
                                🦊 Verify Owner
                              </button>
                            )}

                            {ownerStatus === "verifying" && (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#818cf8", fontSize: "0.875rem" }}>
                                <span className="spinner" /> Waiting for signature…
                              </div>
                            )}
                          </div>

                          {/* Result states */}
                          {ownerStatus === "verified" && (
                            <div style={{ marginTop: "0.75rem", padding: "0.875rem 1rem", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <span style={{ fontSize: "1.2rem" }}>✅</span>
                              <div>
                                <p style={{ fontWeight: 600, color: "#22c55e", fontSize: "0.9rem" }}>Ownership Verified</p>
                                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.1rem" }}>
                                  Wallet <span className="mono">{ownerAddr}</span> confirmed ownership.
                                </p>
                              </div>
                            </div>
                          )}

                          {ownerStatus === "declined" && (
                            <div style={{ marginTop: "0.75rem", padding: "0.875rem 1rem", borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <span style={{ fontSize: "1.2rem" }}>❌</span>
                              <div>
                                <p style={{ fontWeight: 600, color: "#f43f5e", fontSize: "0.9rem" }}>Declined</p>
                                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.1rem" }}>
                                  The student cancelled the signature request.
                                </p>
                              </div>
                              <button
                                className="btn btn-sm"
                                style={{ marginLeft: "auto", background: "none", border: "1px solid rgba(244,63,94,0.3)", color: "#f43f5e", fontSize: "0.75rem" }}
                                onClick={() => { setOwnerStatus(null); setOwnerAddr(null); }}
                              >
                                Retry
                              </button>
                            </div>
                          )}

                          {ownerStatus === "mismatch" && (
                            <div style={{ marginTop: "0.75rem", padding: "0.875rem 1rem", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                              <div>
                                <p style={{ fontWeight: 600, color: "#f59e0b", fontSize: "0.9rem" }}>Wrong Wallet</p>
                                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.1rem" }}>
                                  Signed by <span className="mono">{ownerAddr}</span> — does not match the certificate owner{" "}
                                  <span className="mono">{result.onChain.studentWallet}</span>.
                                </p>
                              </div>
                              <button
                                className="btn btn-sm"
                                style={{ marginLeft: "auto", background: "none", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: "0.75rem" }}
                                onClick={() => { setOwnerStatus(null); setOwnerAddr(null); }}
                              >
                                Retry
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
