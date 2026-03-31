import "server-only";

import { getEmailProviderName } from "./config";
import { createConsoleEmailProvider } from "./providers/console";
import { createSmtpEmailProvider } from "./providers/smtp";
import type { EmailProvider } from "./types";

let provider: EmailProvider | null = null;

export function getEmailProvider() {
  if (provider) {
    return provider;
  }

  provider =
    getEmailProviderName() === "console"
      ? createConsoleEmailProvider()
      : createSmtpEmailProvider();

  return provider;
}
