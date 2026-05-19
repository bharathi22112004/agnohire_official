import { authService } from '../services/auth.service.js';
import { success, error } from '../utils/response.js';
import { generateTokenPair } from '../utils/jwt.js';
import { prisma } from '../configs/db.js';

export const authController = {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const deviceInfo = req.headers['user-agent'];
      const ipAddress = req.ip;

      const result = await authService.login(email, password, deviceInfo, ipAddress);
      
      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return success(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
      });
    } catch (err) {
      return error(res, err.message, 401, 'AUTH_FAILED');
    }
  },

  async refresh(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
      if (!refreshToken) return error(res, 'Refresh token required', 401, 'NO_TOKEN');

      const result = await authService.refreshTokens(refreshToken);

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return success(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
      });
    } catch (err) {
      return error(res, err.message, 401, 'REFRESH_FAILED');
    }
  },

  async logout(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
      await authService.logout(refreshToken);
      res.clearCookie('refreshToken');
      return success(res, { message: 'Logged out successfully' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async me(req, res) {
    return success(res, { user: req.user });
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user.id, currentPassword, newPassword);
      return success(res, { message: 'Password changed successfully' });
    } catch (err) {
      return error(res, err.message, 400, 'PASSWORD_CHANGE_FAILED');
    }
  },

  async googleLogin(req, res) {
    try {
      const { idToken, accessToken: googleAccessToken } = req.body;
      let payload;
      
      if (idToken) {
        const { OAuth2Client } = await import('google-auth-library');
        const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } else if (googleAccessToken) {
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleAccessToken}`);
        if (!response.ok) throw new Error('Failed to fetch user info from Google');
        payload = await response.json();
      }

      if (!payload || !payload.email) return error(res, 'Invalid token', 400);

      const { email, name, sub: googleId, picture } = payload;

      let user = await prisma.user.findUnique({ 
        where: { email },
        include: { role: true, sector: true }
      });

      if (!user) {
        // Create as candidate role by default
        const candidateRole = await prisma.role.findFirst({
          where: { name: 'candidate' },
        });

        user = await prisma.user.create({
          data: {
            name: name || email.split('@')[0],
            email,
            avatarUrl: picture,
            roleId: candidateRole.id,
          },
          include: { role: true, sector: true }
        });
      }

      // Ensure OAuth account is linked
      const oauthAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: googleId,
          },
        },
      });

      if (!oauthAccount) {
        await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'google',
            providerAccountId: googleId,
            accessToken: googleAccessToken || idToken,
          },
        });
      } else {
        await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: { accessToken: googleAccessToken || idToken },
        });
      }

      const tokens = generateTokenPair(user);

      // Save session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: tokens.refreshToken,
          deviceInfo: req.headers['user-agent'],
          ipAddress: req.ip,
          expiresAt,
        },
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return success(res, {
        user,
        accessToken: tokens.accessToken,
      });
    } catch (err) {
      return error(res, 'Google authentication failed: ' + err.message, 400);
    }
  },
};
