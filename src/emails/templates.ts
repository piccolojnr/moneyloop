import "server-only";

function shellHtml({
  title,
  intro,
  body,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  intro: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const cta =
    ctaLabel && ctaUrl
      ? `
        <p style="margin: 24px 0 0;">
          <a
            href="${ctaUrl}"
            style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;"
          >
            ${ctaLabel}
          </a>
        </p>
      `
      : "";

  return `
    <div style="background: #ffffff; color: #111827; font-family: Arial, sans-serif; line-height: 1.6; padding: 32px 20px;">
      <div style="max-width: 600px; margin: 0 auto;">
        <p style="margin: 0 0 20px; font-size: 20px; font-weight: 700;">MoneyLoop</p>
        <h1 style="margin: 0 0 16px; font-size: 24px; line-height: 1.3;">${title}</h1>
        <p style="margin: 0 0 16px;">${intro}</p>
        <div>${body}</div>
        ${cta}
        <p style="margin: 32px 0 0; font-size: 12px; color: #6b7280;">
          MoneyLoop • Community Savings Made Simple
        </p>
      </div>
    </div>
  `;
}

export function buildContributionReminderTemplate({
  name,
  groupName,
  amount,
  cycleNumber,
  payoutDate,
  payNowUrl,
}: {
  name: string;
  groupName: string;
  amount: number;
  cycleNumber: number;
  payoutDate: string;
  payNowUrl: string;
}) {
  return {
    subject: "Reminder: Your MoneyLoop contribution is due",
    text: [
      `Hello ${name},`,
      "",
      `Your contribution for ${groupName} is still pending.`,
      `Cycle #${cycleNumber} is currently collecting contributions.`,
      `Amount due: GHS ${amount.toFixed(2)}`,
      `Scheduled payout date: ${payoutDate}`,
      "",
      `Pay now: ${payNowUrl}`,
      "",
      "MoneyLoop - Community Savings Made Simple",
    ].join("\n"),
    html: shellHtml({
      title: "Your contribution is due",
      intro: `Hello ${name}, this is a reminder that your contribution for ${groupName} is still pending.`,
      body: `
        <p style="margin: 0 0 12px;">Cycle <strong>#${cycleNumber}</strong> is currently collecting contributions.</p>
        <p style="margin: 0 0 12px;">Amount due: <strong>GHS ${amount.toFixed(2)}</strong></p>
        <p style="margin: 0 0 12px;">Scheduled payout date: <strong>${payoutDate}</strong></p>
        <p style="margin: 0;">Please complete your payment as soon as possible to keep the cycle on track.</p>
      `,
      ctaLabel: "Pay now",
      ctaUrl: payNowUrl,
    }),
  };
}

export function buildPayoutNotificationTemplate({
  name,
  groupName,
  amount,
  cycleNumber,
}: {
  name: string;
  groupName: string;
  amount: number;
  cycleNumber: number;
}) {
  return {
    subject: "Your MoneyLoop payout has been sent!",
    text: [
      `Hello ${name},`,
      "",
      `Your MoneyLoop payout for ${groupName} has been sent to your MoMo account.`,
      `Cycle #${cycleNumber} has been processed successfully.`,
      `Amount sent: GHS ${amount.toFixed(2)}`,
      "Please expect the funds to arrive within the next few minutes.",
      "",
      "MoneyLoop - Community Savings Made Simple",
    ].join("\n"),
    html: shellHtml({
      title: "Your payout is on the way",
      intro: `Hello ${name}, congratulations. Your MoneyLoop payout for ${groupName} has been sent to your MoMo account.`,
      body: `
        <p style="margin: 0 0 12px;">Cycle <strong>#${cycleNumber}</strong> has been processed successfully.</p>
        <p style="margin: 0 0 12px;">Amount sent: <strong>GHS ${amount.toFixed(2)}</strong></p>
        <p style="margin: 0;">Please expect the funds to arrive within the next few minutes.</p>
      `,
    }),
  };
}

export function buildGroupInviteTemplate({
  inviterName,
  groupName,
  contributionAmount,
  frequency,
  inviteUrl,
}: {
  inviterName: string;
  groupName: string;
  contributionAmount: number;
  frequency: string;
  inviteUrl: string;
}) {
  return {
    subject: `${inviterName} invited you to join ${groupName} on MoneyLoop`,
    text: [
      `${inviterName} invited you to join ${groupName} on MoneyLoop.`,
      `Contribution amount: GHS ${contributionAmount.toFixed(2)}`,
      `Contribution frequency: ${frequency}`,
      "",
      `Accept invitation: ${inviteUrl}`,
      "",
      "MoneyLoop - Community Savings Made Simple",
    ].join("\n"),
    html: shellHtml({
      title: "You have been invited to join a MoneyLoop group",
      intro: `${inviterName} invited you to join ${groupName} on MoneyLoop.`,
      body: `
        <p style="margin: 0 0 12px;">Contribution amount: <strong>GHS ${contributionAmount.toFixed(2)}</strong></p>
        <p style="margin: 0 0 12px;">Contribution frequency: <strong>${frequency}</strong></p>
        <p style="margin: 0;">Open the invitation to review the group and accept the invite.</p>
      `,
      ctaLabel: "Accept Invitation",
      ctaUrl: inviteUrl,
    }),
  };
}
