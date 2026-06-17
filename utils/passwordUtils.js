import crypto from "crypto";

const KEY_LENGTH = 64;

export function generateTemporaryPassword() {
    return crypto.randomBytes(9).toString("base64url");
}

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
    return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
    if (!password || !storedHash || !storedHash.includes(":")) return false;

    const [salt, hash] = storedHash.split(":");
    const candidate = crypto.scryptSync(password, salt, KEY_LENGTH);
    const original = Buffer.from(hash, "hex");

    return original.length === candidate.length && crypto.timingSafeEqual(original, candidate);
}
