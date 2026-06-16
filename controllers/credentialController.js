import { hashFile } from "../utils/hashFile.js";
import {
    issueCredential,
    credentialExists,
    verifyCredential as verifyOnChain,
    revokeCredential as revokeOnChain,
} from "../services/blockchainService.js";
import supabase from "../services/supabaseService.js";
import fs from "fs";

// ── Issue ─────────────────────────────────────────────────────
// POST /api/credentials/issue  (requireUniversity)
export async function issue(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Certificate PDF required" });
        }

        const { student_name, register_number, degree, branch, issue_date } = req.body;
        const student_wallet = (req.body.student_wallet || "").toLowerCase(); // normalise
        const { name: institution, wallet: universityWallet } = req.university;

        // Step 1: Hash the raw PDF bytes — this IS the on-chain key
        // Using document hash alone means: same PDF can never be re-issued,
        // regardless of metadata changes. Verifiers only need the PDF.
        const documentHash = hashFile(req.file.path);

        // Step 2: Duplicate check — PDF-only, metadata-independent
        const exists = await credentialExists(documentHash);
        if (exists) {
            fs.unlink(req.file.path, () => {});
            return res.status(409).json({ success: false, message: "This certificate PDF already exists on-chain" });
        }

        // Step 3: Issue on-chain using the document hash as the credential key
        const txHash = await issueCredential(documentHash, student_wallet);

        // Step 4: Persist off-chain record (metadata stored in Supabase for display)
        const { error } = await supabase.from("credentials").insert({
            document_hash: documentHash,      // sha256 of PDF — also the on-chain key
            credential_hash: documentHash,    // same value; kept for API compatibility
            student_name,
            register_number,
            degree,
            branch,
            institution,
            university_wallet: universityWallet.toLowerCase(),
            issue_date,
            student_wallet,
            tx_hash: txHash,
            status: "ACTIVE",
        });

        if (error) throw error;

        // Clean up temp file
        fs.unlink(req.file.path, () => {});

        res.status(201).json({
            success: true,
            credentialHash: documentHash,  // documentHash is the on-chain key
            txHash,
        });
    } catch (err) {
        console.error(err);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ success: false, message: err.message });
    }
}

// ── Verify ────────────────────────────────────────────────────
// POST /api/credentials/verify  (public)
// Only the certificate PDF is required — no metadata needed.
// The documentHash IS the on-chain key, so uploading the original PDF is enough.
export async function verify(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Certificate PDF required" });
        }

        // Hash the uploaded PDF — this is the on-chain key
        const documentHash = hashFile(req.file.path);
        fs.unlink(req.file.path, () => {});

        // Query the smart contract — no metadata needed
        const result = await verifyOnChain(documentHash);
        const [exists, revoked, studentWalletOnChain, issuedAt, issuedBy] = result;

        if (!exists) {
            return res.json({
                success: true,
                status: "INVALID",
                message: "Certificate not found on blockchain — it may be forged or tampered",
                credentialHash: documentHash,
            });
        }

        // Fetch off-chain metadata from Supabase for display purposes
        const { data: cred } = await supabase
            .from("credentials")
            .select("student_name, register_number, degree, branch, institution, issue_date, university_wallet")
            .eq("document_hash", documentHash)
            .single();

        // Fetch issuing university name
        const { data: uni } = await supabase
            .from("universities")
            .select("name")
            .eq("wallet_address", (issuedBy || "").toLowerCase())
            .single();

        res.json({
            success: true,
            status: revoked ? "REVOKED" : "VALID",
            credentialHash: documentHash,
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

// ── Revoke ────────────────────────────────────────────────────
// POST /api/credentials/revoke  (requireUniversity)
export async function revoke(req, res) {
    try {
        const { credential_hash } = req.body;

        if (!credential_hash) {
            return res.status(400).json({ success: false, message: "credential_hash is required" });
        }

        // Confirm the credential was issued by this university
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

        // Revoke on-chain
        const txHash = await revokeOnChain(credential_hash);

        // Update Supabase
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

// ── University: list issued credentials ───────────────────────
// GET /api/credentials/university  (requireUniversity)
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

// ── Student: view own credentials ─────────────────────────────
// GET /api/credentials/mine?student_wallet=0x...  (public, filtered by wallet)
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