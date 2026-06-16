import fs from "fs";
import crypto from "crypto";

export function hashFile(
    filePath
) {

    const fileBuffer =
        fs.readFileSync(
            filePath
        );

    return (
        "0x" +
        crypto
            .createHash(
                "sha256"
            )
            .update(
                fileBuffer
            )
            .digest(
                "hex"
            )
    );

}