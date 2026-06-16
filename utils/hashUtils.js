import { ethers } from "ethers";

// Original metadata-only hash (kept for reference)
export function hashCredential(
    registerNumber,
    studentName,
    degree,
    branch,
    institution,
    issueDate,
    studentWallet
) {
    return ethers.solidityPackedKeccak256(
        ["string", "string", "string", "string", "string", "string", "address"],
        [registerNumber, studentName, degree, branch, institution, issueDate, studentWallet]
    );
}

// Combined hash: sha256(PDF) + all metadata → single bytes32 on-chain
// This proves both the document AND the metadata are untampered
export function hashCredentialCombined(
    fileHash,       // "0x" + sha256(pdfBytes) — 32 bytes hex
    studentName,
    registerNumber,
    degree,
    branch,
    institution,
    issueDate,
    studentWallet
) {
    return ethers.solidityPackedKeccak256(
        ["bytes32", "string", "string", "string", "string", "string", "string", "address"],
        [fileHash, studentName, registerNumber, degree, branch, institution, issueDate, studentWallet]
    );
}