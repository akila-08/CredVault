import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { to: "/university", label: "University", icon: "🏛️" },
  { to: "/student",    label: "Student",    icon: "🎓" },
  { to: "/verify",     label: "Verify",     icon: "🔍" },
];

export default function Navbar() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <nav style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      padding: "0 1.5rem",
      height: "70px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: scrolled
        ? "rgba(10,11,20,0.92)"
        : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      transition: "all 0.3s ease",
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{
          width: 34, height: 34, borderRadius: "10px",
          background: "linear-gradient(135deg, #6366f1, #2dd4bf)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1rem", fontWeight: 800, color: "#fff"
        }}>C</div>
        <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "#f1f5f9", letterSpacing: "-0.02em" }}>
          Cred<span style={{ color: "#818cf8" }}>Vault</span>
        </span>
      </Link>

      {/* Desktop links */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }} className="hide-mobile">
        {NAV_LINKS.map(({ to, label, icon }) => (
          <Link key={to} to={to} style={{
            textDecoration: "none",
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: 500,
            color: location.pathname === to ? "#818cf8" : "#94a3b8",
            background: location.pathname === to ? "rgba(99,102,241,0.12)" : "transparent",
            transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: "0.4rem"
          }}>
            <span>{icon}</span> {label}
          </Link>
        ))}
        <Link to="/admin" style={{
          textDecoration: "none",
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          fontSize: "0.9rem",
          fontWeight: 500,
          color: "#475569",
          transition: "all 0.2s",
        }}>⚙️ Admin</Link>
      </div>

      {/* Hamburger (mobile) */}
      <button
        onClick={() => setMenuOpen((p) => !p)}
        style={{ display: "none", background: "none", border: "none", color: "#f1f5f9", fontSize: "1.5rem", cursor: "pointer" }}
        className="show-mobile"
        aria-label="Menu"
      >☰</button>

      {/* Mobile drawer */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 70, left: 0, right: 0,
          background: "rgba(10,11,20,0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "1rem 1.5rem 1.5rem",
          display: "flex", flexDirection: "column", gap: "0.5rem"
        }}>
          {[...NAV_LINKS, { to: "/admin", label: "Admin", icon: "⚙️" }].map(({ to, label, icon }) => (
            <Link key={to} to={to} style={{
              textDecoration: "none",
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              fontSize: "1rem",
              fontWeight: 500,
              color: location.pathname === to ? "#818cf8" : "#94a3b8",
              background: location.pathname === to ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
              display: "flex", alignItems: "center", gap: "0.5rem"
            }}>
              {icon} {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
