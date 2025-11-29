import { prisma } from "@/lib/prisma";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { SessionStrategy } from "next-auth";
import { callbacks } from "@/lib/next-auth-callbacks";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_AUTH_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password", placeholder: "••••••••" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const username = credentials.username.toLowerCase();
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: username },
              { name: credentials.username },
            ],
          },
        });

        if (!user) return null;

        if (!user.emailVerified) {
          throw new Error("NOT_VERIFIED");
        }

        if (!user.password) return null;

        const passwordValid = await compare(credentials.password, user.password);
        if (!passwordValid) return null;

        return {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          role: user.role ?? "USER",
          passwordChangedAt: user.passwordChangedAt ?? null,
        } as any;
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET ?? "",
  session: {
    strategy: "jwt" as SessionStrategy,
  },
  callbacks,
};