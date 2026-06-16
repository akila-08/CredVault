import express from "express";
import upload from "../middleware/upload.js";
import {
    issue,
    verify,
    revoke,
    getUniversityCredentials,
    getMyCredentials,
} from "../controllers/credentialController.js";
import { requireUniversity } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/credentials/issue      — university only: issue a new certificate
router.post("/issue", requireUniversity, upload.single("certificate"), issue);

// POST /api/credentials/verify     — public: upload PDF + metadata → verify on-chain
router.post("/verify", upload.single("certificate"), verify);

// POST /api/credentials/revoke     — university only: revoke a certificate
router.post("/revoke", requireUniversity, revoke);

// GET  /api/credentials/university — university only: list all credentials they issued
router.get("/university", requireUniversity, getUniversityCredentials);

// GET  /api/credentials/mine?student_wallet=0x...  — student: view own credentials
router.get("/mine", getMyCredentials);

export default router;