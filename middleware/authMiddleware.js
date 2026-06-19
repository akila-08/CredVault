import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import supabase from "../services/supabaseService.js";

dotenv.config();

// Protects university-only routes
// Expects: Authorization: Bearer <jwt>
export function requireUniversity(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "university") {
            return res.status(403).json({ success: false, message: "University access required" });
        }

        req.university = {
            wallet: decoded.wallet,
            name: decoded.name,
            id: decoded.universityId,
        };

        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}

// Protects verifier-only routes
// Expects: Authorization: Bearer <jwt>
export function requireVerifier(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "verifier") {
            return res.status(403).json({ success: false, message: "Verifier access required" });
        }

        req.verifier = {
            id: decoded.verifierId,
            email: decoded.email,
            organizationName: decoded.organizationName,
        };

        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}

// Protects student-only routes backed by Supabase Auth
// Expects: Authorization: Bearer <supabase access token>
export async function requireStudent(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No student session provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data?.user?.email) {
            return res.status(401).json({ success: false, message: "Invalid or expired student session" });
        }

        req.student = {
            id: data.user.id,
            email: data.user.email.toLowerCase(),
        };

        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired student session" });
    }
}

// Protects admin-only routes
// Expects: x-admin-key header
export function requireAdmin(req, res, next) {
    const key = req.headers["x-admin-key"];

    if (!key || key !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ success: false, message: "Admin access required" });
    }

    next();
}
