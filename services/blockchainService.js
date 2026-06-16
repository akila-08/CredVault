import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

const abi = JSON.parse(
    fs.readFileSync(
        new URL("../config/abi.json", import.meta.url)
    )
);

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    abi,
    wallet
);

// ── Credential functions ──────────────────────────────────────

export async function verifyCredential(hash) {
    return await contract.verifyCredential(hash);
}

export async function credentialExists(hash) {
    return await contract.credentialExists(hash);
}

export async function issueCredential(credentialHash, studentWallet) {
    const tx = await contract.issueCredential(credentialHash, studentWallet);
    await tx.wait();
    return tx.hash;
}

export async function revokeCredential(credentialHash) {
    const tx = await contract.revokeCredential(credentialHash);
    await tx.wait();
    return tx.hash;
}

// ── University management functions ──────────────────────────

export async function addUniversity(walletAddress) {
    const tx = await contract.addUniversity(walletAddress);
    await tx.wait();
    return tx.hash;
}

export async function removeUniversity(walletAddress) {
    const tx = await contract.removeUniversity(walletAddress);
    await tx.wait();
    return tx.hash;
}

export async function isAuthorizedUniversity(walletAddress) {
    return await contract.authorizedUniversities(walletAddress);
}

export async function owner() {
    return await contract.owner();
}