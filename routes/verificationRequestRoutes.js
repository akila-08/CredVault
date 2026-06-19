import express from "express";
import {
    approveVerificationRequest,
    createVerificationRequest,
    getStudentVerificationRequests,
    getVerifierVerificationRequests,
    rejectVerificationRequest,
} from "../controllers/verificationRequestController.js";
import { requireStudent, requireVerifier } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", requireVerifier, createVerificationRequest);
router.get("/student", requireStudent, getStudentVerificationRequests);
router.get("/verifier", requireVerifier, getVerifierVerificationRequests);
router.post("/:id/approve", requireStudent, approveVerificationRequest);
router.post("/:id/reject", requireStudent, rejectVerificationRequest);

export default router;
