import express from "express";
import {
    addUniversity,
    getUniversityHistory,
    removeUniversity,
    listUniversities,
} from "../controllers/universityController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET  /api/universities           — public: list all active universities
router.get("/", listUniversities);

// GET /api/universities/history    — admin only: university access history
router.get("/history", requireAdmin, getUniversityHistory);

// POST /api/universities           — admin only: register a new university
router.post("/", requireAdmin, addUniversity);

// DELETE /api/universities/:address — admin only: deactivate a university
router.delete("/:address", requireAdmin, removeUniversity);

export default router;
