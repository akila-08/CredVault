import { verifyMessage } from "ethers";
import supabase from "../services/supabaseService.js";
import { sendOwnershipVerificationEmail } from "../services/emailService.js";

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function normalizeWallet(wallet) {
    return String(wallet || "").trim().toLowerCase();
}

function buildApprovalMessage({ request, credential, studentEmail }) {
    return [
        "CredVault Ownership Verification",
        `Request ID: ${request.id}`,
        `Credential ID: ${request.credential_id}`,
        `Credential Hash: ${credential.credential_hash || credential.document_hash || ""}`,
        `Student Email: ${studentEmail}`,
        "I approve this ownership verification request.",
    ].join("\n");
}


function buildRejectionMessage({ request, credential, studentEmail }) {
    return [
        "CredVault Ownership Verification",
        `Request ID: ${request.id}`,
        `Credential ID: ${request.credential_id}`,
        `Credential Hash: ${credential.credential_hash || credential.document_hash || ""}`,
        `Student Email: ${studentEmail}`,
        "I reject this ownership verification request.",
    ].join("\n");
}



async function hydrateRequests(requests) {
    const ids = [...new Set((requests || []).map((request) => request.credential_id).filter(Boolean))];

    if (!ids.length) return requests || [];

    const { data: credentials, error } = await supabase
        .from("credentials")
        .select("id, student_name, student_email, degree, branch, institution, issue_date, credential_hash, document_hash, status")
        .in("id", ids);

    if (error) throw error;

    const credentialMap = new Map((credentials || []).map((credential) => [credential.id, credential]));

    return (requests || []).map((request) => ({
        ...request,
        credential: credentialMap.get(request.credential_id) || null,
    }));
}

