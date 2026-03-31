import "server-only";

export type EmailProviderName = "console" | "smtp";

export function getEmailFromAddress() {
  return process.env.EMAIL_FROM ?? "MoneyLoop <no-reply@moneyloop.local>";
}

export function getEmailProviderName(): EmailProviderName {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();

  if (provider === "smtp") {
    return "smtp";
  }

  return "console";
}

export function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST ?? "mailpit",
    port: Number(process.env.SMTP_PORT ?? "1025"),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
}
