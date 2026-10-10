import "dotenv/config";
import { ethers } from "ethers";
import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const abi = [
  ...JSON.parse(fs.readFileSync(new URL("../config/abi.v2.json", import.meta.url))),
  "function issueCredentialForWithRsa(bytes32 credentialHash,address studentWallet,bytes signature,bytes rsaSignature)",
  "event CredentialRsaSignature(bytes32 indexed credentialHash,address indexed university,bytes signature)",
];

const required = ["POLYGON_RPC_URL", "CONTRACT_ADDRESS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MEASURE_VALIDATOR_KEYS", "MEASURE_ISSUER_KEY", "MEASURE_STUDENT_WALLET"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const validators = process.env.MEASURE_VALIDATOR_KEYS.split(",").map(k => new ethers.Wallet(k.trim(), provider));
const issuer = new ethers.Wallet(process.env.MEASURE_ISSUER_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, validators[0]);
const student = process.env.MEASURE_STUDENT_WALLET;
const hash = ethers.keccak256(ethers.toUtf8Bytes(`CredVault gas measurement ${Date.now()}`));
const gasMeasurements = [];

async function report(label, tx) {
  const receipt = await tx.wait(1);
  const price = receipt.gasPrice ?? (await provider.getFeeData()).gasPrice;
  const cost = receipt.gasUsed * price;
  console.log(`${label}: gas=${receipt.gasUsed} costPOL=${ethers.formatEther(cost)} tx=${tx.hash}`);
  gasMeasurements.push({
    operation: label,
    gasUsed: receipt.gasUsed.toString(),
    gasPriceGwei: ethers.formatUnits(price, "gwei"),
    costWei: cost.toString(),
    costPOL: ethers.formatEther(cost),
    txHash: receipt.hash,
  });
  return receipt;
}

const candidate = ethers.Wallet.createRandom().address;
const proposed = await report("proposeIssuer", await contract.proposeIssuer(candidate));
const created = proposed.logs.map(log => { try { return contract.interface.parseLog(log); } catch { return null; } }).find(log => log?.name === "ProposalCreated");
const proposalId = created.args.id;
for (const validator of validators.slice(1)) {
  const voterContract = contract.connect(validator);
  await report("voteOnProposal", await voterContract.voteOnProposal(proposalId, true));
}
// Measure the current relayed issuance path, including the on-chain RSA signature event.
// The configured Ethereum issuer must already be approved by the contract.
const network = await provider.getNetwork();
const issuerDigest = ethers.solidityPackedKeccak256(
  ["address", "uint256", "bytes32", "address"],
  [process.env.CONTRACT_ADDRESS, network.chainId, hash, student]
);
const walletSignature = await issuer.signMessage(ethers.getBytes(issuerDigest));
const { privateKey: rsaPrivateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 3072 });
const rsaSignature = crypto.sign("sha256", Buffer.from(hash.slice(2), "hex"), {
  key: rsaPrivateKey,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: 32,
});
await report("issueCredentialWithRsa", await contract.issueCredentialForWithRsa(
  hash, student, walletSignature, `0x${rsaSignature.toString("hex")}`
));
await report("revokeCredential", await contract.connect(issuer).revokeCredential(hash));

const totalCostWei = gasMeasurements.reduce((total, item) => total + BigInt(item.costWei), 0n);
const { error: saveError } = await supabase.from("performance_runs").insert({
  run_type: "gas",
  sample_count: gasMeasurements.length,
  metrics: {
    chainId: Number(network.chainId),
    contractAddress: process.env.CONTRACT_ADDRESS,
    transactions: gasMeasurements,
    totalCostWei: totalCostWei.toString(),
    totalCostPOL: ethers.formatEther(totalCostWei),
  },
});
if (saveError) throw new Error(`Gas transactions completed, but saving the dashboard report failed: ${saveError.message}`);
console.log("Gas report saved to Supabase performance_runs.");
