import nodemailer from 'nodemailer';
import { env } from './env.js';

export const mailTransporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

export const mailDefaults = {
  from: `"AgnoHire" <${env.smtp.user}>`,
};
