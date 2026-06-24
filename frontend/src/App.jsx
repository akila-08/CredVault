import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import UniversityPortal from "./pages/UniversityPortal";
import StudentPortal from "./pages/StudentPortal";
import VerifyPortal from "./pages/VerifyPortal";
import AdminPanel from "./pages/AdminPanel";
import universityBg from "./assets/university.png";
import studentBg from "./assets/student.png";
import verifierBg from "./assets/verifier.png";
import adminBg from "./assets/admin.png";

// Checks if any session is currently active
function isLoggedIn(pathname) {
  if (pathname === "/university") {
    return !!localStorage.getItem("cv_uni_token");
  }
  if (pathname === "/student") {
    // Supabase session is async; use a best-effort localStorage check
    return !!localStorage.getItem("loginExpiry") &&
      Date.now() < Number(localStorage.getItem("loginExpiry"));
  }
  return false;
}

function BackgroundManager() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;

    if (pathname === "/") {
      // Landing page — always use the scenic bg
      document.body.className = "bg-landing";
    } else if (isLoggedIn(pathname)) {
      // User is logged into a portal — plain bg
      document.body.className = "bg-portal";
    } else {
      // Portal login screen — still scenic bg
      document.body.className = "bg-landing";
    }
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Preload all portal backgrounds so navigation never flashes */}
      <div style={{ display: "none" }} aria-hidden="true">
        <img src={universityBg} alt="" />
        <img src={studentBg} alt="" />
        <img src={verifierBg} alt="" />
        <img src={adminBg} alt="" />
      </div>
      <BackgroundManager />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e2035",
            color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
          },
        }}
      />
      <Navbar />
      <Routes>
        <Route path="/"           element={<Landing />} />
        <Route path="/university" element={<UniversityPortal />} />
        <Route path="/student"    element={<StudentPortal />} />
        <Route path="/verify"     element={<VerifyPortal />} />
        <Route path="/admin"      element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
