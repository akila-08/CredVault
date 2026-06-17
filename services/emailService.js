import nodemailer from "nodemailer";

function smtpConfigured() {
    const configured =
        !!process.env.SMTP_HOST &&
        !!process.env.SMTP_USER &&
        !!process.env.SMTP_PASS;

    console.log("SMTP configured check:", configured);

    return configured;
}

function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

export async function sendVerifierWelcomeEmail({ email, organizationName, password }) {
    if (!smtpConfigured()) {
        console.warn("SMTP is not configured. Skipping verifier welcome email.");
        return false;
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const loginUrl = `${frontendUrl.replace(/\/$/, "")}/verify`;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await createTransporter().sendMail({
        from,
        to: email,
        subject: "Your CredVault verifier account",
        text: [
            `Hello ${organizationName},`,
            "",
            "Your CredVault verifier account has been created.",
            "",
            `Email: ${email}`,
            `Temporary password: ${password}`,
            `Login: ${loginUrl}`,
            "",
            "Please sign in and change your password from your profile.",
        ].join("\n"),
        html: `
            <p>Hello ${organizationName},</p>
            <p>Your CredVault verifier account has been created.</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary password:</strong> ${password}</p>
            <p><a href="${loginUrl}">Login to CredVault</a></p>
            <p>Please sign in and change your password from your profile.</p>
        `,
    });

    return true;
}
