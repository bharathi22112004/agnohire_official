import nodemailer from 'nodemailer';
import { emailService } from './src/services/email.service.js';

async function main() {
  console.log("1. Fetching SMTP config for sector...");
  const customSmtp = await emailService.getSmtpConfig('it-sector-seed-id');
  console.log("Resolved config:", customSmtp);

  if (!customSmtp) {
    console.error("No sector SMTP config found! Check database.");
    return;
  }

  console.log("2. Creating nodemailer transporter...");
  const transporter = nodemailer.createTransport({
    host: customSmtp.smtpHost,
    port: parseInt(customSmtp.smtpPort) || 587,
    secure: parseInt(customSmtp.smtpPort) === 465,
    auth: {
      user: customSmtp.smtpUser,
      pass: customSmtp.smtpPass,
    },
    debug: true,
    logger: true
  });

  console.log("3. Sending test email...");
  const info = await transporter.sendMail({
    from: `"${customSmtp.smtpUser}" <${customSmtp.smtpUser}>`,
    to: "test@company.com",
    subject: "AgnoHire Sector-Scoped SMTP Test Connection",
    html: "<h1>It Works!</h1><p>This email was successfully sent using the global sector SMTP settings you saved in your Admin Configurations page.</p>"
  });

  console.log("SUCCESS! Message sent successfully:", info);
}

main().catch(err => {
  console.error("FAILED! SMTP Error details:", err);
});
