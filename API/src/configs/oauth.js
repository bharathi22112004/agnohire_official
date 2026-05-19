import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './db.js';
import { env } from './env.js';

export function configurePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.google.clientId,
        clientSecret: env.google.clientSecret,
        callbackURL: env.google.callbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google'), null);

          // Check existing OAuth account
          let oauthAccount = await prisma.oAuthAccount.findUnique({
            where: {
              provider_providerAccountId: {
                provider: 'google',
                providerAccountId: profile.id,
              },
            },
            include: { user: true },
          });

          if (oauthAccount) {
            // Update access token
            await prisma.oAuthAccount.update({
              where: { id: oauthAccount.id },
              data: { accessToken },
            });
            return done(null, oauthAccount.user);
          }

          // Find user by email
          let user = await prisma.user.findUnique({ where: { email } });

          if (!user) {
            // Create as candidate role by default
            const candidateRole = await prisma.role.findFirst({
              where: { name: 'candidate' },
            });

            user = await prisma.user.create({
              data: {
                name: profile.displayName || email.split('@')[0],
                email,
                avatarUrl: profile.photos?.[0]?.value,
                roleId: candidateRole.id,
              },
            });
          }

          // Create OAuth link
          await prisma.oAuthAccount.create({
            data: {
              userId: user.id,
              provider: 'google',
              providerAccountId: profile.id,
              accessToken,
            },
          });

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}
