const nodemailer = require('nodemailer');

function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM,
  );
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT);
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    (process.env.SMTP_SECURE !== 'false' && port === 465);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const transporter = createTransport();
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'Reset your MediGo password',
    text: [
      'A password reset was requested for your MediGo account.',
      '',
      'Open this link on your phone to choose a new password:',
      resetUrl,
      '',
      'This link expires in 1 hour.',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>A password reset was requested for your MediGo account.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    `,
  });
}

module.exports = { isMailConfigured, sendPasswordResetEmail };
