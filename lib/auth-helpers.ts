import { prisma } from "./prisma";
import { auth0 } from "./auth0";

export interface UserSession {
  id: string;
  auth0Id: string;
  email: string;
  name?: string;
}

/**
 * Get the current authenticated user from the session
 * and ensure they exist in our database
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  const session = await auth0.getSession();

  if (!session?.user) {
    return null;
  }

  const auth0User = session.user;

  // Detect default language from Auth0 user locale or default to 'en'
  const defaultLanguage = auth0User.locale?.substring(0, 2) || "en";

  // Ensure user exists in database (create or update)
  const dbUser = await prisma.user.upsert({
    where: { auth0Id: auth0User.sub },
    update: {
      email: auth0User.email,
      name: auth0User.name,
      updatedAt: new Date(),
    },
    create: {
      auth0Id: auth0User.sub,
      email: auth0User.email!,
      name: auth0User.name,
      language: defaultLanguage, // Set default language on signup
    },
  });

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
