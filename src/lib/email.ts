import { Resend } from 'resend';

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export interface EmailNotificationData {
  to: string;
  userName: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
}

const getEmailTemplate = (data: EmailNotificationData) => {
  const typeEmojis: Record<string, string> = {
    SYSTEM: '⚙️',
    SECURITY: '🔒',
    PAYMENT: '💳',
    MESSAGE: '💬',
    MENTION: '👤',
    SERVER_UPDATE: '📢',
  };

  const emoji = typeEmojis[data.type] || '📔';

  return {
    subject: `${emoji} ${data.title} - TradersUtopia`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f8f9fa;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #5865f2;
            margin-bottom: 10px;
        }
        .notification-type {
            display: inline-block;
            background: #f3f4f6;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
            margin-bottom: 20px;
        }
        .notification-icon {
            font-size: 48px;
            margin: 20px 0;
        }
        .notification-title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 16px;
        }
        .notification-message {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 30px;
            line-height: 1.7;
        }
        .action-button {
            display: inline-block;
            background: #5865f2;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            transition: background-color 0.2s;
        }
        .action-button:hover {
            background: #4752c4;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
        }
        .unsubscribe-link {
            color: #6b7280;
            text-decoration: none;
            font-size: 12px;
        }
        .security-notice {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }
        .security-notice strong {
            color: #92400e;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏛️ TradersUtopia</div>
            <div class="notification-type">${data.type} Notification</div>
        </div>
        
        <div style="text-align: center;">
            <div class="notification-icon">${emoji}</div>
            <h1 class="notification-title">${data.title}</h1>
            <p class="notification-message">${data.message}</p>
            
            ${
              data.actionUrl
                ? `
                <a href="${data.actionUrl}" class="action-button">
                    Take Action
                </a>
            `
                : ''
            }
        </div>
        
        ${
          data.type === 'SECURITY'
            ? `
            <div class="security-notice">
                <strong>Security Notice:</strong> If you didn't expect this notification, please contact support immediately and review your account security settings.
            </div>
        `
            : ''
        }
        
        <div class="footer">
            <p>Hi ${data.userName},</p>
            <p>This notification was sent to you based on your account preferences.</p>
            <p>You can manage your notification settings in your dashboard.</p>
            <br>
            <p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=settings" class="unsubscribe-link">
                    Manage Notification Preferences
                </a>
            </p>
            <p style="margin-top: 20px; color: #9ca3af; font-size: 12px;">
                © 2024 TradersUtopia. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
    `,
    text: `
${emoji} ${data.title}

Hi ${data.userName},

${data.message}

${data.actionUrl ? `Take action: ${data.actionUrl}` : ''}

---
This notification was sent based on your account preferences.
Manage your settings: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=settings

© 2024 TradersUtopia. All rights reserved.
    `.trim(),
  };
};

export async function sendNotificationEmail(
  data: EmailNotificationData
): Promise<boolean> {
  try {
    // Check if Resend is configured
    if (!resend) {
      console.warn('⚠️ [EMAIL] Resend API key not configured - email not sent');
      console.log(`📧 [EMAIL] Would send to ${data.to}: ${data.title}`);
      return false;
    }

    const emailTemplate = getEmailTemplate(data);

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: data.to,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (result.error) {
      console.error(
        '❌ [EMAIL] Failed to send notification email:',
        result.error
      );
      return false;
    }

    console.log(
      `✅ [EMAIL] Notification sent to ${data.to} - ID: ${result.data?.id}`
    );
    return true;
  } catch (error) {
    console.error('❌ [EMAIL] Error sending notification email:', error);
    return false;
  }
}

export async function sendWelcomeEmail(
  to: string,
  userName: string
): Promise<boolean> {
  if (!resend) {
    console.warn(
      '⚠️ [EMAIL] Resend API key not configured - welcome email not sent'
    );
    return false;
  }

  return sendNotificationEmail({
    to,
    userName,
    type: 'SYSTEM',
    title: 'Welcome to TradersUtopia!',
    message:
      'Your account has been successfully created. Explore the dashboard to set up two-factor authentication and customize your experience.',
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=security`,
  });
}

export async function sendSecurityAlert(
  to: string,
  userName: string,
  message: string
): Promise<boolean> {
  if (!resend) {
    console.warn(
      '⚠️ [EMAIL] Resend API key not configured - security alert not sent'
    );
    return false;
  }

  return sendNotificationEmail({
    to,
    userName,
    type: 'SECURITY',
    title: 'Security Alert',
    message,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=security`,
  });
}
