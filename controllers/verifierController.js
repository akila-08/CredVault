import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import supabase from "../services/supabaseService.js";
import { sendVerifierWelcomeEmail } from "../services/emailService.js";
import {
    listAccessHistory,
    recordAccessHistory,
} from "../services/accessHistoryService.js";
import {
    generateTemporaryPassword,
    hashPassword,
    verifyPassword,
} from "../utils/passwordUtils.js";

dotenv.config();

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function publicVerifier(verifier) {
    return {
        id: verifier.id,
        organization_name: verifier.organization_name,
        email: verifier.email,
        is_active: verifier.is_active,
        created_at: verifier.created_at,
        password_changed_at: verifier.password_changed_at,
    };
}

export async function registerVerifier(req, res) {
    try {
        const organization_name = String(req.body.organization_name || "").trim();
        const email = normalizeEmail(req.body.email);

        if (!organization_name || !email) {
            return res.status(400).json({
                success: false,
                message: "organization_name and email are required",
            });
        }

        const temporaryPassword = generateTemporaryPassword();
        const password_hash = hashPassword(temporaryPassword);

        const { data: existingVerifier, error: findError } = await supabase
            .from("verifiers")
            .select("id, is_active")
            .eq("email", email)
            .maybeSingle();

        if (findError) throw findError;

        if (existingVerifier?.is_active) {
            return res.status(409).json({ success: false, message: "A verifier with this email already exists" });
        }

        if (existingVerifier) {
            const { data, error } = await supabase
                .from("verifiers")
                .update({
                    organization_name,
                    password_hash,
                    is_active: true,
                    password_changed_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingVerifier.id)
                .select("id, organization_name, email, is_active, created_at, password_changed_at")
                .single();

            if (error) throw error;

            let emailSent = false;
            try {
                emailSent = await sendVerifierWelcomeEmail({
                    email,
                    organizationName: organization_name,
                    password: temporaryPassword,
                });
            } catch (mailError) {
                console.error("Verifier email failed:", mailError);
            }

            await recordAccessHistory({
                entityType: "verifier",
                entityId: data.id,
                entityKey: email,
                action: "access_restored",
                details: {
                    organization_name: data.organization_name,
                    emailSent,
                },
            });

            return res.status(200).json({
                success: true,
                verifier: data,
                emailSent,
                temporaryPassword: emailSent ? undefined : temporaryPassword,
            });
        }

        const { data, error } = await supabase
            .from("verifiers")
            .insert({
                organization_name,
                email,
                password_hash,
                is_active: true,
            })
            .select("id, organization_name, email, is_active, created_at, password_changed_at")
            .single();

        if (error) {
            if (error.code === "23505") {
                return res.status(409).json({ success: false, message: "A verifier with this email already exists" });
            }
            throw error;
        }

        let emailSent = false;
        try {
            emailSent = await sendVerifierWelcomeEmail({
                email,
                organizationName: organization_name,
                password: temporaryPassword,
            });
        } catch (mailError) {
            console.error("Verifier email failed:", mailError);
        }

        await recordAccessHistory({
            entityType: "verifier",
            entityId: data.id,
            entityKey: email,
            action: "access_added",
            details: {
                organization_name: data.organization_name,
                emailSent,
            },
        });

        res.status(201).json({
            success: true,
            verifier: data,
            emailSent,
            temporaryPassword: emailSent ? undefined : temporaryPassword,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function listVerifiers(req, res) {
    try {
        const { data, error } = await supabase
            .from("verifiers")
            .select("id, organization_name, email, is_active, created_at, password_changed_at")
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({ success: true, verifiers: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function removeVerifier(req, res) {
    try {
        const { id } = req.params;

        const { data: existingVerifier, error: findError } = await supabase
            .from("verifiers")
            .select("id, organization_name, email")
            .eq("id", id)
            .maybeSingle();

        if (findError) throw findError;

        const { error } = await supabase
            .from("verifiers")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", id);

        if (error) throw error;

        await recordAccessHistory({
            entityType: "verifier",
            entityId: existingVerifier?.id || id,
            entityKey: existingVerifier?.email || id,
            action: "access_removed",
            details: {
                organization_name: existingVerifier?.organization_name || null,
            },
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function getVerifierHistory(req, res) {
    try {
        const { data, error } = await listAccessHistory("verifier");

        if (error) throw error;

        res.json({ success: true, history: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function loginVerifier(req, res) {
    try {
        const email = normalizeEmail(req.body.email);
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "email and password are required" });
        }

        const { data: verifier, error } = await supabase
            .from("verifiers")
            .select("id, organization_name, email, password_hash, is_active, created_at, password_changed_at")
            .eq("email", email)
            .eq("is_active", true)
            .single();

        if (error || !verifier || !verifyPassword(password, verifier.password_hash)) {
            return res.status(401).json({ success: false, message: "Invalid verifier email or password" });
        }

        const token = jwt.sign(
            {
                role: "verifier",
                verifierId: verifier.id,
                email: verifier.email,
                organizationName: verifier.organization_name,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({
            success: true,
            token,
            verifier: publicVerifier(verifier),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function getVerifierProfile(req, res) {
    try {
        const { data: verifier, error } = await supabase
            .from("verifiers")
            .select("id, organization_name, email, is_active, created_at, password_changed_at")
            .eq("id", req.verifier.id)
            .eq("is_active", true)
            .single();

        if (error || !verifier) {
            return res.status(404).json({ success: false, message: "Verifier profile not found" });
        }

        res.json({ success: true, verifier });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function changeVerifierPassword(req, res) {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: "current_password and new_password are required" });
        }

        if (String(new_password).length < 8) {
            return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
        }

        const { data: verifier, error } = await supabase
            .from("verifiers")
            .select("id, password_hash")
            .eq("id", req.verifier.id)
            .eq("is_active", true)
            .single();

        if (error || !verifier || !verifyPassword(current_password, verifier.password_hash)) {
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }

        const { error: updateError } = await supabase
            .from("verifiers")
            .update({
                password_hash: hashPassword(new_password),
                password_changed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", req.verifier.id);

        if (updateError) throw updateError;

        res.json({ success: true, message: "Password updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
}
