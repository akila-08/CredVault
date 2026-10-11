import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const provider = new ethers.JsonRpcProvider(
    process.env.POLYGON_RPC_URL
);

const wallet = new ethers.Wallet(
    process.env.PRIVATE_KEY,
    provider
);

const balance = await provider.getBalance(wallet.address);

console.log("Backend transaction wallet:", wallet.address);
console.log("Backend wallet balance:", ethers.formatEther(balance), "POL");