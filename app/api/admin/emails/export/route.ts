import { NextRequest, NextResponse } from "next/server";
import { withAdminRateLimit } from "@/lib/admin-middleware";
import { prisma } from "@/lib/prisma";

type ExportType = "newsletter" | "users" | "all";
type ExportFormat = "csv" | "txt";

type EmailRow = {
  email: string;
  /** "newsletter", "user", or "both" when the address is in both lists. */
  type: string;
  name: string | null;
  /** Newsletter locale or, for users, their app language. */
  locale: string | null;
  /** Newsletter signup source. Empty for user-only rows. */
  source: string | null;
  createdAt: Date;
};

const EXPORT_TYPES: ExportType[] = ["newsletter", "users", "all"];
const EXPORT_FORMATS: ExportFormat[] = ["csv", "txt"];

const CSV_COLUMNS = [
  "email",
  "type",
  "name",
  "locale",
  "source",
  "createdAt",
] as const;

/**
 * Quote a CSV field and neutralise leading characters that spreadsheet apps
 * would otherwise interpret as a formula.
 */
function csvField(value: string | null | undefined) {
  const raw = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows: EmailRow[]) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvField(row.email),
        csvField(row.type),
        csvField(row.name),
        csvField(row.locale),
        csvField(row.source),
        csvField(row.createdAt.toISOString()),
      ].join(","),
    );
  }
  // Trailing newline keeps the file POSIX-friendly.
  return `${lines.join("\n")}\n`;
}

/**
 * Export every email address known to the platform — newsletter subscribers,
 * registered users, or both merged — as a downloadable CSV (or a plain
 * newline-separated list with `format=txt`).
 *
 * Admin-only: gated by `withAdminRateLimit`, with a tighter budget than the
 * other admin endpoints since each call reads the full table.
 */
export const GET = withAdminRateLimit(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);

      const typeParam = (searchParams.get("type") ?? "all") as ExportType;
      const formatParam = (searchParams.get("format") ?? "csv") as ExportFormat;

      if (!EXPORT_TYPES.includes(typeParam)) {
        return NextResponse.json(
          {
            error: `Invalid type. Expected one of: ${EXPORT_TYPES.join(", ")}`,
          },
          { status: 400 },
        );
      }
      if (!EXPORT_FORMATS.includes(formatParam)) {
        return NextResponse.json(
          {
            error: `Invalid format. Expected one of: ${EXPORT_FORMATS.join(", ")}`,
          },
          { status: 400 },
        );
      }

      const wantsNewsletter = typeParam === "newsletter" || typeParam === "all";
      const wantsUsers = typeParam === "users" || typeParam === "all";

      const [subscriptions, users] = await Promise.all([
        wantsNewsletter
          ? prisma.newsletterSubscription.findMany({
              orderBy: { createdAt: "asc" },
              select: {
                email: true,
                locale: true,
                source: true,
                createdAt: true,
              },
            })
          : Promise.resolve([]),
        wantsUsers
          ? prisma.user.findMany({
              orderBy: { createdAt: "asc" },
              select: {
                email: true,
                name: true,
                language: true,
                createdAt: true,
              },
            })
          : Promise.resolve([]),
      ]);

      // Merge on the lowercased email so an address present in both lists is
      // exported once, tagged "both".
      const byEmail = new Map<string, EmailRow>();

      for (const sub of subscriptions) {
        const key = sub.email.toLowerCase();
        byEmail.set(key, {
          email: sub.email,
          type: "newsletter",
          name: null,
          locale: sub.locale,
          source: sub.source,
          createdAt: sub.createdAt,
        });
      }

      for (const user of users) {
        const key = user.email.toLowerCase();
        const existing = byEmail.get(key);
        if (existing) {
          existing.type = "both";
          existing.name = user.name ?? existing.name;
          // Keep the earliest known signup date for the address.
          existing.createdAt =
            user.createdAt < existing.createdAt
              ? user.createdAt
              : existing.createdAt;
        } else {
          byEmail.set(key, {
            email: user.email,
            type: "user",
            name: user.name,
            locale: user.language,
            source: null,
            createdAt: user.createdAt,
          });
        }
      }

      const rows = [...byEmail.values()].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      const date = new Date().toISOString().split("T")[0];
      const filename = `humanlogs-emails-${typeParam}-${date}.${formatParam}`;

      const body =
        formatParam === "txt"
          ? `${rows.map((r) => r.email).join("\n")}\n`
          : // Excel needs the BOM to read the file as UTF-8.
            `\uFEFF${toCsv(rows)}`;

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type":
            formatParam === "txt"
              ? "text/plain; charset=utf-8"
              : "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
          "X-Email-Count": String(rows.length),
        },
      });
    } catch (error) {
      console.error("Error exporting emails:", error);
      return NextResponse.json(
        { error: "Failed to export emails" },
        { status: 500 },
      );
    }
  },
  { maxRequests: 20, windowMs: 60 * 1000, keyPrefix: "admin-email-export" },
);
