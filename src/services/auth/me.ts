import { findUserById } from '../../repositories/userRepository.js'

export interface MeResponse {
  user: {
    id: string
    email: string
    createdAt: Date
    updatedAt: Date
  }
}

export async function me(userId: string): Promise<MeResponse> {
  if (!userId) {
    throw new Error('User ID is required')
  }

  const user = await findUserById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  }
}
