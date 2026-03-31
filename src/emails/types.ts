export type EmailAddress = string | string[];

export type EmailMessage = {
  from: string;
  to: EmailAddress;
  subject: string;
  html: string;
  text: string;
};

export type EmailProvider = {
  name: string;
  send(message: EmailMessage): Promise<void>;
};
