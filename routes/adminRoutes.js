import express from "express";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/verify-key", requireAdmin, (req, res) => {
    res.json({ success: true });
});

export default router;
