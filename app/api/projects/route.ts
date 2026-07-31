import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { parseAppearanceUpdate } from "@/lib/projects/appearance";
import { formatProject } from "@/lib/projects/format";

export const GET = withAuthRateLimit(async (request, user) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(projects.map(formatProject));
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch studies" },
      { status: 500 },
    );
  }
});

export const POST = withAuthRateLimit(async (request, user) => {
  try {
    const body = await request.json();

    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Study name is required" },
        { status: 400 },
      );
    }

    // Optional appearance (icon/emoji + color) picked at creation time.
    const appearance = parseAppearanceUpdate(body);
    if ("error" in appearance) {
      return NextResponse.json({ error: appearance.error }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        ...appearance.data,
        user: {
          connect: { id: user.id },
        },
      },
    });

    return NextResponse.json(formatProject(project));
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create study" },
      { status: 500 },
    );
  }
});
