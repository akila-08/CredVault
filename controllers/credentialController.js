import { hashFile } from "../utils/hashFile.js";
import {
    // issueCredentialFor,
     verifyIssuanceReceipt,
    getCredentialRsaSignature,
    credentialExists,
    verifyWithIssuer,
    revokeCredential as revokeOnChain,
    verifyRevocationReceipt,
} from "../services/blockchainService.js";
import supabase from "../services/supabaseService.js";
import fs from "fs";
import crypto from "crypto";

import {
    bloomFilter,
    isBloomReady,
} from "../utils/bloomFilter.js";


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

        const rsaSignature = String(req.body.rsa_signature || "");
        const { data: issuerKey, error: issuerKeyError } = await supabase.from("issuer_registry1")
            .select("rsa_public_key").eq("wallet_address", req.university.wallet.toLowerCase()).single();
        if (issuerKeyError) throw issuerKeyError;
        if (!issuerKey?.rsa_public_key || !rsaSignature || !req.body.issuer_signature) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ success: false, message: "University RSA key and certificate signature are required" });
        }
        const rsaValid = crypto.verify("sha256", Buffer.from(documentHash.slice(2), "hex"), {
            key: issuerKey.rsa_public_key,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: 32,
        }, Buffer.from(rsaSignature, "base64"));
        if (!rsaValid) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ success: false, message: "RSA certificate signature is invalid" });
        }
        const txHash = await verifyIssuanceReceipt(
    req.body.txHash,
    documentHash,
    student_wallet,
    universityWallet,
    req.body.issuer_signature,
    rsaSignature
);

        

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

        // const exists = await credentialExists(documentHash);
        // if (exists) {
        //     fs.unlink(req.file.path, () => {});
        //     return res.status(409).json({ success: false, message: "This certificate PDF already exists on-chain" });
        // }

        // const txHash = await issueCredentialFor(documentHash, student_wallet, req.body.issuer_signature, rsaSignature);

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

        // Add the certificate hash after successful blockchain issuance
        // and successful Supabase metadata insertion.
        bloomFilter.add(documentHash);

        console.log("Certificate added to Bloom Filter:", documentHash);

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

// Bloom Filter pre-check
if (
    isBloomReady() &&
    !bloomFilter.mightContain(documentHash)
) {
    console.log("Bloom Filter: certificate definitely absent");

    return res.json({
        success: true,
        status: "INVALID",
        message: "Certificate not found in the certificate index",
        credentialHash: documentHash,
        bloomFilter: {
            checked: true,
            blockchainLookupSkipped: true,
        },
    });
}

console.log(
    "Bloom Filter:",
    isBloomReady()
        ? "MAYBE PRESENT - checking blockchain"
        : "NOT READY - using normal blockchain verification"
);

// Continue with your existing blockchain verification
        const result = await verifyWithIssuer(documentHash);

        const [exists, revoked, studentWalletOnChain, issuedAt, issuedBy, issuerAuthorized] = result;

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
            .select("id, student_name, student_email, register_number, degree, branch, institution, issue_date, university_wallet, tx_hash")
            .eq("document_hash", documentHash)
            .single();

        const { data: uni } = await supabase
            .from("issuer_registry1")
            .select("name, rsa_public_key")
            .eq("wallet_address", String(issuedBy || "").toLowerCase())
            .single();

        let rsaSignaturePresent = false;
        let rsaVerified = null;
        if (cred?.tx_hash) {
            const signedHash = await getCredentialRsaSignature(cred.tx_hash, documentHash, String(issuedBy));
            if (signedHash) {
                rsaSignaturePresent = true;
                const docBuffer = Buffer.from(documentHash.slice(2), "hex");
                const sigBuffer = Buffer.from(signedHash.slice(2), "hex");

                // 1. Try current RSA public key
                if (uni?.rsa_public_key) {
                    try {
                        rsaVerified = crypto.verify("sha256", docBuffer, {
                            key: uni.rsa_public_key,
                            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                            saltLength: 32,
                        }, sigBuffer);
                    } catch {
                        rsaVerified = false;
                    }
                }

                // 2. If current key did not verify, check historical keys (preserved during key rotation)
                if (!rsaVerified) {
                    const { data: keyHistory } = await supabase
                        .from("issuer_rsa_key_history")
                        .select("rsa_public_key")
                        .eq("wallet_address", String(issuedBy || "").toLowerCase())
                        .order("created_at", { ascending: false });

                    for (const hist of (keyHistory || [])) {
                        if (!hist.rsa_public_key) continue;
                        try {
                            const valid = crypto.verify("sha256", docBuffer, {
                                key: hist.rsa_public_key,
                                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                                saltLength: 32,
                            }, sigBuffer);
                            if (valid) {
                                rsaVerified = true;
                                break;
                            }
                        } catch {
                            // continue checking other historical keys
                        }
                    }
                }
            }
        }

        res.json({
            success: true,
            status: rsaSignaturePresent && !rsaVerified ? "INVALID" : revoked ? "REVOKED" : "VALID",
            message: rsaSignaturePresent && !rsaVerified ? "RSA issuer signature could not be verified" : undefined,
            credentialHash: documentHash,
            credentialId: cred?.id || null,
            onChain: {
                issuedAt: issuedAt ? new Date(Number(issuedAt) * 1000).toISOString() : null,
                issuedBy,
                issuingUniversity: uni?.name || null,
                studentWallet: studentWalletOnChain,
                revoked,
                issuerAuthorized,
                issuerValidated: Boolean(issuerAuthorized),
                rsaSignaturePresent,
                rsaSignatureVerified: rsaVerified,
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

        const txHash = req.body.txHash
            ? await verifyRevocationReceipt(req.body.txHash, credential_hash, req.university.wallet)
            : await revokeOnChain(credential_hash);

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
