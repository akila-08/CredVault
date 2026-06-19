import { hashFile } from "../utils/hashFile.js";
import {
    issueCredential,
    credentialExists,
    verifyCredential as verifyOnChain,
    revokeCredential as revokeOnChain,
} from "../services/blockchainService.js";
import supabase from "../services/supabaseService.js";
import fs from "fs";

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

// POST /api/credentials/issue (requireUniversity)
export async function issue(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Certificate PDF required" });
        }

        const { student_name, register_number, degree, branch, issue_date } = req.body;
        const student_email = normalizeEmail(req.body.student_email);
        const student_wallet = String(req.body.student_wallet || "").trim().toLowerCase();
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const { name: institution, wallet: universityWallet } = req.university;

        if (!student_email) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ success: false, message: "student_email is required" });
        }

        if (!student_wallet) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ success: false, message: "student_wallet is required" });
        }

        const documentHash = hashFile(req.file.path);

        const { error: uploadError } = await supabase.storage
            .from("certificates")
            .upload(fileName, fs.readFileSync(req.file.path), {
                contentType: "application/pdf",
                upsert: false,
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from("certificates")
            .getPublicUrl(fileName);

        const certificateUrl = publicUrlData.publicUrl;

        const exists = await credentialExists(documentHash);
        if (exists) {
            fs.unlink(req.file.path, () => {});
            return res.status(409).json({ success: false, message: "This certificate PDF already exists on-chain" });
        }

        const txHash = await issueCredential(documentHash, student_wallet);

        const { error } = await supabase.from("credentials").insert({
            document_hash: documentHash,
            credential_hash: documentHash,
            student_name,
            student_email,
            register_number,
            degree,
            branch,
            institution,
            university_wallet: universityWallet.toLowerCase(),
            issue_date,
            student_wallet,
            tx_hash: txHash,
            status: "ACTIVE",
            certificate_url: certificateUrl,
        });

        if (error) throw error;

        fs.unlink(req.file.path, () => {});

        res.status(201).json({
            success: true,
            credentialHash: documentHash,
            txHash,
        });
    } catch (err) {
        console.error(err);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/credentials/verify (requireVerifier)
export async function verify(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Certificate PDF required" });
        }

        const documentHash = hashFile(req.file.path);
        fs.unlink(req.file.path, () => {});

        const result = await verifyOnChain(documentHash);
        const [exists, revoked, studentWalletOnChain, issuedAt, issuedBy] = result;

        if (!exists) {
            return res.json({
                success: true,
                status: "INVALID",
                message: "Certificate not found on blockchain - it may be forged or tampered",
                credentialHash: documentHash,
            });
        }

        const { data: cred } = await supabase
            .from("credentials")
            .select("id, student_name, student_email, register_number, degree, branch, institution, issue_date, university_wallet")
            .eq("document_hash", documentHash)
            .single();

        const { data: uni } = await supabase
            .from("universities")
            .select("name")
            .eq("wallet_address", String(issuedBy || "").toLowerCase())
            .single();

        res.json({
            success: true,
            status: revoked ? "REVOKED" : "VALID",
            credentialHash: documentHash,
            credentialId: cred?.id || null,
            onChain: {
                issuedAt: issuedAt ? new Date(Number(issuedAt) * 1000).toISOString() : null,
                issuedBy,
                issuingUniversity: uni?.name || null,
                studentWallet: studentWalletOnChain,
                revoked,
            },
            metadata: cred || null,
        });
    } catch (err) {
        console.error(err);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ success: false, message: err.message });
    }
}

// POST /api/credentials/revoke (requireUniversity)
export async function revoke(req, res) {
    try {
        const { credential_hash } = req.body;

        if (!credential_hash) {
            return res.status(400).json({ success: false, message: "credential_hash is required" });
        }

        const { data: cred, error } = await supabase
            .from("credentials")
            .select("id, university_wallet, status")
            .eq("credential_hash", credential_hash)
            .single();

        if (error || !cred) {
            return res.status(404).json({ success: false, message: "Credential not found" });
        }

        if (cred.university_wallet.toLowerCase() !== req.university.wallet.toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: "You can only revoke credentials your university issued",
            });
        }

        if (cred.status === "REVOKED") {
            return res.status(409).json({ success: false, message: "Credential is already revoked" });
        }

        const txHash = await revokeOnChain(credential_hash);

        await supabase
            .from("credentials")
            .update({ status: "REVOKED" })
            .eq("credential_hash", credential_hash);

        res.json({ success: true, txHash });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/credentials/university (requireUniversity)
export async function getUniversityCredentials(req, res) {
    try {
        const { wallet } = req.university;

        const { data, error } = await supabase
            .from("credentials")
            .select("*")
            .eq("university_wallet", wallet.toLowerCase())
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({ success: true, credentials: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/credentials/mine?student_wallet=0x... (public, filtered by wallet)
export async function getMyCredentials(req, res) {
    try {
        const { student_wallet } = req.query;

        if (!student_wallet) {
            return res.status(400).json({ success: false, message: "student_wallet query param is required" });
        }

        const { data, error } = await supabase
            .from("credentials")
            .select("*")
            .eq("student_wallet", student_wallet.toLowerCase())
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({ success: true, credentials: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}
