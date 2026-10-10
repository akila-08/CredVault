import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !Number.isInteger(port) || port < 1 || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
}

export async function sendVerifierWelcomeEmail({
  email,
  organizationName,
  password,
}) {
  const frontendUrl =
    process.env.FRONTEND_URL || "https://cred-vault-eight.vercel.app";
  const loginUrl = `${frontendUrl}/verify`;
  const safeOrganizationName = escapeHtml(organizationName);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);

  await sendEmail({
    to: email,
    subject: "Your CredVault verifier account",
    html: `
      <h3>Hello ${safeOrganizationName}</h3>
      <p>Your CredVault verifier account has been created.</p>
      <p><b>Email:</b> ${safeEmail}</p>
      <p><b>Temporary Password:</b> ${safePassword}</p>
      <p>Please sign in and change your password from the Profile section.</p>
      <p><a href="${loginUrl}">Login to CredVault</a></p>
    `,
    text: [
      `Hello ${organizationName},`,
      "",
      "Your CredVault verifier account has been created.",
      `Email: ${email}`,
      `Temporary Password: ${password}`,
      "",
      "Please sign in and change your password from the Profile section.",
      `Login to CredVault: ${loginUrl}`,
    ].join("\n"),
  });
  return true;
}

export async function sendOwnershipVerificationEmail({ email }) {
  await sendEmail({
    to: email,
    subject: "Ownership Verification Request - CredVault",
    html: `
      <p>Hello,</p>
      <p>A verifier has requested ownership verification for one of your certificates.</p>
      <p>Please log in to your CredVault Student Portal and approve the ownership verification request.</p>
      <p>Regards,<br/>CredVault</p>
    `,
    text: [
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
  return true;
}