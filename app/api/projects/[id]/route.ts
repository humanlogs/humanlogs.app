import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

export const PATCH = withAuthRateLimit(
  async (request, user, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await request.json();

      const { name } = body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json(
          { error: "Project name is required" },
          { status: 400 },
        );
      }

      // Check if project exists and belongs to user
      const existingProject = await prisma.project.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!existingProject) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      }

      // Update the project
      const project = await prisma.project.update({
        where: {
          id,
        },
        data: {
          name: name.trim(),
        },
      });

      return NextResponse.json({
        id: project.id,
        name: project.name,
      });
    } catch (error) {
      console.error("Error updating project:", error);
      return NextResponse.json(
        { error: "Failed to update project" },
        { status: 500 },
      );
    }
  },
);
