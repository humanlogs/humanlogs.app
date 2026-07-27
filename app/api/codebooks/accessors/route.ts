import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import type { EncryptedDataEntity } from "@/lib/encryption/encryption-entities";

/**
 * Who a codebook must be encrypted for, given its scope: the owner, plus
 * everyone who can already read a document of the studies it covers. Public
 * keys are not secrets, so returning them costs nothing; the AES rewrap itself
 * happens in the browser, which is the only place the private key exists.
 *
 * Query: `?allStudies=1`, or `?studyIds=a,b`. An empty scope yields the owner
 * alone.
 */
export const GET = withAuthRateLimit(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const allStudies = searchParams.get("allStudies") === "1";
    const studyIds = (searchParams.get("studyIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const accessors = new Map<string, { userId: string; publicKey: string }>();

    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { publicKey: true },
    });
    if (owner?.publicKey) {
      accessors.set(owner.publicKey, {
        userId: user.id,
        publicKey: owner.publicKey,
      });
    }

    if (allStudies || studyIds.length > 0) {
      const documents = await prisma.transcription.findMany({
        where: {
          userId: user.id,
          ...(allStudies ? {} : { projectId: { in: studyIds } }),
        },
        select: { transcription: true },
      });

      for (const doc of documents) {
        const entity = doc.transcription as EncryptedDataEntity | null;
        for (const entry of entity?.privateKeys ?? []) {
          if (entry?.publicKey && entry?.userId) {
            accessors.set(entry.publicKey, {
              userId: entry.userId,
              publicKey: entry.publicKey,
            });
          }
        }
      }
    }

    return NextResponse.json({ accessors: Array.from(accessors.values()) });
  } catch (error) {
    console.error("Error resolving codebook accessors:", error);
    return NextResponse.json(
      { error: "Failed to resolve accessors" },
      { status: 500 },
    );
  }
});
