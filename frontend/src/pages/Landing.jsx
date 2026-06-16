import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div style={{ overflowX: "hidden" }}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {/* Glow blobs */}
        <div className="glow-purple" style={{ top: "10%", left: "-5%" }} />
        <div className="glow-teal"   style={{ bottom: "20%", right: "-5%" }} />

        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            {/* Badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: "9999px", padding: "0.4rem 1rem",
              fontSize: "0.8rem", color: "#818cf8", fontWeight: 600,
              marginBottom: "1.5rem"
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
              Powered by Polygon Blockchain
            </div>

            <h1 className="fade-up" style={{ marginBottom: "1.25rem" }}>
              Certificate Verification{" "}
              <span className="gradient-text">on the Blockchain</span>
            </h1>

            <p style={{ fontSize: "1.15rem", marginBottom: "2.5rem", color: "#94a3b8", lineHeight: 1.7 }}>
              CredVault makes academic certificates tamper-proof, instantly verifiable, 
              and universally trusted — no calls, no paperwork, just cryptographic proof.
            </p>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/university" className="btn btn-primary" style={{ fontSize: "1rem" }}>
                🏛️ University Portal
              </Link>
              <Link to="/verify" className="btn btn-outline" style={{ fontSize: "1rem" }}>
                🔍 Verify a Certificate
              </Link>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "2rem", justifyContent: "center", marginTop: "4rem", flexWrap: "wrap" }}>
              {[
                { label: "Tamper-Proof", value: "100%", icon: "🔒" },
                { label: "Verification Time", value: "<2s", icon: "⚡" },
                { label: "Cost to Verify", value: "Free", icon: "✅" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>{s.icon}</div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f1f5f9" }}>{s.value}</div>
                  <div style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Role Cards ───────────────────────────────────────── */}
      <section className="section" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <h2>Choose Your Portal</h2>
            <p style={{ marginTop: "0.75rem" }}>Each role has a dedicated, purpose-built interface</p>
          </div>

          <div className="grid-3">
            {[
              {
                to: "/university",
                icon: "🏛️",
                title: "University",
                desc: "Issue tamper-proof certificates and revoke them if needed. Connect your wallet once and issue in bulk.",
                accent: "#6366f1",
                cta: "Open University Portal",
              },
              {
                to: "/student",
                icon: "🎓",
                title: "Student",
                desc: "View all certificates issued to your wallet. Download them or share a verification link with employers.",
                accent: "#2dd4bf",
                cta: "Open Student Portal",
              },
              {
                to: "/verify",
                icon: "🔍",
                title: "Verifier",
                desc: "Upload any certificate PDF and instantly check if it's authentic on the blockchain. No login required.",
                accent: "#f59e0b",
                cta: "Verify a Certificate",
              },
            ].map((card) => (
              <div key={card.to} className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "14px",
                  background: `${card.accent}1a`,
                  border: `1px solid ${card.accent}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem"
                }}>{card.icon}</div>
                <h3 style={{ color: "#f1f5f9" }}>{card.title}</h3>
                <p style={{ fontSize: "0.9rem", flex: 1 }}>{card.desc}</p>
                <Link to={card.to} className="btn btn-outline btn-sm" style={{ marginTop: "auto" }}>
                  {card.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <h2>How It Works</h2>
            <p style={{ marginTop: "0.75rem" }}>Three steps, fully trustless</p>
          </div>

          <div className="grid-3">
            {[
              { step: "01", title: "University Issues",  desc: "The university uploads the PDF + student details. Both are hashed together and stored on Polygon." },
              { step: "02", title: "Student Receives",   desc: "The certificate hash is linked to the student's wallet. They can view and share it anytime." },
              { step: "03", title: "Employer Verifies",  desc: "Upload the original PDF and fill in the details. The hash is recomputed and checked on-chain instantly." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
                <div style={{
                  minWidth: 48, height: 48, borderRadius: "12px",
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "0.85rem", color: "#818cf8"
                }}>{item.step}</div>
                <div>
                  <h3 style={{ marginBottom: "0.5rem", color: "#f1f5f9" }}>{item.title}</h3>
                  <p style={{ fontSize: "0.9rem" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "2rem 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.85rem", color: "#475569" }}>
          CredVault — Built on Polygon · Powered by cryptographic proof
        </p>
      </footer>
    </div>
  );
}
