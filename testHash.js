import { hashCredential } from "./utils/hashUtils.js";

const hash = hashCredential(
    "711522205001",
    "B.Tech I",
    "Anna University",
    "2026-06-12",
    "0x74720427a5551649CC6D0036Ac3c420f9414cc9a"
);

console.log("Credential Hash:");
console.log(hash);