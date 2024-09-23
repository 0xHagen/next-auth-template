import NextAuth, { type DefaultSession } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"

import { db } from "@/lib/db"
import authConfig from "./auth.config"
import { getUserById } from "@/data/user"
import { UserRole } from "@prisma/client"
import { getTwoFactorAuthenticationByUserId } from "./data/two-factor-authentication"

declare module "next-auth" {
  interface Session {
    user: {
      role: "ADMIN" | "USER",
      twoFactorEnabled: boolean
    } & DefaultSession["user"]
  }
}
 
export const { auth, handlers, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/auth/login",
    error: "/auth/error"
  },
  events: {
    async linkAccount({ user }) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() }
      })
    }
  },
  callbacks: {
    async signIn({ user, account}) {
      if (account?.provider !== "credentials") return true;

      const existingUser = await getUserById(user.id as string);

      if (!existingUser?.emailVerified) return false;

      if (existingUser.twoFactorEnabled) {
        const twoFactorAuthentication = await getTwoFactorAuthenticationByUserId(existingUser.id);

        if(!twoFactorAuthentication) return false;

        await db.twoFactorAuthentication.delete({
          where: { id: twoFactorAuthentication.id }
        });
      }

      return true;
    },
    async session({ token, session }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }

      if (token.role && session.user) {
        session.user.role = token.role as UserRole;
      }
      
      if (session.user) {
        session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
      }

      return session;
    },
    async jwt({ token }) {
      if (!token.sub) return token;

      const existingUser = await getUserById(token.sub);

      if (!existingUser) return token;

      token.role = existingUser.role;
      token.twoFactorEnabled = existingUser.twoFactorEnabled;

      return token;
    }
  },
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  ...authConfig,
})