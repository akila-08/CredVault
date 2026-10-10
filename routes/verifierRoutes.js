import express from "express";
import {
    changeVerifierPassword,
    getVerifierProfile,
    getVerifierHistory,
    listVerifiers,
    loginVerifier,
    registerVerifier,
    resendVerifierWelcomeEmail,
    removeVerifier,
} from "../controllers/verifierController.js";
import { requireAdmin, requireVerifier } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", loginVerifier);
router.get("/profile", requireVerifier, getVerifierProfile);
router.post("/change-password", requireVerifier, changeVerifierPassword);

router.get("/", requireAdmin, listVerifiers);
router.get("/history", requireAdmin, getVerifierHistory);
router.post("/", requireAdmin, registerVerifier);
router.post("/:id/resend-welcome-email", requireAdmin, resendVerifierWelcomeEmail);
router.delete("/:id", requireAdmin, removeVerifier);

export default router;