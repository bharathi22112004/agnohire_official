import { prisma } from '../configs/db.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { userRepository } from '../repositories/user.repository.js';

export const authService = {
  async login(email, password, deviceInfo, ipAddress) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) throw new Error('Account is inactive');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    const tokens = generateTokenPair(user);

    // Store refresh token session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        deviceInfo,
        ipAddress,
        expiresAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        role: user.role?.name,
        ipAddress,
        deviceInfo,
        actionType: 'LOGIN',
        entity: 'users',
        entityId: user.id,
      },
    });

    return { user: sanitizeUser(user), tokens };
  },

  async refreshTokens(refreshToken) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new Error('Invalid refresh token');
    }

    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { include: { role: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Session expired or not found');
    }

    const tokens = generateTokenPair(session.user);

    // Rotate refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: tokens.refreshToken, expiresAt },
    });

    return { user: sanitizeUser(session.user), tokens };
  },

  async logout(refreshToken) {
    if (!refreshToken) return;
    await prisma.session.deleteMany({ where: { refreshToken } });
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new Error('User not found');

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revoke all sessions
    await prisma.session.deleteMany({ where: { userId } });
  },
};

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}
