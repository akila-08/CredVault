import express from "express";
import {
    changeVerifierPassword,
    getVerifierProfile,
    listVerifiers,
    loginVerifier,
    registerVerifier,
    removeVerifier,
} from "../controllers/verifierController.js";
import { requireAdmin, requireVerifier } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", loginVerifier);
router.get("/profile", requireVerifier, getVerifierProfile);
router.post("/change-password", requireVerifier, changeVerifierPassword);

router.get("/", requireAdmin, listVerifiers);
router.post("/", requireAdmin, registerVerifier);
router.delete("/:id", requireAdmin, removeVerifier);

export default router;
