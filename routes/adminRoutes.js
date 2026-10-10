import express from "express";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { getDashboard, benchmarkSearch, getBloomDashboard } from "../controllers/performanceController.js";

const router = express.Router();

router.get("/verify-key", requireAdmin, (req, res) => {
    res.json({ success: true });
});
router.get("/performance", requireAdmin, getDashboard);
router.get("/performance/bloom", requireAdmin, getBloomDashboard);
router.post("/performance/search-benchmark", requireAdmin, benchmarkSearch);

export default router;
