import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/socket-helpers";

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

      // Update the transcription
      const updated = await prisma.transcription.update({
        where: { id },
        data: {
          shared: updatedShared as never,
        },
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

      // Update the transcription
      await prisma.transcription.update({
        where: { id },
        data: {
          shared:
            updatedShared.length > 0
              ? (updatedShared as never)
              : (null as never),
        },
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
