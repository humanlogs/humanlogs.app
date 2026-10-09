import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { sharesDocumentWith } from "@/lib/transcriptions/access";

const userSelectPublic = {
  id: true,
  name: true,
  email: true,
  picture: true,
  publicKey: true,
};

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export const GET = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;

      // Another account's email is only yours to read if you already share a
      // document with them. A 404 either way, so this cannot be used to probe
      // which ids exist.
      if (!(await sharesDocumentWith(user.id, id))) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const dbUser = await prisma.user.findUnique({
        where: {
          id,
        },
        select: userSelectPublic,
      });

      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({
        ...dbUser,
        isBillingEnabled: isStripeConfigured(),
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 },
      );
    }
  },
);
