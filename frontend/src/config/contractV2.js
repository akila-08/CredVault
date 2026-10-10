export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
export const AMOY_CHAIN_ID = 80002;
export const AMOY_CHAIN_HEX = "0x13882";
export const AMOY_NETWORK = { chainId: AMOY_CHAIN_HEX, chainName: "Polygon Amoy", nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 }, rpcUrls: ["https://rpc-amoy.polygon.technology/"], blockExplorerUrls: ["https://amoy.polygonscan.com/"] };
export const VOTING_ABI = [
  "function proposeIssuer(address candidate) returns (uint256)",
  "function proposeRemoval(address candidate) returns (uint256)",
  "function voteOnProposal(uint256 id,bool approve)",
  "function isValidator(address) view returns (bool)",
  "function hasVoted(uint256,address) view returns (bool)",
  "function getProposal(uint256) view returns (address,bool,uint256,uint256,uint256,uint256,uint8,uint256)",
  "function proposalCount() view returns (uint256)",
];
