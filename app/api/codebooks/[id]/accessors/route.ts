import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import type { EncryptedDataEntity } from "@/lib/encryption/encryption-entities";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Replaces the `privateKeys` of a codebook's encrypted content, and nothing
 * else. The wrapped AES keys are computed in the browser when a document of the
 * study is shared — the server cannot do it, it has no private key. Mirrors the
 * surgical update in `app/api/transcriptions/[id]/share/route.ts`.
 */
export const POST = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;
      const body = await request.json();

      const privateKeys = body?.privateKeys;
      if (
        !Array.isArray(privateKeys) ||
        privateKeys.length === 0 ||
        privateKeys.some(
          (entry: unknown) =>
            !entry ||
            typeof entry !== "object" ||
            typeof (entry as { userId?: unknown }).userId !== "string" ||
            typeof (entry as { publicKey?: unknown }).publicKey !== "string" ||
            typeof (entry as { aesKeyEncrypted?: unknown }).aesKeyEncrypted !==
              "string",
        )
      ) {
        return NextResponse.json(
          { error: "privateKeys must be a non-empty list of key entries" },
          { status: 400 },
        );
      }

      const codebook = await prisma.codebook.findFirst({
        where: { id, userId: user.id },
        select: { id: true, content: true },
      });
      if (!codebook) {
        return NextResponse.json(
          { error: "Codebook not found" },
          { status: 404 },
        );
      }

      const content = codebook.content as EncryptedDataEntity | null;
      if (!content?.privateKeys) {
        // Plaintext codebook (owner has no encryption): nothing to rewrap.
        return NextResponse.json({ success: true, encrypted: false });
      }

      await prisma.codebook.update({
        where: { id },
        data: { content: { ...content, privateKeys } as never },
      });

      return NextResponse.json({ success: true, encrypted: true });
    } catch (error) {
      console.error("Error updating codebook accessors:", error);
      return NextResponse.json(
        { error: "Failed to update accessors" },
        { status: 500 },
      );
    }
  },
);
