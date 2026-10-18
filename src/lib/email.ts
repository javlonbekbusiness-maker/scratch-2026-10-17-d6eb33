import nodemailer from 'nodemailer';

let transport: nodemailer.Transporter | null = null;

export async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n✉️  [Email mock] → ${to}\nSubject: ${subject}\n${text}\n`);
    return { ok: true };
  }
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
    return { ok: true };
  } catch (e) {
    console.error('[email]', e);
    return { ok: false };
  }
}
