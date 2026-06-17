import jwt from "jsonwebtoken";
import dotenv from "dotenv";

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

// Protects admin-only routes
// Expects: x-admin-key header
export function requireAdmin(req, res, next) {
    const key = req.headers["x-admin-key"];

    if (!key || key !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ success: false, message: "Admin access required" });
    }

    next();
}
