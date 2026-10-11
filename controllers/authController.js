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
import { createPublicKey } from "crypto";

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
            .from("issuer_registry1")
            .select("id, name, wallet_address, status")
            .eq("wallet_address", address.toLowerCase())
            .eq("status", "approved")
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

export async function getIssuerRsaKey(req, res) {
    try {
        const { data, error } = await supabase.from("issuer_registry1")
            .select("rsa_public_key").eq("wallet_address", req.university.wallet.toLowerCase()).single();
        if (error) throw error;
        res.json({ success: true, publicKey: data.rsa_public_key || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function registerIssuerRsaKey(req, res) {
    try {
        const publicKey = String(req.body.publicKey || "");
        const key = createPublicKey(publicKey);
        if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
            return res.status(400).json({ success: false, message: "RSA public key must be at least 2048 bits" });
        }
        const wallet = req.university.wallet.toLowerCase();
        const { data, error: readError } = await supabase.from("issuer_registry1")
            .select("rsa_public_key").eq("wallet_address", wallet).single();
        if (readError) throw readError;
        if (data.rsa_public_key && data.rsa_public_key !== publicKey) {
            return res.status(409).json({ success: false, message: "An RSA key is already registered for this university" });
        }
        if (!data.rsa_public_key) {
            const { error } = await supabase.from("issuer_registry1").update({ rsa_public_key: publicKey }).eq("wallet_address", wallet);
            if (error) throw error;
        }
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}



// Add this exported function alongside your existing auth controllers.
export async function rotateIssuerRsaKey(req, res) {
  try {
    const wallet = String(req.university?.wallet || "").toLowerCase();
    const publicKey = String(req.body.publicKey || "");

    if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
      return res.status(401).json({
        success: false,
        message: "University authentication required.",
      });
    }

    let key;

    try {
      key = createPublicKey(publicKey);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid RSA public key.",
      });
    }

    if (
      key.asymmetricKeyType !== "rsa" ||
      (key.asymmetricKeyDetails?.modulusLength || 0) < 2048
    ) {
      return res.status(400).json({
        success: false,
        message: "An RSA key of at least 2048 bits is required.",
      });
    }

    const { error } = await supabase.rpc("rotate_issuer_rsa_key", {
      p_wallet_address: wallet,
      p_new_public_key: publicKey,
      p_rotation_reason: "University-authorized RSA key rotation",
    });

    if (error) {
      console.error("RSA key rotation database error:", error.message);

      return res.status(400).json({
        success: false,
        message: "RSA key rotation failed. Please check the server logs.",
      });
    }

    return res.json({
      success: true,
      message: "RSA key rotated; previous public key preserved.",
    });
  } catch (err) {
    console.error("RSA key rotation failed:", err.message);

    return res.status(500).json({
      success: false,
      message: "Could not rotate the RSA key.",
    });
  }
}
