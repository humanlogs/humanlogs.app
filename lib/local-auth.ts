import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { authConfig, ldapConfig } from "./config";
import { prisma } from "./prisma";

const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days

export interface LocalUserSession {
  id: string;
  email: string;
  name?: string;
}

/**
 * Create JWT token for local auth session
 */
async function createSessionToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(
    authConfig.sessionSecret || "fallback-secret-change-in-production",
  );

  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  return token;
}

/**
 * Verify JWT token and return userId
 */
async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(
      authConfig.sessionSecret || "fallback-secret-change-in-production",
    );

    const { payload } = await jwtVerify(token, secret);
    return payload.userId as string;
  } catch {
    return null;
  }
}

/**
 * Authenticate against LDAP server
 * Note: Requires ldapjs package - install with: npm install ldapjs @types/ldapjs
 */
async function authenticateLDAP(
  username: string,
  password: string,
): Promise<{ email: string; name?: string } | null> {
  if (!ldapConfig.enabled) {
    return null;
  }

  try {
    // Lazy load ldapjs only if LDAP is enabled
    // @ts-expect-error - ldapjs is an optional dependency
    const ldap = await import("ldapjs");

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: ldapConfig.url,
      });

      // Bind with service account to search for user
      client.bind(
        ldapConfig.bindDN,
        ldapConfig.bindPassword,
        (bindErr: Error | null) => {
          if (bindErr) {
            client.unbind();
            reject(bindErr);
            return;
          }

          // Search for user
          const searchFilter = ldapConfig.searchFilter.replace(
            "{{username}}",
            username,
          );

          client.search(
            ldapConfig.searchBase,
            {
              filter: searchFilter,
              scope: "sub",
              attributes: ["mail", "cn", "displayName"],
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (searchErr: Error | null, searchRes: any) => {
              if (searchErr) {
                client.unbind();
                reject(searchErr);
                return;
              }

              let userDN: string | null = null;
              let userEmail: string | null = null;
              let userName: string | null = null;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              searchRes.on("searchEntry", (entry: any) => {
                userDN = entry.objectName || null;
                userEmail =
                  (entry.object.mail as string) ||
                  (entry.object.email as string) ||
                  null;
                userName =
                  (entry.object.displayName as string) ||
                  (entry.object.cn as string) ||
                  null;
              });

              searchRes.on("error", (err: Error) => {
                client.unbind();
                reject(err);
              });

              searchRes.on("end", () => {
                if (!userDN || !userEmail) {
                  client.unbind();
                  resolve(null);
                  return;
                }

                // Authenticate user with their password
                client.bind(userDN, password, (authErr: Error | null) => {
                  client.unbind();

                  if (authErr) {
                    resolve(null);
                  } else {
                    resolve({
                      email: userEmail!,
                      name: userName || undefined,
                    });
                  }
                });
              });
            },
          );
        },
      );
    });
  } catch (error) {
    console.error("LDAP authentication error:", error);
    return null;
  }
}

/**
 * Authenticate user with email/password (local database or LDAP)
 */
export async function authenticateLocal(
  email: string,
  password: string,
): Promise<LocalUserSession | null> {
  // Try LDAP first if enabled
  if (ldapConfig.enabled) {
    const ldapUser = await authenticateLDAP(email, password);

    if (ldapUser) {
      // Create or update user in database
      const dbUser = await prisma.user.upsert({
        where: { email: ldapUser.email },
        update: {
          name: ldapUser.name,
          updatedAt: new Date(),
        },
        create: {
          email: ldapUser.email,
          name: ldapUser.name,
          auth0Id: `ldap:${ldapUser.email}`, // Prefix to identify LDAP users
          language: "en",
        },
      });

      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name || undefined,
      };
    }
  }

  // Fall back to local database authentication
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
    },
  });

  if (!user || !user.passwordHash) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
  };
}

/**
 * Register a new local user (not for LDAP users)
 */
export async function registerLocal(
  email: string,
  password: string,
  name?: string,
): Promise<LocalUserSession> {
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user in database
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      auth0Id: `local:${email}`, // Prefix to identify local users
      language: "en",
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
  };
}

/**
 * Get current session from cookies
 */
export async function getLocalSession(): Promise<LocalUserSession | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    return null;
  }

  const userId = await verifySessionToken(sessionToken);

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
  };
}

/**
 * Set session cookie
 */
export async function setLocalSession(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();

  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

/**
 * Clear session cookie
 */
export async function clearLocalSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

/**
 * Require local authentication
 */
export async function requireLocalAuth(): Promise<LocalUserSession> {
  const session = await getLocalSession();

  if (!session) {
    throw new Error("Unauthorized - Please log in");
  }

  return session;
}
