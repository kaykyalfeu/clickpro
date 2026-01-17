import crypto from "crypto";
import type { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

// Role enum matching prisma schema
export type Role = "SUPER_ADMIN" | "CLIENT_ADMIN" | "CLIENT_USER";

// Reuse the same hash algorithm from seed-admin.ts
function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const computed = crypto
    .pbkdf2Sync(password, salt, 120000, 32, "sha256")
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  clientId: string | null;
  clientName: string | null;
}

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
  interface User extends SessionUser {}
}

declare module "next-auth/jwt" {
  interface JWT extends SessionUser {}
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            memberships: {
              include: { client: true },
              take: 1,
            },
          },
        });

        if (!user) {
          return null;
        }

        const isValid = verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // SUPER_ADMIN has no client, CLIENT_ADMIN/CLIENT_USER have a client
        const membership = user.memberships?.[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: membership?.clientId ?? null,
          clientName: membership?.client?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.clientId = user.clientId;
        token.clientName = user.clientName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email ?? "",
        name: token.name ?? null,
        role: token.role,
        clientId: token.clientId,
        clientName: token.clientName,
      };
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Helper to check if user is SUPER_ADMIN
export function isSuperAdmin(session: Session | null): boolean {
  return session?.user?.role === "SUPER_ADMIN";
}

// Helper to check if user is CLIENT_ADMIN
export function isClientAdmin(session: Session | null): boolean {
  return session?.user?.role === "CLIENT_ADMIN";
}

// Helper to check if user is at least CLIENT_ADMIN (CLIENT_ADMIN or SUPER_ADMIN)
export function isAtLeastClientAdmin(session: Session | null): boolean {
  const role = session?.user?.role;
  return role === "SUPER_ADMIN" || role === "CLIENT_ADMIN";
}

// Helper to get clientId from session (null for SUPER_ADMIN)
export function getSessionClientId(session: Session | null): string | null {
  return session?.user?.clientId ?? null;
}

// Helper to check if user can access a specific client's data
export function canAccessClient(session: Session | null, clientId: string): boolean {
  if (!session?.user) return false;

  // SUPER_ADMIN can access any client
  if (session.user.role === "SUPER_ADMIN") return true;

  // Others can only access their own client
  return session.user.clientId === clientId;
}

// Helper to get the effective clientId for operations
// For SUPER_ADMIN: uses provided clientId or returns null
// For others: always uses their own clientId (ignores provided)
export function getEffectiveClientId(
  session: Session | null,
  requestedClientId?: string | null
): string | null {
  if (!session?.user) return null;

  if (session.user.role === "SUPER_ADMIN") {
    return requestedClientId ?? null;
  }

  return session.user.clientId;
}