export async function createVerificationRequest(req, res) {
    try {
        const { credential_id } = req.body;

        if (!credential_id) {
            return res.status(400).json({ success: false, message: "credential_id is required" });
        }

        const { data: credential, error: credentialError } = await supabase
            .from("credentials")
            .select("id, student_email, student_name, degree, branch, institution")
            .eq("id", credential_id)
            .single();

        if (credentialError || !credential) {
            return res.status(404).json({ success: false, message: "Credential not found" });
        }

        const studentEmail = normalizeEmail(credential.student_email);
        if (!studentEmail) {
            return res.status(400).json({
                success: false,
                message: "This credential does not have a student email. Re-issue or update the credential metadata first.",
            });
        }

        const verifierEmail = normalizeEmail(req.verifier.email);
        const verifierName = req.verifier.organizationName || "Verifier";

        const { data: existing, error: existingError } = await supabase
            .from("verification_requests")
            .select("*")
            .eq("credential_id", credential.id)
            .eq("verifier_email", verifierEmail)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existing) {
            const [request] = await hydrateRequests([existing]);
            return res.status(200).json({
                success: true,
                message: "Verification request already exists",
                request,
                alreadyExists: true,
            });
        }

        const { data: request, error: insertError } = await supabase
            .from("verification_requests")
            .insert({
                credential_id: credential.id,
                student_email: studentEmail,
                verifier_email: verifierEmail,
                verifier_name: verifierName,
                status: "pending",
            })
            .select("*")
            .single();

        if (insertError) throw insertError;

        let emailSent = false;
        try {
            emailSent = await sendOwnershipVerificationEmail({ email: studentEmail });
        } catch (mailError) {
            console.error("Ownership verification email failed:", mailError);
        }

        const [hydratedRequest] = await hydrateRequests([request]);

        res.status(201).json({
            success: true,
            request: hydratedRequest,
            emailSent,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function getStudentVerificationRequests(req, res) {
    try {
        const studentEmail = normalizeEmail(req.student.email);

        const { data: requests, error } = await supabase
            .from("verification_requests")
            .select("*")
            .eq("student_email", studentEmail)
            .order("created_at", { ascending: false });

        if (error) throw error;

        const hydratedRequests = await hydrateRequests(requests);
        res.json({ success: true, requests: hydratedRequests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function getVerifierVerificationRequests(req, res) {
    try {
        const verifierEmail = normalizeEmail(req.verifier.email);

        const { data: requests, error } = await supabase
            .from("verification_requests")
            .select("*")
            .eq("verifier_email", verifierEmail)
            .order("created_at", { ascending: false });

        if (error) throw error;

        const hydratedRequests = await hydrateRequests(requests);
        res.json({ success: true, requests: hydratedRequests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function approveVerificationRequest(req, res) {
    try {
        const { id } = req.params;
        const connectedWallet = normalizeWallet(req.body.wallet_address);
        const signature = String(req.body.signature || "");
        const signedMessage = String(req.body.message || "");

        if (!connectedWallet) {
            return res.status(400).json({ success: false, message: "wallet_address is required" });
        }

        if (!signature || !signedMessage) {
            return res.status(400).json({ success: false, message: "MetaMask signature is required" });
        }

        const studentEmail = normalizeEmail(req.student.email);

        const { data: request, error: requestError } = await supabase
            .from("verification_requests")
            .select("*")
            .eq("id", id)
            .eq("student_email", studentEmail)
            .single();

        if (requestError || !request) {
            return res.status(404).json({ success: false, message: "Verification request not found" });
        }

        if (request.status !== "pending") {
            return res.status(409).json({ success: false, message: `Request is already ${request.status}` });
        }

        const { data: credential, error: credentialError } = await supabase
            .from("credentials")
            .select("id, student_wallet, credential_hash, document_hash")
            .eq("id", request.credential_id)
            .single();

        if (credentialError || !credential) {
            return res.status(404).json({ success: false, message: "Credential not found" });
        }

        if (connectedWallet !== normalizeWallet(credential.student_wallet)) {
            return res.status(400).json({
                success: false,
                message: "Connected wallet does not match the wallet on this credential",
            });
        }

        const expectedMessage = buildApprovalMessage({ request, credential, studentEmail });
        if (signedMessage !== expectedMessage) {
            return res.status(400).json({ success: false, message: "Invalid ownership approval message" });
        }

        const recoveredWallet = normalizeWallet(verifyMessage(signedMessage, signature));
        if (recoveredWallet !== connectedWallet) {
            return res.status(400).json({ success: false, message: "Signature does not match the connected wallet" });
        }

        const completedAt = new Date().toISOString();
        const { data: updatedRequest, error: updateError } = await supabase
            .from("verification_requests")
            .update({
                status: "approved",
                completed_at: completedAt,
            })
            .eq("id", request.id)
            .select("*")
            .single();

        if (updateError) throw updateError;

        const [hydratedRequest] = await hydrateRequests([updatedRequest]);

        res.json({
            success: true,
            message: "Ownership approved",
            request: hydratedRequest,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

/*export async function rejectVerificationRequest(req, res) {
    try {
        const { id } = req.params;
        const studentEmail = normalizeEmail(req.student.email);

        const { data: request, error: requestError } = await supabase
            .from("verification_requests")
            .select("*")
            .eq("id", id)
            .eq("student_email", studentEmail)
            .single();

        if (requestError || !request) {
            return res.status(404).json({ success: false, message: "Verification request not found" });
        }

        if (request.status !== "pending") {
            return res.status(409).json({ success: false, message: `Request is already ${request.status}` });
        }

        const { data: updatedRequest, error: updateError } = await supabase
            .from("verification_requests")
            .update({
                status: "rejected",
                completed_at: new Date().toISOString(),
            })
            .eq("id", request.id)
            .select("*")
            .single();

        if (updateError) throw updateError;

        const [hydratedRequest] = await hydrateRequests([updatedRequest]);

        res.json({
            success: true,
            message: "Ownership request declined",
            request: hydratedRequest,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}*/



export async function rejectVerificationRequest(req, res) {
    try {
        const { id } = req.params;

        const connectedWallet = normalizeWallet(req.body.wallet_address);
        const signature = String(req.body.signature || "");
        const signedMessage = String(req.body.message || "");

        if (!connectedWallet) {
            return res.status(400).json({
                success: false,
                message: "wallet_address is required",
            });
        }

        if (!signature || !signedMessage) {
            return res.status(400).json({
                success: false,
                message: "MetaMask signature is required",
            });
        }

        const studentEmail = normalizeEmail(req.student.email);

        const { data: request, error: requestError } = await supabase
            .from("verification_requests")
            .select("*")
            .eq("id", id)
            .eq("student_email", studentEmail)
            .single();

        if (requestError || !request) {
            return res.status(404).json({
                success: false,
                message: "Verification request not found",
            });
        }

        if (request.status !== "pending") {
            return res.status(409).json({
                success: false,
                message: `Request is already ${request.status}`,
            });
        }

        const { data: credential, error: credentialError } = await supabase
            .from("credentials")
            .select("id, student_wallet, credential_hash, document_hash")
            .eq("id", request.credential_id)
            .single();

        if (credentialError || !credential) {
            return res.status(404).json({
                success: false,
                message: "Credential not found",
            });
        }

        if (connectedWallet !== normalizeWallet(credential.student_wallet)) {
            return res.status(400).json({
                success: false,
                message: "Connected wallet does not match the wallet on this credential",
            });
        }

        const expectedMessage = buildRejectionMessage({
            request,
            credential,
            studentEmail,
        });

        if (signedMessage !== expectedMessage) {
            return res.status(400).json({
                success: false,
                message: "Invalid ownership rejection message",
            });
        }

        const recoveredWallet = normalizeWallet(
            verifyMessage(signedMessage, signature)
        );

        if (recoveredWallet !== connectedWallet) {
            return res.status(400).json({
                success: false,
                message: "Signature does not match the connected wallet",
            });
        }

        const completedAt = new Date().toISOString();

        const { data: updatedRequest, error: updateError } = await supabase
            .from("verification_requests")
            .update({
                status: "rejected",
                completed_at: completedAt,
            })
            .eq("id", request.id)
            .select("*")
            .single();

        if (updateError) throw updateError;

        const [hydratedRequest] = await hydrateRequests([updatedRequest]);

        res.json({
            success: true,
            message: "Ownership request rejected",
            request: hydratedRequest,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}
