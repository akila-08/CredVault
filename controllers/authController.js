import {
    generateNonce,
    storeNonce,
    verifyNonce,
    deleteNonce,
    verifySiweMessage,
} from "../utils/siwe.js";
import { isAuthorizedUniversity } from "../services/blockchainService.js";
import supabase from "../services/supabaseService.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// GET /api/auth/nonce/:address
// Returns a random nonce for the wallet to sign
export async function getNonce(req, res) {
    try {
        const { address } = req.params;

        if (!address || !address.startsWith("0x")) {
            return res.status(400).json({ success: false, message: "Valid wallet address required" });
        }

        const nonce = generateNonce();
        await storeNonce(address, nonce);

        res.json({ success: true, nonce });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/auth/login
// Verifies SIWE signature, checks on-chain authorization, returns JWT
export async function login(req, res) {
    try {
        const { message, signature, address } = req.body;

        if (!message || !signature || !address) {
            return res.status(400).json({ success: false, message: "message, signature, and address are required" });
        }

        // 1. Verify the SIWE message + signature
        const siweData = await verifySiweMessage(message, signature);

        // 2. Ensure address in message matches claimed address
        if (siweData.address.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ success: false, message: "Address mismatch" });
        }

        // 3. Check nonce is valid and not expired
        const expectedNonce = await verifyNonce(address);
        if (!expectedNonce || expectedNonce !== siweData.nonce) {
            return res.status(401).json({ success: false, message: "Invalid or expired nonce" });
        }

        // 4. Check university is authorized on-chain
        const isAuthorized = await isAuthorizedUniversity(address);
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: "This wallet is not a registered university on-chain",
            });
        }

        // 5. Get university details from Supabase
        const { data: uni, error } = await supabase
            .from("universities")
            .select("id, name, wallet_address, is_active")
            .eq("wallet_address", address.toLowerCase())
            .eq("is_active", true)
            .single();

        if (error || !uni) {
            return res.status(403).json({
                success: false,
                message: "University not found in registry. Ask admin to register it.",
            });
        }

        // 6. Consume the nonce (one-time use)
        await deleteNonce(address);

        // 7. Issue JWT (valid 24h — no re-signing needed for all cert issuances)
        const token = jwt.sign(
            {
                role: "university",
                wallet: address.toLowerCase(),
                name: uni.name,
                universityId: uni.id,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({
            success: true,
            token,
            university: {
                id: uni.id,
                name: uni.name,
                wallet: address,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}
