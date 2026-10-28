import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { admin, twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { siteConfig } from "@/config/site";
import { requireAuthEnv } from "@/lib/env";
import { getMongoClient, getMongoDb } from "@/server/db/mongo-client";
import { sendEmailInBackground } from "@/server/email/send";
import { passwordResetEmail, verificationEmail } from "@/server/email/templates";
import { ac, roles } from "./access-control";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { isTwoFactorBlocked } from "@/server/policies/access";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

function createAuth() {
  const { secret, baseURL } = requireAuthEnv();

  return betterAuth({
    appName: siteConfig.name,
    baseURL,
    secret,
    database: mongodbAdapter(getMongoDb(), { client: getMongoClient() }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: true, // accounts are created only by invitation or the owner bootstrap script
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: HOUR,
      sendResetPassword: async ({ user, url }) => {
        await sendEmailInBackground({ to: user.email, ...passwordResetEmail({ name: user.name, url }) });
      },
    },

    emailVerification: {
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: HOUR,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailInBackground({ to: user.email, ...verificationEmail({ name: user.name, url }) });
      },
    },

    session: { expiresIn: 7 * DAY, updateAge: DAY },

    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: HOUR, max: 5 },
        "/reset-password": { window: HOUR, max: 10 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
      },
    },

    hooks: {
      // Owner/admin sessions without two-factor must not be able to use the admin API either.
      before: createAuthMiddleware(async (ctx) => {
        if (!ctx.path.startsWith("/admin/")) return;
        const session = await getSessionFromCtx(ctx);
        const user = session?.user as { role?: string | null; twoFactorEnabled?: boolean | null } | undefined;
        const subject = user ? { role: user.role, twoFactorEnabled: user.twoFactorEnabled === true } : null;
        if (isTwoFactorBlocked(subject, ctx.path)) {
          throw new APIError("FORBIDDEN", { message: "Two-factor authentication must be enabled first." });
        }
      }),
    },

    plugins: [
      admin({ ac, roles, defaultRole: "client", adminRoles: ["owner", "admin"] }),
      twoFactor({ issuer: siteConfig.name }),
      nextCookies(), // keep last
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __pscAuth?: Auth };

/** Created on first use (not at import) so builds and tooling never need secrets. */
export function getAuth(): Auth {
  globalForAuth.__pscAuth ??= createAuth();
  return globalForAuth.__pscAuth;
}
