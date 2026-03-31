import "server-only";

import { getEmailFromAddress } from "./config";
import { getEmailProvider } from "./provider";
import type { EmailAddress } from "./types";

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: EmailAddress;
  subject: string;
  html: string;
  text: string;
}) {
  const provider = getEmailProvider();

  await provider.send({
    from: getEmailFromAddress(),
    to,
    subject,
    html,
    text,
  });
}
