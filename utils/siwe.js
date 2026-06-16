import { SiweMessage } from "siwe";
import { v4 as uuidv4 } from "uuid";
import supabase from "../services/supabaseService.js";

export function generateNonce() {
    return uuidv4().replace(/-/g, "");
}

export async function storeNonce(walletAddress, nonce) {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const { error } = await supabase.from("siwe_nonces").upsert({
        wallet_address: walletAddress.toLowerCase(),
        nonce,
        expires_at: expiresAt.toISOString(),
    });
    if (error) throw error;
}

export async function verifyNonce(walletAddress) {
    const { data, error } = await supabase
        .from("siwe_nonces")
        .select("nonce, expires_at")
        .eq("wallet_address", walletAddress.toLowerCase())
        .single();

    if (error || !data) return null;
    if (new Date(data.expires_at) < new Date()) return null;
    return data.nonce;
}

export async function deleteNonce(walletAddress) {
    await supabase
        .from("siwe_nonces")
        .delete()
        .eq("wallet_address", walletAddress.toLowerCase());
}

export async function verifySiweMessage(message, signature) {
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({ signature });
    if (!result.success) throw new Error("Invalid signature");
    return result.data;
}
