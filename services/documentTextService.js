import { execFile } from "child_process";
import fs from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const AZURE_API_VERSION = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION || "2024-11-30";
const AZURE_MODEL_ID = process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID || "prebuilt-read";

function getAzureConfig() {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.replace(/\/+$/, "");
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

    if (!endpoint || !key) return null;
    return { endpoint, key };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCommand(command, args) {
    try {
        const { stdout, stderr } = await execFileAsync(command, args, {
            timeout: 120000,
            maxBuffer: 20 * 1024 * 1024,
        });

        return { ok: true, stdout, stderr };
    } catch (error) {
        if (error.code === "ENOENT") {
            return {
                ok: false,
                missingCommand: command,
                stdout: "",
                stderr: `${command} is not installed or is not available on PATH`,
            };
        }

        return {
            ok: false,
            stdout: error.stdout || "",
            stderr: error.stderr || error.message,
        };
    }
}

async function extractWithPdfToText(filePath) {
    const result = await runCommand("pdftotext", ["-layout", filePath, "-"]);
    if (result.missingCommand) {
        return "";
    }

    if (!result.ok) return "";
    return result.stdout.trim();
}

async function extractWithAzure(filePath) {
    const config = getAzureConfig();

    if (!config) {
        throw new Error("Azure Document Intelligence is not configured. Add AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY to .env.");
    }

    const analyzeUrl = `${config.endpoint}/documentintelligence/documentModels/${AZURE_MODEL_ID}:analyze?api-version=${AZURE_API_VERSION}`;
    const base64Source = fs.readFileSync(filePath).toString("base64");

    const analyzeRes = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Ocp-Apim-Subscription-Key": config.key,
        },
        body: JSON.stringify({ base64Source }),
    });

    if (!analyzeRes.ok) {
        const body = await analyzeRes.text();
        throw new Error(`Azure Document Intelligence request failed (${analyzeRes.status}): ${body}`);
    }

    const operationLocation = analyzeRes.headers.get("operation-location");
    if (!operationLocation) {
        throw new Error("Azure Document Intelligence did not return an operation-location header.");
    }

    for (let attempt = 0; attempt < 45; attempt += 1) {
        await sleep(1000);

        const resultRes = await fetch(operationLocation, {
            headers: { "Ocp-Apim-Subscription-Key": config.key },
        });

        if (!resultRes.ok) {
            const body = await resultRes.text();
            throw new Error(`Azure Document Intelligence polling failed (${resultRes.status}): ${body}`);
        }

        const result = await resultRes.json();

        if (result.status === "succeeded") {
            return result.analyzeResult?.content?.trim() || "";
        }

        if (result.status === "failed") {
            throw new Error(result.error?.message || "Azure Document Intelligence failed to analyze the document.");
        }
    }

    throw new Error("Azure Document Intelligence timed out while analyzing the document.");
}

export async function extractTextFromDocument(filePath) {
    const digitalText = await extractWithPdfToText(filePath);
    if (digitalText.length >= 80) {
        return {
            provider: "pdftotext",
            text: digitalText,
            usedOcr: false,
        };
    }

    const ocrText = await extractWithAzure(filePath);
    return {
        provider: "azure-document-intelligence",
        text: ocrText,
        usedOcr: true,
    };
}
