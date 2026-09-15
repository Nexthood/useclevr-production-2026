import { debugLog } from "@/lib/utils/debug";

const SUBSCRIPTION_EMAIL_FROM = process.env.EMAIL_FROM || "UseClevr <no-reply@useclevr.com>";

export type SubscriptionEmailType = "subscription_activation" | "subscription_cancellation" | "subscription_cancellation_scheduled";

export interface SendSubscriptionActivationEmailParams {
  to: string;
  planName: "Pro" | "Business";
  billingInterval: "monthly" | "yearly";
  amount: number;
  currency: string;
  activatedAt: string;
  nextBillingDate?: string;
  dashboardUrl: string;
}

export interface SendSubscriptionCancellationEmailParams {
  to: string;
  planName: "Pro" | "Business";
  canceledAt: string;
  datasetsPreserved: boolean;
  purchasedCreditsPreserved: boolean;
  dashboardUrl: string;
}

export interface SendSubscriptionCancellationScheduledEmailParams {
  to: string;
  planName: "Pro" | "Business";
  currentPeriodEnd: string;
  dashboardUrl: string;
}

export async function sendSubscriptionActivationEmail(
  params: SendSubscriptionActivationEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, planName, billingInterval, amount, currency, activatedAt, nextBillingDate, dashboardUrl } = params;

  const subject = `Your ${planName} subscription is now active`;
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; color: #0ea5e9;">UseClevr</h1>
  </div>

  <h2 style="color: #1a1a1a;">Your ${planName} subscription is now active!</h2>

  <p>Thank you for subscribing to UseClevr ${planName}. Your subscription has been successfully activated.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Plan</td>
        <td style="padding: 8px 0; font-weight: 600;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Billing</td>
        <td style="padding: 8px 0;">${billingInterval}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Amount</td>
        <td style="padding: 8px 0;">${formattedAmount}/${billingInterval === "monthly" ? "month" : "year"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Activated</td>
        <td style="padding: 8px 0;">${new Date(activatedAt).toLocaleDateString()}</td>
      </tr>
      ${nextBillingDate ? `
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Next billing</td>
        <td style="padding: 8px 0;">${new Date(nextBillingDate).toLocaleDateString()}</td>
      </tr>
      ` : ""}
    </table>
  </div>

  <p>Your UseClevr subscription gives you access to AI-powered business analytics that transforms your business data into KPIs, visualizations, trends, and actionable insights. Available features depend on your selected plan.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
  </div>

  <p style="color: #64748b; font-size: 14px;">
    You can manage your subscription at any time from your <a href="${dashboardUrl}" style="color: #0ea5e9;">subscription settings</a>.
  </p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

  <p style="color: #94a3b8; font-size: 12px;">
    This email was sent to ${to}. If you have questions, contact us at support@useclevr.com.
  </p>
</body>
</html>
`;

  const text = `
Your ${planName} subscription is now active!

Thank you for subscribing to UseClevr ${planName}. Your subscription has been successfully activated.

Plan: ${planName}
Billing: ${billingInterval}
Amount: ${formattedAmount}/${billingInterval === "monthly" ? "month" : "year"}
Activated: ${new Date(activatedAt).toLocaleDateString()}
${nextBillingDate ? `Next billing: ${new Date(nextBillingDate).toLocaleDateString()}` : ""}

Your UseClevr subscription gives you access to AI-powered business analytics that transforms your business data into KPIs, visualizations, trends, and actionable insights.

Go to your dashboard: ${dashboardUrl}

You can manage your subscription at any time from your subscription settings.
`;

  return sendEmail({
    to,
    subject,
    html,
    text,
    emailType: "subscription_activation",
  });
}

export async function sendSubscriptionCancellationEmail(
  params: SendSubscriptionCancellationEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, planName, canceledAt, datasetsPreserved, purchasedCreditsPreserved, dashboardUrl } = params;

  const subject = `Your ${planName} subscription has been cancelled`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; color: #0ea5e9;">UseClevr</h1>
  </div>

  <h2 style="color: #1a1a1a;">Subscription Cancelled</h2>

  <p>Your ${planName} subscription has been cancelled. Your account has been transitioned to the Free plan.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Previous Plan</td>
        <td style="padding: 8px 0; font-weight: 600;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Cancelled</td>
        <td style="padding: 8px 0;">${new Date(canceledAt).toLocaleDateString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Datasets</td>
        <td style="padding: 8px 0;">${datasetsPreserved ? "Preserved" : "Removed"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Purchased Credits</td>
        <td style="padding: 8px 0;">${purchasedCreditsPreserved ? "Preserved" : "Removed"}</td>
      </tr>
    </table>
  </div>

  <p>Your existing datasets have been preserved. You can continue to use UseClevr with the Free plan, which includes:</p>
  <ul>
    <li>Up to 2 datasets</li>
    <li>5,000 rows per dataset</li>
    <li>Basic AI analysis features</li>
  </ul>

  <p>Your purchased credits (if any) remain available for use.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
  </div>

  <p style="color: #64748b; font-size: 14px;">
    We hope you enjoyed your time on the ${planName} plan. You're welcome to upgrade again anytime from your <a href="${dashboardUrl}" style="color: #0ea5e9;">subscription settings</a>.
  </p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

  <p style="color: #94a3b8; font-size: 12px;">
    This email was sent to ${to}. If you have questions, contact us at support@useclevr.com.
  </p>
</body>
</html>
`;

  const text = `
Subscription Cancelled

Your ${planName} subscription has been cancelled. Your account has been transitioned to the Free plan.

Previous Plan: ${planName}
Cancelled: ${new Date(canceledAt).toLocaleDateString()}
Datasets: ${datasetsPreserved ? "Preserved" : "Removed"}
Purchased Credits: ${purchasedCreditsPreserved ? "Preserved" : "Removed"}

Your existing datasets have been preserved. You can continue to use UseClevr with the Free plan, which includes up to 2 datasets, 5,000 rows per dataset, and basic AI analysis features.

Your purchased credits (if any) remain available for use.

Go to your dashboard: ${dashboardUrl}

We hope you enjoyed your time on the ${planName} plan. You're welcome to upgrade again anytime.
`;

  return sendEmail({
    to,
    subject,
    html,
    text,
    emailType: "subscription_cancellation",
  });
}

