import "server-only";

import { sendEmail } from "./send";
import {
  buildContributionReminderTemplate,
  buildGroupInviteTemplate,
  buildPayoutNotificationTemplate,
} from "./templates";

export async function sendContributionReminder({
  to,
  name,
  groupName,
  amount,
  cycleNumber,
  payoutDate,
  payNowUrl,
}: {
  to: string;
  name: string;
  groupName: string;
  amount: number;
  cycleNumber: number;
  payoutDate: string;
  payNowUrl: string;
}) {
  await sendEmail({
    to,
    ...buildContributionReminderTemplate({
      name,
      groupName,
      amount,
      cycleNumber,
      payoutDate,
      payNowUrl,
    }),
  });
}

export async function sendPayoutNotification({
  to,
  name,
  groupName,
  amount,
  cycleNumber,
}: {
  to: string;
  name: string;
  groupName: string;
  amount: number;
  cycleNumber: number;
}) {
  await sendEmail({
    to,
    ...buildPayoutNotificationTemplate({
      name,
      groupName,
      amount,
      cycleNumber,
    }),
  });
}

export async function sendGroupInvite({
  to,
  inviterName,
  groupName,
  contributionAmount,
  frequency,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  groupName: string;
  contributionAmount: number;
  frequency: string;
  inviteUrl: string;
}) {
  await sendEmail({
    to,
    ...buildGroupInviteTemplate({
      inviterName,
      groupName,
      contributionAmount,
      frequency,
      inviteUrl,
    }),
  });
}
