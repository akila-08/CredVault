import nodemailer from "nodemailer";

function smtpConfigured() {
    console.log("SMTP_HOST =", process.env.SMTP_HOST);
    console.log("SMTP_USER =", process.env.SMTP_USER);
    console.log("SMTP_PASS exists =", !!process.env.SMTP_PASS);
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
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
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

    const transporter = createTransporter();

    try {
        console.log("Verifying SMTP connection...");
        await transporter.verify();
        console.log("SMTP connection successful");

        await transporter.sendMail({
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

        console.log("Email sent successfully");
        return true;
    } catch (err) {
        console.error("SMTP ERROR:", err);
        return false;
    }
}