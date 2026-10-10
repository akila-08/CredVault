import supabase from "../services/supabaseService.js";
import { listAccessHistory } from "../services/accessHistoryService.js";

// POST /api/admin/universities  (admin only)
export async function addUniversity(req, res) {
    return res.status(410).json({ success: false, message: "University management moved to issuer voting. Use /api/issuers." });
}

// DELETE /api/admin/universities/:address  (admin only)
export async function removeUniversity(req, res) {
    return res.status(410).json({ success: false, message: "University management moved to issuer voting. Use /api/issuers." });
}

// GET /api/universities/history  (admin only)
export async function getUniversityHistory(req, res) {
    try {
        const { data, error } = await listAccessHistory("university");

        if (error) throw error;

        res.json({ success: true, history: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/universities  (public)
export async function listUniversities(req, res) {
    try {
        const { data, error } = await supabase
            .from("issuer_registry1")
            .select("id, name, wallet_address, contact_email, created_at, status")
            .eq("status", "approved")
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({ success: true, universities: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}
