import { findUserByEmail, setResetToken } from '../../repositories/userRepository.js'
import { randomBytes } from 'crypto'

export interface ForgotPasswordRequest {
  email: string
}

export interface ForgotPasswordResponse {
  message: string
  resetLink?: string // For development/testing only
}

/**
 * Generate a password reset token and send it via email stub
 * In production, this would send an actual email
 */
export async function forgotPassword(
  request: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> {
  const { email } = request

  if (!email) {
    throw new Error('Email is required')
  }

  const user = await findUserByEmail(email)
  if (!user) {
    // Don't reveal whether email exists for security
    return {
      message: 'If an account with this email exists, a reset link has been sent',
    }
  }

  // Generate reset token
  const resetToken = randomBytes(32).toString('hex')
  await setResetToken(user.id, resetToken, 30) // 30 minute expiry

  // Email service stub - just log the reset link
  const resetLink = `${process.env.RESET_PASSWORD_URL ?? 'http://localhost:3000/reset-password'}?token=${resetToken}`
  console.log(`[EMAIL STUB] Password reset link for ${email}: ${resetLink}`)

  // Return reset link only in development
  const isDev = process.env.NODE_ENV !== 'production'

  return {
    message: 'If an account with this email exists, a reset link has been sent',
    ...(isDev && { resetLink }),
  }
}
