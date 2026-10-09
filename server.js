
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";

import credentialRoutes from "./routes/credentialRoutes.js";
import universityRoutes from "./routes/universityRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import verifierRoutes from "./routes/verifierRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import verificationRequestRoutes from "./routes/verificationRequestRoutes.js";

dotenv.config();

// Debug environment variables without exposing secrets
console.log("SMTP_HOST configured:", Boolean(process.env.SMTP_HOST));
console.log("SMTP_USER configured:", Boolean(process.env.SMTP_USER));
console.log("SMTP_PASS configured:", Boolean(process.env.SMTP_PASS));

const app = express();

// Allowed frontend origins
const allowedOrigins = [
    "http://localhost:5173",
    "https://cred-vault-blockchain.vercel.app",
];

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests without an Origin header, such as server-to-server requests
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.error("Blocked CORS origin:", origin);
        return callback(new Error("Origin not allowed by CORS"));
    },

    credentials: true,

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],

    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Admin-Key",
    ],

    optionsSuccessStatus: 204,
};

// Register CORS before API routes
app.use(cors(corsOptions));

// Explicitly handle preflight requests
app.options(/.*/, cors(corsOptions));

// Parse JSON request bodies
app.use(express.json());

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads", { recursive: true });
}

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/universities", universityRoutes);
app.use("/api/verifiers", verifierRoutes);
app.use("/api/credentials", credentialRoutes);
app.use("/api/verification-requests", verificationRequestRoutes);

// API health check
app.get("/", (req, res) => {
    res.status(200).json({
        name: "CredVault API",
        version: "2.0.0",
        status: "running",
        endpoints: {
            auth: "/api/auth",
            admin: "/api/admin",
            universities: "/api/universities",
            verifiers: "/api/verifiers",
            credentials: "/api/credentials",
            verificationRequests: "/api/verification-requests",
        },
    });
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found",
        path: req.originalUrl,
    });
});

// Centralized error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    if (err.message === "Origin not allowed by CORS") {
        return res.status(403).json({
            success: false,
            message: "Origin not allowed by CORS",
        });
    }

    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`CredVault API running on port ${PORT}`);
});
