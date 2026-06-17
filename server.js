import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";


dotenv.config();

import credentialRoutes from "./routes/credentialRoutes.js";
import universityRoutes from "./routes/universityRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import verifierRoutes from "./routes/verifierRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";


console.log("SMTP:", {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS ? "loaded" : "missing"
});


const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
        "https://cred-vault-eight.vercel.app"
    ],
    credentials: true
  })
);
app.use(express.json());

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);         // SIWE login
app.use("/api/admin",         adminRoutes);        // admin key checks
app.use("/api/universities",  universityRoutes);   // list / add / remove universities
app.use("/api/verifiers",     verifierRoutes);     // verifier accounts / login
app.use("/api/credentials",   credentialRoutes);   // issue / verify / revoke / mine

app.get("/", (req, res) => {
    res.json({
        name: "CredVault API",
        version: "2.0.0",
        endpoints: {
            auth:         "/api/auth",
            admin:        "/api/admin",
            universities: "/api/universities",
            verifiers:    "/api/verifiers",
            credentials:  "/api/credentials",
        },
    });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(process.env.PORT, () => {
    console.log(`CredVault API running on port ${process.env.PORT}`);
});
