import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div style={{ overflowX: "hidden" }}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          paddingTop: "110px",
        }}
      >
        <div className="glow-purple" style={{ top: "10%", left: "-5%" }} />
        <div className="glow-teal" style={{ bottom: "20%", right: "-5%" }} />

        {/* HERO: full-width, left-aligned, no auto margin centering */}
        <div style={{ width: "100%", paddingLeft: "4rem", paddingRight: "2rem", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: "640px" }}>
            {/* Badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(30,58,138,0.1)",
              border: "1px solid rgba(30,58,138,0.25)",
              borderRadius: "9999px",
              padding: "0.4rem 1rem",
              fontSize: "0.8rem",
              color: "#1e3a8a",
              fontWeight: 700,
              marginBottom: "1.5rem",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
              Powered by Polygon Blockchain
            </div>

            <h1
              className="fade-up"
              style={{ marginBottom: "1.25rem", color: "#0c1445", lineHeight: 1.1 }}
            >
              Certificate Verification{" "}
              <span className="gradient-text">on the Blockchain</span>
            </h1>

            <p style={{
              fontSize: "1.15rem",
              marginBottom: "2.5rem",
              color: "#1e293b",
              lineHeight: 1.7,
              fontWeight: 500,
            }}>
              CredVault makes academic certificates tamper-proof,
              instantly verifiable, and universally trusted —
              no calls, no paperwork, just cryptographic proof.
            </p>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link to="/university" className="btn btn-primary" style={{ fontSize: "1rem" }}>
                🏛️ University Portal
              </Link>
              <Link to="/verify" className="btn btn-outline" style={{ fontSize: "1rem", color: "#1e3a8a", borderColor: "rgba(30,58,138,0.4)" }}>
                🔍 Verify a Certificate
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Role Cards ───────────────────────────────────────── */}
      <section className="section" style={{ background: "rgba(255,255,255,0.2)" }}>
        <div style={{ paddingLeft: "4rem", paddingRight: "2rem" }}>
          <div style={{ textAlign: "left", marginBottom: "3.5rem" }}>
            <h2 style={{ color: "#0c1445" }}>Choose Your Portal</h2>
            <p style={{ marginTop: "0.75rem", color: "#1e293b", fontWeight: 500 }}>
              Each role has a dedicated, purpose-built interface
            </p>
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
                desc: "View all certificates issued to your wallet. Approve requests from verifiers to prove your ownership.",
                accent: "#2dd4bf",
                cta: "Open Student Portal",
              },
              {
                to: "/verify",
                icon: "🔍",
                title: "Verifier",
                desc: "Upload any certificate PDF and instantly check it's authenticity and ownership on the blockchain.",
                accent: "#f59e0b",
                cta: "Verify a Certificate",
              },
            ].map((card) => (
              <div key={card.to} className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "rgba(255,255,255,0.55)", borderColor: "rgba(15,23,42,0.1)" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "14px",
                  background: `${card.accent}22`,
                  border: `1px solid ${card.accent}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem"
                }}>{card.icon}</div>
                <h3 style={{ color: "#0c1445" }}>{card.title}</h3>
                <p style={{ fontSize: "0.9rem", flex: 1, color: "#1e293b" }}>{card.desc}</p>
                <Link to={card.to} className="btn btn-outline btn-sm" style={{ marginTop: "auto", color: "#1e3a8a", borderColor: "rgba(30,58,138,0.35)" }}>
                  {card.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer
        style={{
          padding: "2rem 1.5rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "0.85rem",
            color: "#334155",
            fontWeight: 500,
            textAlign: "left"
          }}
        >
          CredVault — Built on Polygon · Powered by cryptographic proof
        </p>
      </footer>
    </div>
  );
}
