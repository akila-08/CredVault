import supabase from "./supabaseService.js";

const BASE_ALIASES = {
    student_name: [
        "student name",
        "candidate name",
        "name of student",
        "name",
    ],
    register_number: [
        "registration no",
        "registration number",
        "register no",
        "reg no",
        "index no",
        "index number",
        "student id",
        "enrollment no",
        "enrolment no",
        "roll no",
        "admission no",
    ],
    degree: [
        "degree",
        "programme",
        "program",
        "course",
        "award",
        "qualification",
    ],
    branch: [
        "branch",
        "specialization",
        "specialisation",
        "department",
        "major",
        "faculty",
        "field of study",
    ],
    issue_date: [
        "date of issue",
        "issued on",
        "award date",
        "graduation date",
        "conferred on",
        "dated",
    ],
};

const FIELD_WEIGHTS = {
    student_name: 0.25,
    register_number: 0.25,
    degree: 0.2,
    branch: 0.15,
    issue_date: 0.15,
};

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanValue(value) {
    return (value || "")
        .replace(/^[\s:;|.-]+/, "")
        .replace(/\s+/g, " ")
        .trim();
}

function textLines(text) {
    return text
        .split(/\r?\n/)
        .map(cleanValue)
        .filter(Boolean);
}

function readLabelValue(lines, aliases) {
    for (const line of lines) {
        for (const alias of aliases) {
            const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b\\s*[:\\-–—]?\\s*(.+)$`, "i");
            const match = line.match(pattern);
            if (match?.[1]) {
                const value = cleanValue(match[1]);
                if (value) return { value, confidence: 0.9, source: alias };
            }
        }
    }

    return null;
}

function readNearLabel(lines, aliases) {
    for (let index = 0; index < lines.length - 1; index += 1) {
        const line = lines[index];
        if (!aliases.some((alias) => new RegExp(`^${escapeRegex(alias)}$`, "i").test(line))) continue;

        const value = cleanValue(lines[index + 1]);
        if (value) return { value, confidence: 0.72, source: line };
    }

    return null;
}

function readDate(text) {
    const patterns = [
        /\b(\d{4}-\d{2}-\d{2})\b/,
        /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/,
        /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})\b/i,
        /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) return { value: cleanValue(match[1]), confidence: 0.62, source: "date-pattern" };
    }

    return null;
}

function readSentenceFields(text) {
    const result = {};
    const nameMatch = text.match(/(?:this is to certify that|certify that)\s+(.+?)\s+(?:has|is|was)\b/i);
    if (nameMatch?.[1]) {
        result.student_name = {
            value: cleanValue(nameMatch[1]),
            confidence: 0.68,
            source: "certify-that",
        };
    }

    const degreeMatch = text.match(/\b(?:awarded|conferred|completed|qualified for)\s+(?:the\s+)?(.{5,120}?)(?:\s+in\s+|\s+on\s+|\s+with\s+|[.,\n])/i);
    if (degreeMatch?.[1]) {
        result.degree = {
            value: cleanValue(degreeMatch[1]),
            confidence: 0.58,
            source: "award-sentence",
        };
    }

    return result;
}

function mergeAliases(customRules) {
    const merged = structuredClone(BASE_ALIASES);

    for (const rule of customRules || []) {
        const field = rule.field_name;
        if (!merged[field]) continue;

        const aliases = Array.isArray(rule.aliases) ? rule.aliases : [];
        merged[field] = [...new Set([...merged[field], ...aliases.map((alias) => String(alias).toLowerCase())])];
    }

    return merged;
}

async function loadUniversityRules(universityWallet) {
    if (!universityWallet) return [];

    const { data, error } = await supabase
        .from("credential_extraction_rules")
        .select("field_name, aliases")
        .eq("university_wallet", universityWallet.toLowerCase());

    if (error) {
        console.warn("Credential extraction rules unavailable:", error.message);
        return [];
    }

    return data || [];
}

export async function extractCredentialFields({ text, universityWallet }) {
    const customRules = await loadUniversityRules(universityWallet);
    const aliases = mergeAliases(customRules);
    const lines = textLines(text);
    const sentenceFields = readSentenceFields(text);
    const fields = {};
    const details = {};

    for (const [field, fieldAliases] of Object.entries(aliases)) {
        let match = readLabelValue(lines, fieldAliases) || readNearLabel(lines, fieldAliases);

        if (!match && field === "issue_date") {
            match = readDate(text);
        }

        if (!match && sentenceFields[field]) {
            match = sentenceFields[field];
        }

        fields[field] = match?.value || "";
        details[field] = {
            confidence: match?.confidence || 0,
            source: match?.source || null,
        };
    }

    const confidence = Object.entries(details).reduce((score, [field, detail]) => {
        return score + (FIELD_WEIGHTS[field] || 0) * detail.confidence;
    }, 0);

    return {
        fields,
        details,
        confidence: Math.round(confidence * 100),
        customRulesApplied: customRules.length,
    };
}

export async function saveCredentialExtractionAliases({ universityWallet, aliasesByField }) {
    const rows = Object.entries(aliasesByField || {})
        .filter(([field, aliases]) => BASE_ALIASES[field] && Array.isArray(aliases) && aliases.length)
        .map(([field_name, aliases]) => ({
            university_wallet: universityWallet.toLowerCase(),
            field_name,
            aliases: [...new Set(aliases.map((alias) => cleanValue(String(alias).toLowerCase())).filter(Boolean))],
        }));

    if (!rows.length) return { saved: 0 };

    const { error } = await supabase
        .from("credential_extraction_rules")
        .upsert(rows, { onConflict: "university_wallet,field_name" });

    if (error) throw error;

    return { saved: rows.length };
}
