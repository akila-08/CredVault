import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerifierWelcomeEmail({
    email,
    organizationName,
    password,
}) {
    try {
        const frontendUrl =
            process.env.FRONTEND_URL ||
            "https://cred-vault-eight.vercel.app";

        const loginUrl = `${frontendUrl}/verify`;

        const result = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: email,
            subject: "Your CredVault Verifier Account",
            html: `
                <h2>Hello ${organizationName}</h2>

                <p>Your CredVault verifier account has been created.</p>

                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Temporary Password:</strong> ${password}</p>

                <p>
                    <a href="${loginUrl}">
                        Login to CredVault
                    </a>
                </p>

                <p>Please change your password after login.</p>
            `,
        });

        console.log("Email sent:", result);
        return true;
    } catch (err) {
        console.error("Resend Error:", err);
        return false;
    }
}