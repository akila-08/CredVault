import nodemailer from "nodemailer";

function smtpConfigured() {
    const configured =
        !!process.env.SMTP_USER &&
        !!process.env.SMTP_PASS;

    console.log("SMTP_USER =", process.env.SMTP_USER);
    console.log("SMTP_PASS exists =", !!process.env.SMTP_PASS);
    console.log("SMTP configured check:", configured);

    return configured;
}

function createTransporter() {
    return nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

export async function sendVerifierWelcomeEmail({
    email,
    organizationName,
    password,
}) {
    if (!smtpConfigured()) {
        console.warn("SMTP is not configured.");
        return false;
    }

    const frontendUrl =
        process.env.FRONTEND_URL ||
        "https://cred-vault-eight.vercel.app";

    const loginUrl = `${frontendUrl}/verify`;

    const from =
        process.env.SMTP_FROM || "credvault3@gmail.com";

    try {
        const transporter = createTransporter();

        const info = await transporter.sendMail({
            from,
            to: email,
            subject: "Your CredVault verifier account",
            text: `
Hello ${organizationName},

Your CredVault verifier account has been created.

Email: ${email}
Temporary Password: ${password}

Login: ${loginUrl}

Please sign in and change your password.
`,
            html: `
                <h3>Hello ${organizationName}</h3>
                <p>Your CredVault verifier account has been created.</p>

                <p><b>Email:</b> ${email}</p>
                <p><b>Temporary Password:</b> ${password}</p>

                <p>
                    <a href="${loginUrl}">
                        Login to CredVault
                    </a>
                </p>

                <p>Please sign in and change your password.</p>
            `,
        });

        console.log("Email sent:", info.messageId);
        return true;
    } catch (err) {
        console.error("Brevo SMTP Error:", err);
        return false;
    }
}