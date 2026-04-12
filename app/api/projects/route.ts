import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

export const GET = withAuthRateLimit(async (request, user) => {
  try {
    // Fetch all projects for the user (without transcriptions)
    const projects = await prisma.project.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Transform to match the frontend format
    const formattedProjects = projects.map((p) => ({
      id: p.id,
      name: p.name,
    }));

    return NextResponse.json(formattedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
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
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        userId: user.id,
      },
    });

    return NextResponse.json({
      id: project.id,
      name: project.name,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
});
