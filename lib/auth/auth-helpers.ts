import { prisma } from "../prisma";
import { getAuth0Client } from "./auth0";
import { getLocalSession } from "./local-auth";
import { authConfig } from "../config";
import { processReferralOnSignup } from "../referral";

export interface UserSession {
  id: string;
  auth0Id?: string;
  email: string;
  name?: string;
}

/**
 * Get the current authenticated user from the session
 * and ensure they exist in our database
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  // Use local auth if mode is set to "local"
  if (authConfig.mode === "local") {
    const localSession = await getLocalSession();
    if (!localSession) {
      return null;
    }

    return {
      id: localSession.id,
      email: localSession.email,
      name: localSession.name,
    };
  }

  // Otherwise use Auth0
  const auth0 = getAuth0Client();
  const session = await auth0.getSession();

  if (!session?.user) {
    return null;
  }

  const auth0User = session.user;

  // Detect default language from Auth0 user locale or default to 'en'
  const defaultLanguage = auth0User.locale?.substring(0, 2) || "en";

  // Detect whether this is a brand new user so we can process referrals
  const existingUser = await prisma.user.findUnique({
    where: { auth0Id: auth0User.sub },
    select: { id: true },
  });

  const profileUpdate = {
    ...(auth0User.email && { email: auth0User.email }),
    name: auth0User.name,
    ...(auth0User.picture && { picture: auth0User.picture }),
    updatedAt: new Date(),
  };

  // Some OAuth providers (e.g. LinkedIn) may not expose the user's email.
  const emailForCreate = auth0User.email ?? `${auth0User.sub}@noemail.invalid`;

  let dbUser: Awaited<ReturnType<typeof prisma.user.upsert>>;
  try {
    dbUser = await prisma.user.upsert({
      where: { auth0Id: auth0User.sub },
      update: profileUpdate,
      create: {
        auth0Id: auth0User.sub,
        email: emailForCreate,
        name: auth0User.name,
        ...(auth0User.picture && { picture: auth0User.picture }),
        language: defaultLanguage,
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation. This happens when the same email already
    // exists under a different auth0Id (e.g. user previously signed in via Google,
    // now signing in via LinkedIn). Link the existing account to the new sub.
    if (
      err instanceof Error &&
      "code" in err &&
      (err as any).code === "P2002" &&
      auth0User.email
    ) {
      dbUser = await prisma.user.update({
        where: { email: auth0User.email },
        data: { auth0Id: auth0User.sub, ...profileUpdate },
      });
    } else {
      throw err;
    }
  }

  // Grant referral bonus to whoever invited this email (only on first login/signup)
  if (!existingUser && dbUser.email) {
    await processReferralOnSignup({ id: dbUser.id, email: dbUser.email });
  }

  return {
    id: dbUser.id,
    auth0Id: dbUser.auth0Id,
    email: dbUser.email,
    name: dbUser.name || undefined,
  };
}

/**
 * Require authentication - throws error if user is not logged in
 */
export async function requireAuth(): Promise<UserSession> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized - Please log in");
  }

  return user;
}