export async function sendSubscriptionCancellationScheduledEmail(
  params: SendSubscriptionCancellationScheduledEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, planName, currentPeriodEnd, dashboardUrl } = params;

  const subject = `Your ${planName} subscription will cancel at period end`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; color: #0ea5e9;">UseClevr</h1>
  </div>

  <h2 style="color: #1a1a1a;">Subscription Cancellation Scheduled</h2>

  <p>Your ${planName} subscription is scheduled to cancel at the end of your billing period.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Current Plan</td>
        <td style="padding: 8px 0; font-weight: 600;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Access Until</td>
        <td style="padding: 8px 0;">${new Date(currentPeriodEnd).toLocaleDateString()}</td>
      </tr>
    </table>
  </div>

  <p>Your ${planName} benefits will remain active until ${new Date(currentPeriodEnd).toLocaleDateString()}. After that, your account will transition to the Free plan.</p>

  <p>You can cancel this scheduled cancellation anytime before the period ends.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

  <p style="color: #94a3b8; font-size: 12px;">
    This email was sent to ${to}. If you have questions, contact us at support@useclevr.com.
  </p>
</body>
</html>
`;

  const text = `
Subscription Cancellation Scheduled

Your ${planName} subscription is scheduled to cancel at the end of your billing period.

Current Plan: ${planName}
Access Until: ${new Date(currentPeriodEnd).toLocaleDateString()}

Your ${planName} benefits will remain active until ${new Date(currentPeriodEnd).toLocaleDateString()}. After that, your account will transition to the Free plan.

You can cancel this scheduled cancellation anytime before the period ends.

Go to your dashboard: ${dashboardUrl}
`;

  return sendEmail({
    to,
    subject,
    html,
    text,
    emailType: "subscription_cancellation_scheduled",
  });
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  emailType: SubscriptionEmailType;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production" || process.env.EMAIL_PROVIDER === "console") {
      debugLog(`[Email] ${params.emailType} email (console mode)`, {
        to: params.to,
        subject: params.subject,
      });
      return { success: true };
    }
    console.error(`[Email] ${params.emailType} failed: RESEND_API_KEY not configured`);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SUBSCRIPTION_EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });

    const body = await response.json().catch(() => ({}));
    const messageId = typeof body?.id === "string" ? body.id : "";

    console.warn(`[Email] ${params.emailType} result`, {
      status: response.status,
      ok: response.ok,
      messageIdReturned: Boolean(messageId),
    });

    if (!response.ok) {
      const errorMsg = body?.message || body?.error || `HTTP ${response.status}`;
      console.error(`[Email] ${params.emailType} failed:`, errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: true, messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Email] ${params.emailType} exception:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}
