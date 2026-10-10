import express from "express";
import { getNonce, login, getIssuerRsaKey, registerIssuerRsaKey } from "../controllers/authController.js";
import { requireUniversity } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET  /api/auth/nonce/:address  — get a one-time nonce to sign
router.get("/nonce/:address", getNonce);

// POST /api/auth/login           — submit signed SIWE message, get JWT
router.post("/login", login);
router.get("/rsa-key", requireUniversity, getIssuerRsaKey);
router.put("/rsa-key", requireUniversity, registerIssuerRsaKey);

export default router;
