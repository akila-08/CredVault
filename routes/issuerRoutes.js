import express from "express";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { listValidators, listProposals, listIssuers, syncVotingTransaction } from "../controllers/issuerController.js";

const router = express.Router();
router.get("/validators", listValidators);
router.get("/proposals", listProposals);
router.get("/", listIssuers);
router.post("/sync", requireAdmin, syncVotingTransaction);
export default router;
