import "server-only";

import nodemailer from "nodemailer";

import { getSmtpConfig } from "../config";
import type { EmailMessage, EmailProvider } from "../types";

export function createSmtpEmailProvider(): EmailProvider {
  const config = getSmtpConfig();

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user || config.pass
        ? {
            user: config.user,
            pass: config.pass,
          }
        : undefined,
  });

  return {
    name: "smtp",
    async send(message: EmailMessage) {
      await transport.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    },
  };
}
