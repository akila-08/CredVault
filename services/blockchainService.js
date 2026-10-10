import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const abi = [
    ...JSON.parse(fs.readFileSync(new URL("../config/abi.v2.json", import.meta.url))),
    "function issueCredentialForWithRsa(bytes32 credentialHash,address studentWallet,bytes signature,bytes rsaSignature)",
    "event CredentialRsaSignature(bytes32 indexed credentialHash,address indexed university,bytes signature)",
];
const provider = new ethers.JsonRpcProvider(
    process.env.POLYGON_RPC_URL,
    undefined,
    {
        batchMaxCount: 1
    }
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new ethers.Contract(contractAddress, abi, wallet);
const reader = new ethers.Contract(contractAddress, abi, provider);

export async function verifyCredential(hash) { return reader.verifyCredential(hash); }
export async function verifyWithIssuer(hash) { return reader.verifyWithIssuer(hash); }
export async function credentialExists(hash) { return reader.credentialExists(hash); }
export async function issueCredential(hash, student) {
    const tx = await contract.issueCredential(hash, student); await tx.wait(); return tx.hash;
}
export async function issueCredentialFor(hash, student, signature, rsaSignature) {
    const rsaSignatureBytes = `0x${Buffer.from(rsaSignature, "base64").toString("hex")}`;
    const tx = await contract.issueCredentialForWithRsa(hash, student, signature, rsaSignatureBytes);
    await tx.wait();
    return tx.hash;
}


export async function getCredentialRsaSignature(txHash, hash, issuer) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error("Credential transaction receipt not found");
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
        try {
            const parsed = contract.interface.parseLog(log);
            if (parsed?.name === "CredentialRsaSignature"
                && parsed.args.credentialHash.toLowerCase() === hash.toLowerCase()
                && parsed.args.university.toLowerCase() === issuer.toLowerCase()) {
                return parsed.args.signature;
            }
        } catch { /* Ignore unrelated CredVault events. */ }
    }
    return null;
}
export async function revokeCredential(hash) {
    const tx = await contract.revokeCredential(hash); await tx.wait(); return tx.hash;
}
export async function isAuthorizedUniversity(address) { return reader.authorizedUniversities(address); }
export async function getProposalCount() { return Number(await reader.proposalCount()); }
export async function getValidators() {
    const [addresses, required, unanimous, count] = await Promise.all([
        reader.getValidators(), reader.requiredApprovals(), reader.unanimous(), reader.validatorCount(),
    ]);
    return { addresses, required: Number(required), unanimous, total: Number(count) };
}
export async function getProposal(id) {
    const p = await reader.getProposal(id);
    return { candidate: p.candidate, isRemoval: p.isRemoval, approvals: Number(p.approvals),
        rejections: Number(p.rejections), required: Number(p.required), totalValidators: Number(p.totalValidators),
        status: ["none", "open", "approved", "rejected"][Number(p.status)], createdAt: Number(p.createdAt) };
}

// Parse only events emitted by this deployed contract; request-body data never creates votes.
export async function parseVotingReceipt(txHash) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error("Transaction receipt not found");
    const iface = new ethers.Interface(abi);
    const events = [];
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
        try { events.push(iface.parseLog(log)); } catch { /* unrelated log */ }
    }
    if (!events.length) throw new Error("Transaction has no CredVaultV2 events");
    return { receipt, events };
}

export async function verifyRevocationReceipt(txHash, credentialHash, issuerAddress) {
    const { receipt, events } = await parseVotingReceipt(txHash);
    if (receipt.status !== 1) throw new Error("Revocation transaction failed");
    const matched = events.some(e => e.name === "CredentialRevoked"
        && e.args.credentialHash.toLowerCase() === credentialHash.toLowerCase()
        && e.args.university.toLowerCase() === issuerAddress.toLowerCase());
    if (!matched) throw new Error("Transaction does not contain a matching issuer revocation");
    return txHash;
}