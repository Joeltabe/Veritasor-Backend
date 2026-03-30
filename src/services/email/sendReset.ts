import { getMailTransport } from './client.js';

const MAIL_FROM = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? 'noreply@veritasor.local';
const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Send a password reset email. Does not throw; logs errors and optionally returns them
 * so the auth flow is never blocked by email failure.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<{ error?: Error }> {
  const transport = getMailTransport();

  if (!transport) {
    if (IS_DEV) {
      console.info('[email] (dev stub) Password reset link:', resetLink, '→', email);
      return {};
    }
    console.warn('[email] No SMTP config; skipping password reset email to', email);
    return { error: new Error('Email not configured') };
  }

  try {
    await transport.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: 'Reset your password',
      text: `Use this link to reset your password: ${resetLink}`,
      html: `<!DOCTYPE html><html><body><p>Use this link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p></body></html>`,
    });
    return {};
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[email] Failed to send password reset:', error.message, '→', email);
    return { error };
  }
}
