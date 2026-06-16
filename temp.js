import { verifyCredential } from "./services/blockchainService.js";

const result = await verifyCredential(
    "0xaa82de839df934a42a61624bd3948d351bfc9968d4a12dcc51d9683a28c92fb7"
);

console.log(result);