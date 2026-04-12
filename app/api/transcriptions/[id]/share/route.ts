import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { serverEncryption } from "@/lib/encryption/encryption-entities";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type SharedUser = {
  userId: string;
  role: "read" | "read+listen" | "write";
};

const VALID_ROLES = ["read", "read+listen", "write"];

export const POST = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;
      const body = await request.json();

      // Validate email
      if (!body.email || typeof body.email !== "string") {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 },
        );
      }

      // Validate role
      if (!body.role || !VALID_ROLES.includes(body.role)) {
        return NextResponse.json(
          { error: "Invalid role. Must be one of: read, read+listen, write" },
          { status: 400 },
        );
      }

      // Fetch the transcription
      const transcription = await prisma.transcription.findUnique({
        where: { id },
      });

      // Check if transcription exists
      if (!transcription) {
        return NextResponse.json(
          { error: "Transcription not found" },
          { status: 404 },
        );
      }

      // Check if user owns this transcription
      if (transcription.userId !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Find user by email (case-insensitive)
      const targetUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: body.email.toLowerCase(),
            mode: "insensitive",
          },
        },
      });

      // User not found on platform
      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found on platform", exists: false },
          { status: 404 },
        );
      }

      // Can't share with yourself
      if (targetUser.id === user.id) {
        return NextResponse.json(
          { error: "Cannot share with yourself" },
          { status: 400 },
        );
      }

      // Get current shared list
      const currentShared = (transcription.shared as SharedUser[]) || [];

      // Update or add the user to shared list
      const existingIndex = currentShared.findIndex(
        (s) => s.userId === targetUser.id,
      );

      let updatedShared: SharedUser[];
      if (existingIndex >= 0) {
        // Update existing share
        updatedShared = [...currentShared];
        updatedShared[existingIndex] = {
          userId: targetUser.id,
          role: body.role,
        };
      } else {
        // Add new share
        updatedShared = [
          ...currentShared,
          { userId: targetUser.id, role: body.role },
        ];
      }

      // Prepare update data
      const updateData: any = {
        shared: updatedShared as never,
      };

      // Surgically update encrypted data if provided
      if (body.encryptedData) {
        // Update audioFileEncryption privateKeys if provided
        if (body.encryptedData.audioFileEncryption?.privateKeys) {
          const currentAudioFileEncryption =
            transcription.audioFileEncryption as any;
          if (currentAudioFileEncryption?.privateKeys) {
            updateData.audioFileEncryption = {
              ...currentAudioFileEncryption,
              privateKeys: body.encryptedData.audioFileEncryption.privateKeys,
            };
          }
        }

        // Update transcription privateKeys if provided
        if (body.encryptedData.transcription?.privateKeys) {
          const currentTranscription = transcription.transcription as any;
          if (currentTranscription?.privateKeys) {
            updateData.transcription = {
              ...currentTranscription,
              privateKeys: body.encryptedData.transcription.privateKeys,
            };
          }
        }
      }

      // Update the transcription
      const updated = await prisma.transcription.update({
        where: { id },
        data: updateData,
      });

      // Notify both owner and shared user of the change
      notifyDatabaseChange(user.id, "transcription", "update", { id });
      notifyDatabaseChange(targetUser.id, "transcription", "update", { id });

      return NextResponse.json({
        success: true,
        exists: true,
        userId: targetUser.id,
        shared: updatedShared,
      });
    } catch (error) {
      console.error("Error sharing transcription:", error);
      return NextResponse.json(
        { error: "Failed to share transcription" },
        { status: 500 },
      );
    }
  },
);

export const DELETE = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const userIdToRemove = searchParams.get("userId");

      if (!userIdToRemove) {
        return NextResponse.json(
          { error: "userId query parameter is required" },
          { status: 400 },
        );
      }

      // Fetch the transcription
      const transcription = await prisma.transcription.findUnique({
        where: { id },
      });

      // Check if transcription exists
      if (!transcription) {
        return NextResponse.json(
          { error: "Transcription not found" },
          { status: 404 },
        );
      }

      // Check if user owns this transcription
      if (transcription.userId !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Get current shared list
      const currentShared = (transcription.shared as SharedUser[]) || [];

      // Remove user from shared list
      const updatedShared = currentShared.filter(
        (s) => s.userId !== userIdToRemove,
      );

      // Prepare update data
      const updateData: any = {
        shared:
          updatedShared.length > 0 ? (updatedShared as never) : (null as never),
      };

      // Use serverEncryption to unshare encrypted data
      if (serverEncryption) {
        // Unshare audioFileEncryption if it exists and has privateKeys
        if (transcription.audioFileEncryption) {
          const currentAudioFileEncryption =
            transcription.audioFileEncryption as any;
          if (currentAudioFileEncryption?.privateKeys) {
            updateData.audioFileEncryption = await serverEncryption.unshare(
              currentAudioFileEncryption,
              userIdToRemove,
            );
          }
        }

        // Unshare transcription data if it exists and has privateKeys
        if (transcription.transcription) {
          const currentTranscription = transcription.transcription as any;
          if (currentTranscription?.privateKeys) {
            updateData.transcription = await serverEncryption.unshare(
              currentTranscription,
              userIdToRemove,
            );
          }
        }
      }

      // Update the transcription
      await prisma.transcription.update({
        where: { id },
        data: updateData,
      });

      // Notify both owner and removed user of the change
      notifyDatabaseChange(user.id, "transcription", "update", { id });
      notifyDatabaseChange(userIdToRemove, "transcription", "update", { id });

      return NextResponse.json({ success: true, shared: updatedShared });
    } catch (error) {
      console.error("Error removing share:", error);
      return NextResponse.json(
        { error: "Failed to remove share" },
        { status: 500 },
      );
    }
  },
);
