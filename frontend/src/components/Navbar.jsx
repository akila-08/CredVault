import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";

const NAV_LINKS = [
  { to: "/university", label: "University", icon: "🏛️" },
  { to: "/student", label: "Student", icon: "🎓" },
  { to: "/verify", label: "Verify", icon: "🔍" },
];

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const navButtonStyle = (active) => ({
    textDecoration: "none",
    padding: "0.75rem 1.45rem",
    borderRadius: "14px",
    fontSize: "1rem",
    fontWeight: 700,

    color: active ? "#ffffff" : "#e2eeff",

    background: active
      ? "linear-gradient(135deg, #1d4ed8, #3b82f6)"
      : "rgba(15, 40, 90, 0.72)",

    border: active
      ? "1px solid #60a5fa"
      : "1px solid rgba(96, 165, 250, 0.35)",

    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",

    boxShadow: active
      ? "0 6px 20px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.15)"
      : "0 2px 10px rgba(0,0,0,0.25)",

    transition: "all 0.2s ease",

    display: "flex",
    alignItems: "center",
    gap: "0.45rem",
  });

  return (
    <nav
      style={{
        position: "fixed",
        top: 10,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "0 2.5rem",
        height: "80px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "transparent",
      }}
    >
      {/* Logo */}
      <Link
        to="/"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
        }}
      >
        <img
          src={logo}
          alt="CredVault Logo"
          style={{
            marginTop: "40px",
            height: "180px",
            objectFit: "contain",
            filter: "drop-shadow(0 2px 8px rgba(59,130,246,0.5))",
          }}
        />
      </Link>

      {/* Desktop Links */}
      <div
        className="hide-mobile"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
        }}
      >
        {NAV_LINKS.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className="nav-btn"
            style={navButtonStyle(location.pathname === to)}
          >
            <span>{icon}</span>
            {label}
          </Link>
        ))}

        <Link
          to="/admin"
          className="nav-btn"
          style={navButtonStyle(location.pathname === "/admin")}
        >
          <span>⚙️</span>
          Admin
        </Link>
      </div>

      {/* Hamburger */}
      <button
        onClick={() => setMenuOpen((p) => !p)}
        className="show-mobile"
        aria-label="Menu"
        style={{
          display: "none",
          background: "none",
          border: "none",
          color: "#1e293b",
          fontSize: "1.5rem",
          cursor: "pointer",
        }}
      >
        ☰
      </button>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 80,
            left: 0,
            right: 0,
            background: "rgba(0, 47, 94, 0.96)",
            backdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(15,23,42,0.08)",
            padding: "1rem 1.5rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          {[...NAV_LINKS, { to: "/admin", label: "Admin", icon: "⚙️" }].map(
            ({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                style={{
                  textDecoration: "none",
                  padding: "0.8rem 1rem",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color:
                    location.pathname === to ? "#2563eb" : "#1e293b",
                  background:
                    location.pathname === to
                      ? "rgba(37,99,235,0.12)"
                      : "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(37,99,235,0.12)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {icon} {label}
              </Link>
            )
          )}
        </div>
      )}
    </nav>
  );
}