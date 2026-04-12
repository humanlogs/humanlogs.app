import { prisma } from "../prisma";
import { getAuth0Client } from "./auth0";
import { getLocalSession } from "./local-auth";
import { authConfig } from "../config";

export interface UserSession {
  id: string;
  auth0Id?: string;
  email: string;
  name?: string;
}

/**
 * Fetch an image from a URL and convert it to base64
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.statusText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
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

  // Fetch and convert profile picture to base64 if available
  let pictureBase64: string | null = null;
  if (auth0User.picture) {
    pictureBase64 = await fetchImageAsBase64(auth0User.picture);
  }

  // Ensure user exists in database (create or update)
  const dbUser = await prisma.user.upsert({
    where: { auth0Id: auth0User.sub },
    update: {
      email: auth0User.email,
      name: auth0User.name,
      ...(pictureBase64 && { picture: pictureBase64 }),
      updatedAt: new Date(),
    },
    create: {
      auth0Id: auth0User.sub,
      email: auth0User.email!,
      name: auth0User.name,
      ...(pictureBase64 && { picture: pictureBase64 }),
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
