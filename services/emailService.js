import SibApiV3Sdk from "sib-api-v3-sdk";

export async function sendVerifierWelcomeEmail({
  email,
  organizationName,
  password,
}) {
  try {
    const client = SibApiV3Sdk.ApiClient.instance;

    client.authentications["api-key"].apiKey =
      process.env.BREVO_API_KEY;

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "https://cred-vault-eight.vercel.app";

    const loginUrl = `${frontendUrl}/verify`;

    await apiInstance.sendTransacEmail({
      sender: {
        email: "credvault3@gmail.com",
        name: "CredVault",
      },
      to: [
        {
          email,
        },
      ],
      subject: "Your CredVault verifier account",
      htmlContent: `
        <h3>Hello ${organizationName}</h3>

        <p>Your CredVault verifier account has been created.</p>

        <p><b>Email:</b> ${email}</p>
        <p><b>Temporary Password:</b> ${password}</p>

        <p>
          <a href="${loginUrl}">
            Login to CredVault
          </a>
        </p>
      `,
    });

    console.log("Email sent successfully");
    return true;
  } catch (err) {
    console.error("Brevo API Error:", err);
    return false;
  }
}