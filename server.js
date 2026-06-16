import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";

import credentialRoutes from "./routes/credentialRoutes.js";
import universityRoutes from "./routes/universityRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.FRONTEND_URL
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
app.use("/api/universities",  universityRoutes);   // list / add / remove universities
app.use("/api/credentials",   credentialRoutes);   // issue / verify / revoke / mine

app.get("/", (req, res) => {
    res.json({
        name: "CredVault API",
        version: "2.0.0",
        endpoints: {
            auth:         "/api/auth",
            universities: "/api/universities",
            credentials:  "/api/credentials",
        },
    });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(process.env.PORT, () => {
    console.log(`CredVault API running on port ${process.env.PORT}`);
});