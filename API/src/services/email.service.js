import nodemailer from 'nodemailer';
import { mailTransporter, mailDefaults } from '../configs/mail.js';
import { prisma } from '../configs/db.js';
import { logger } from '../utils/logger.js';

export const emailService = {
  async sendEmail({ to, subject, html, templateId, candidateId, customSmtp }) {
    try {
      let transporter = mailTransporter;
      let from = mailDefaults.from;

      if (customSmtp && customSmtp.smtpHost && customSmtp.smtpUser && customSmtp.smtpPass) {
        transporter = nodemailer.createTransport({
          host: customSmtp.smtpHost,
          port: parseInt(customSmtp.smtpPort) || 587,
          secure: parseInt(customSmtp.smtpPort) === 465,
          auth: {
            user: customSmtp.smtpUser,
            pass: customSmtp.smtpPass,
          },
        });
        from = `"${customSmtp.smtpUser}" <${customSmtp.smtpUser}>`;
      }

      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      // Log email
      await prisma.emailLog.create({
        data: {
          templateId,
          toEmail: to,
          candidateId,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      return true;
    } catch (err) {
      logger.error(`Email send failed to ${to}: ${err.message}`);

      await prisma.emailLog.create({
        data: {
          templateId,
          toEmail: to,
          candidateId,
          status: 'failed',
          error: err.message,
        },
      });

      throw err;
    }
  },

  async getSmtpConfig(sectorId) {
    if (!sectorId) return null;
    try {
      const keys = [
        `smtp_host_${sectorId}`,
        `smtp_port_${sectorId}`,
        `smtp_user_${sectorId}`,
        `smtp_pass_${sectorId}`
      ];
      const configs = await prisma.systemConfiguration.findMany({
        where: { key: { in: keys } }
      });
      const obj = {};
      configs.forEach(c => {
        obj[c.key] = c.value;
      });

      const host = obj[`smtp_host_${sectorId}`];
      const port = obj[`smtp_port_${sectorId}`];
      const user = obj[`smtp_user_${sectorId}`];
      const pass = obj[`smtp_pass_${sectorId}`];

      if (host && user && pass) {
        return {
          smtpHost: host,
          smtpPort: parseInt(port) || 587,
          smtpUser: user,
          smtpPass: pass
        };
      }
    } catch (err) {
      logger.error(`Error loading SMTP config for sector ${sectorId}: ${err.message}`);
    }
    return null;
  },

  async sendInterviewInvite({ candidate, recruiter, schedule, linkToken }) {
    const recruiterId = recruiter?.id || '';
    const interviewLink = `${process.env.CLIENT_URL}/interview?token=${linkToken}&rid=${recruiterId}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'DM Sans', -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 40px; color: white; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
            .header p { margin: 8px 0 0; opacity: 0.9; }
            .body { padding: 40px; }
            .info-card { background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .info-row:last-child { border-bottom: none; }
            .label { color: #64748b; font-size: 14px; }
            .value { color: #0f172a; font-weight: 600; font-size: 14px; }
            .btn { display: block; background: #6366f1; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; text-align: center; font-weight: 600; font-size: 16px; margin: 32px 0; }
            .footer { background: #f8fafc; padding: 24px 40px; text-align: center; color: #64748b; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AgnoHire</h1>
              <p>Recruitment Platform</p>
            </div>
            <div class="body">
              <h2 style="color: #0f172a; margin-top: 0;">Interview Invitation</h2>
              <p style="color: #475569;">Dear <strong>${candidate.name}</strong>,</p>
              <p style="color: #475569;">You have been invited to complete an interview. Please review the details below and click the button to begin your session.</p>

              <div class="info-card">
                <div class="info-row">
                  <span class="label">Interviewer</span>
                  <span class="value">${recruiter.name}</span>
                </div>
                <div class="info-row">
                  <span class="label">Scheduled Date</span>
                  <span class="value">${new Date(schedule.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Time</span>
                  <span class="value">${schedule.timeStart} – ${schedule.timeEnd}</span>
                </div>
              </div>

              <p style="color: #475569; font-size: 14px;"><strong>Instructions:</strong> Ensure you are in a well-lit, quiet environment. You will need a working webcam and microphone. The link below is unique to you and should not be shared.</p>

              <p style="color: #475569; margin: 24px 0 8px; font-size: 14px;">Click the secure link below to launch your assessment session:</p>
              <div style="word-break: break-all; margin: 8px 0 24px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px dashed #cbd5e1; font-family: monospace; text-align: center; font-size: 13px;">
                <a href="${interviewLink}" style="color: #4f46e5; font-weight: bold; text-decoration: underline;">${interviewLink}</a>
              </div>

              <p style="color: #94a3b8; font-size: 12px;">If you did not expect this invitation, please contact us immediately. This link will expire after your scheduled time.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} AgnoHire — Recruitment Platform</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const customSmtp = await this.getSmtpConfig(candidate.sectorId || recruiter?.sectorId);

    return this.sendEmail({
      to: candidate.email,
      subject: `Interview Invitation — ${new Date(schedule.date).toLocaleDateString()}`,
      html,
      candidateId: candidate.id,
      customSmtp
    });
  },

  async sendResultEmail({ candidate, decision, feedback, recruiter }) {
    const colors = {
      pass: '#10b981',
      fail: '#f43f5e',
      hold: '#f59e0b',
    };

    const messages = {
      pass: 'Congratulations! You have successfully passed the interview.',
      fail: 'Thank you for your participation. Unfortunately, we will not be moving forward at this time.',
      hold: 'Thank you for your interview. Your application is currently under review.',
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, ${colors[decision]} 0%, ${colors[decision]}cc 100%); padding: 40px; color: white; text-align: center; }
            .body { padding: 40px; }
            .status-badge { display: inline-block; background: ${colors[decision]}22; color: ${colors[decision]}; padding: 8px 20px; border-radius: 99px; font-weight: 700; font-size: 16px; text-transform: uppercase; margin: 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Interview Result</h1></div>
            <div class="body">
              <p>Dear <strong>${candidate.name}</strong>,</p>
              <div class="status-badge">${decision.toUpperCase()}</div>
              <p>${messages[decision]}</p>
              ${feedback ? `<p><strong>Feedback:</strong> ${feedback}</p>` : ''}
              <p style="color: #64748b; font-size: 13px;">Regards,<br/>AgnoHire Recruitment Team</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const customSmtp = await this.getSmtpConfig(candidate.sectorId || recruiter?.sectorId);

    return this.sendEmail({
      to: candidate.email,
      subject: `Interview Result — ${decision.toUpperCase()}`,
      html,
      candidateId: candidate.id,
      customSmtp
    });
  },
};
