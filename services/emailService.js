import SibApiV3Sdk from "sib-api-v3-sdk";

function getEmailClient() {
  const client = SibApiV3Sdk.ApiClient.instance;

  console.log(
    "BREVO_API_KEY =",
    process.env.BREVO_API_KEY
  );

  client.authentications["api-key"].apiKey =
    process.env.BREVO_API_KEY;

  return new SibApiV3Sdk.TransactionalEmailsApi();
}

function sender() {
  return {
    email: "credvault3@gmail.com",
    name: "CredVault",
  };
}

export async function sendVerifierWelcomeEmail({
  email,
  organizationName,
  password,
}) {
  try {
    const apiInstance = getEmailClient();

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "https://cred-vault-eight.vercel.app";

    const loginUrl = `${frontendUrl}/verify`;

    await apiInstance.sendTransacEmail({
      sender: sender(),
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

export async function sendOwnershipVerificationEmail({ email }) {
  try {
    const apiInstance = getEmailClient();

    await apiInstance.sendTransacEmail({
      sender: sender(),
      to: [{ email }],
      subject: "Ownership Verification Request - CredVault",
      htmlContent: `
        <p>Hello,</p>

        <p>A verifier has requested ownership verification for one of your certificates.</p>

        <p>Please log in to your CredVault Student Portal and approve the ownership verification request.</p>

        <p>Regards,<br/>CredVault</p>
      `,
      textContent: [
        "Hello,",
        "",
        "A verifier has requested ownership verification for one of your certificates.",
        "",
        "Please log in to your CredVault Student Portal and approve the ownership verification request.",
        "",
        "Regards,",
        "CredVault",
      ].join("\n"),
    });

    console.log("Ownership verification email sent successfully");
    return true;
  } catch (err) {
    console.error("Brevo API Error:", err);
    return false;
  }
}