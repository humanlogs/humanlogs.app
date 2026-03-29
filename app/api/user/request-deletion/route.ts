import { requireAuth } from "@/lib/auth-helpers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { getAccountDeletionEmailTemplate } from "@/lib/email-templates";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate a unique token
    const token = crypto.randomBytes(32).toString("hex");

    // Token expires in 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store the deletion token
    await prisma.deletionToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Create confirmation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const confirmationUrl = `${baseUrl}/account/confirm-deletion?token=${token}`;

    // Send email
    const emailTemplate = getAccountDeletionEmailTemplate({
      userName: user.name || user.email,
      confirmationUrl,
      expiresIn: "24 hours",
    });

    await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    return NextResponse.json({
      success: true,
      message: "Deletion confirmation email sent",
    });
  } catch (error) {
    console.error("Request deletion error:", error);
    return NextResponse.json(
      { error: "Failed to request account deletion" },
      { status: 500 },
    );
  }
}
