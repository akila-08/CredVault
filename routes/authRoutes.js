import express from "express";
import { getNonce, login } from "../controllers/authController.js";

const router = express.Router();

// GET  /api/auth/nonce/:address  — get a one-time nonce to sign
router.get("/nonce/:address", getNonce);

// POST /api/auth/login           — submit signed SIWE message, get JWT
router.post("/login", login);

export default router;
