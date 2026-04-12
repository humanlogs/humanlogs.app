import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

export type CustomShortcut = {
  id: string;
  key: string;
  text: string;
  description?: string;
};

// GET /api/user/shortcuts - Get user's custom shortcuts
export const GET = withAuthRateLimit(async (request, user) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { shortcuts: true as any },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const shortcuts = (dbUser.shortcuts as CustomShortcut[]) || [];
    return NextResponse.json({ shortcuts });
  } catch (error) {
    console.error("Error fetching shortcuts:", error);
    return NextResponse.json(
      { error: "Failed to fetch shortcuts" },
      { status: 500 },
    );
  }
});

// POST /api/user/shortcuts - Add or update a shortcut
export const POST = withAuthRateLimit(async (request, user) => {
  try {
    const body = await request.json();

    const { key, text, description } = body;

    if (!key || !text) {
      return NextResponse.json(
        { error: "Key and text are required" },
        { status: 400 },
      );
    }

    // Get current shortcuts
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { shortcuts: true as any },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const shortcuts = (dbUser.shortcuts as CustomShortcut[]) || [];
    const newShortcut: CustomShortcut = {
      id: Date.now().toString(),
      key,
      text,
      description,
    };

    // Check if key already exists and replace it
    const existingIndex = shortcuts.findIndex((s) => s.key === key);
    if (existingIndex !== -1) {
      shortcuts[existingIndex] = newShortcut;
    } else {
      shortcuts.push(newShortcut);
    }

    // Update user with new shortcuts
    await prisma.user.update({
      where: { id: user.id },
      data: { shortcuts: shortcuts as any },
    });

    return NextResponse.json({ shortcut: newShortcut });
  } catch (error) {
    console.error("Error adding shortcut:", error);
    return NextResponse.json(
      { error: "Failed to add shortcut" },
      { status: 500 },
    );
  }
});

// DELETE /api/user/shortcuts?id=... - Delete a shortcut
export const DELETE = withAuthRateLimit(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Shortcut ID is required" },
        { status: 400 },
      );
    }

    // Get current shortcuts
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { shortcuts: true as any },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const shortcuts = (dbUser.shortcuts as CustomShortcut[]) || [];
    const filteredShortcuts = shortcuts.filter((s) => s.id !== id);

    // Update user with filtered shortcuts
    await prisma.user.update({
      where: { id: user.id },
      data: { shortcuts: filteredShortcuts as any },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shortcut:", error);
    return NextResponse.json(
      { error: "Failed to delete shortcut" },
      { status: 500 },
    );
  }
});
