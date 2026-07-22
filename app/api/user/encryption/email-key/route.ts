import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { isEmailConfigured, sendEmail } from "@/lib/email/mailer";
import { getEncryptionKeyEmailTemplate } from "@/lib/email/email-templates-account";

/**
 * POST /api/user/encryption/email-key
 *
 * Emails the user their encryption certificate (recovery key) as an attachment.
 *
 * This is the friendlier onboarding option: instead of asking the user to
 * download and safeguard a file themselves, we send it to their inbox with a
 * clear "keep this email" message. It is a deliberate convenience trade-off —
 * the key transits our mail provider, so it is not the pure end-to-end path.
 * The certificate is only relayed to the mailer; we never persist the private
 * key server-side.
 */
export const POST = withAuthRateLimit(async (request, user) => {
  try {
    const body = await request.json();
    const certificate = body?.certificate;

    // The client sends the full certificate JSON (public + private key). We do
    // a light sanity check without ever storing it.
    if (typeof certificate !== "string" || !certificate.includes("privateKey")) {
      return NextResponse.json(
        { error: "Missing or invalid certificate" },
        { status: 400 },
      );
    }

    // No email provider configured (e.g. a self-host without SMTP/SES): tell the
    // client so it can fall back to downloading the key instead of pretending an
    // email was sent (which would leave the user with no copy of their key).
    if (!isEmailConfigured()) {
      return NextResponse.json({ success: true, delivered: false });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, language: true },
    });

    if (!dbUser?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const template = await getEncryptionKeyEmailTemplate({
      locale: dbUser.language,
    });

    await sendEmail({
      to: dbUser.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments: [
        {
          filename: "humanlogs-recovery-key.json",
          content: certificate,
          contentType: "application/json",
        },
      ],
    });

    return NextResponse.json({ success: true, delivered: true });
  } catch (error) {
    console.error("Error emailing recovery key:", error);
    return NextResponse.json(
      { error: "Failed to email recovery key" },
      { status: 500 },
    );
  }
});
