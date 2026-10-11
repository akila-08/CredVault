
import express from "express";
import {
  getNonce,
  login,
  getIssuerRsaKey,
  registerIssuerRsaKey,
  rotateIssuerRsaKey,
} from "../controllers/authController.js";
import { requireUniversity } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/nonce/:address", getNonce);
router.post("/login", login);

router.get("/rsa-key", requireUniversity, getIssuerRsaKey);
router.put("/rsa-key", requireUniversity, registerIssuerRsaKey);

// Explicit key replacement, restricted to an authorized admin.
// router.put("/rsa-key/rotate", requireAdmin, rotateIssuerRsaKey);

router.put(
  "/rsa-key/rotate",
  requireUniversity,
  rotateIssuerRsaKey
);

export default router;
