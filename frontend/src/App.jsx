import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import UniversityPortal from "./pages/UniversityPortal";
import StudentPortal from "./pages/StudentPortal";
import VerifyPortal from "./pages/VerifyPortal";
import AdminPanel from "./pages/AdminPanel";

export default function App() {
  return (
    <BrowserRouter>
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
