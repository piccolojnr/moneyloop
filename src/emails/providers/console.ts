import "server-only";

import type { EmailMessage, EmailProvider } from "../types";

export function createConsoleEmailProvider(): EmailProvider {
  return {
    name: "console",
    async send(message: EmailMessage) {
      //  clean print no html content, only text
      console.log("=== Email Message ===");
      console.log(`Sending email to ${message.to} with subject "${message.subject}"`);
      console.log("Email content:");
      console.log(message.text);
      console.log("=====================");
    },
  };
}
