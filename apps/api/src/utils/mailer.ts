import nodemailer from 'nodemailer';

export function temSMTPConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
}

export async function enviarEmail(opcoes: { to: string; subject: string; html: string; text: string }) {
  if (!temSMTPConfigurado()) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT || '587') === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: opcoes.to,
    subject: opcoes.subject,
    text: opcoes.text,
    html: opcoes.html,
  });

  return true;
}
