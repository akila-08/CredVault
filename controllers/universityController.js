import supabase from "../services/supabaseService.js";
import {
    addUniversity as addUniOnChain,
    removeUniversity as removeUniOnChain,
} from "../services/blockchainService.js";

// POST /api/admin/universities  (admin only)
export async function addUniversity(req, res) {
    try {
        const { name, wallet_address, contact_email } = req.body;

        if (!name || !wallet_address) {
            return res.status(400).json({
                success: false,
                message: "name and wallet_address are required",
            });
        }

        const normalizedWallet = wallet_address.toLowerCase();

        const { data: existingUniversity, error: findError } = await supabase
            .from("universities")
            .select("id, is_active")
            .eq("wallet_address", normalizedWallet)
            .maybeSingle();

        if (findError) throw findError;

        if (existingUniversity?.is_active) {
            return res.status(409).json({
                success: false,
                message: "A university with this wallet address already exists",
            });
        }

        // Register on-chain first
        const txHash = await addUniOnChain(normalizedWallet);

        if (existingUniversity) {
            const { data, error } = await supabase
                .from("universities")
                .update({
                    name,
                    contact_email: contact_email || null,
                    is_active: true,
                })
                .eq("id", existingUniversity.id)
                .select()
                .single();

            if (error) throw error;

            return res.status(200).json({ success: true, university: data, txHash });
        }

        // Then persist to Supabase
        const { data, error } = await supabase
            .from("universities")
            .insert({
                name,
                wallet_address: normalizedWallet,
                contact_email: contact_email || null,
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, university: data, txHash });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

// DELETE /api/admin/universities/:address  (admin only)
export async function removeUniversity(req, res) {
    try {
        const { address } = req.params;
        const normalizedWallet = address.toLowerCase();

        // Remove on-chain first
        const txHash = await removeUniOnChain(address);

        // Mark inactive in Supabase
        const { error } = await supabase
            .from("universities")
            .update({ is_active: false })
            .eq("wallet_address", normalizedWallet);

        if (error) throw error;

        res.json({ success: true, txHash });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/universities  (public)
export async function listUniversities(req, res) {
    try {
        const { data, error } = await supabase
            .from("universities")
            .select("id, name, wallet_address, contact_email, created_at")
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({ success: true, universities: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}
