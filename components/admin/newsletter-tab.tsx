"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  downloadEmailExport,
  useNewsletterSubscribers,
  type EmailExportFormat,
  type EmailExportType,
} from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DownloadIcon,
  MailIcon,
  SearchIcon,
  UsersIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

const PAGE_SIZE = 25;

type ExportTarget = {
  type: EmailExportType;
  label: string;
  description: string;
  count?: number;
};

function ExportBlock({
  target,
  pending,
  onDownload,
}: {
  target: ExportTarget;
  pending: string | null;
  onDownload: (type: EmailExportType, format: EmailExportFormat) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{target.label}</span>
        {typeof target.count === "number" && (
          <span className="text-sm tabular-nums text-muted-foreground">
            {target.count.toLocaleString()}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground flex-1">
        {target.description}
      </p>
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => onDownload(target.type, "csv")}
        >
          <DownloadIcon />
          {pending === `${target.type}:csv` ? "Preparing…" : "CSV"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending !== null}
          onClick={() => onDownload(target.type, "txt")}
        >
          {pending === `${target.type}:txt` ? "Preparing…" : ".txt"}
        </Button>
      </div>
    </div>
  );
}

export function NewsletterTab() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingExport, setPendingExport] = useState<string | null>(null);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data, isLoading, isError } = useNewsletterSubscribers({
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  const handleDownload = async (
    type: EmailExportType,
    format: EmailExportFormat,
  ) => {
    setPendingExport(`${type}:${format}`);
    try {
      const { count, filename } = await downloadEmailExport(type, format);
      toast.success(`Exported ${count.toLocaleString()} emails`, {
        description: filename,
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to export emails");
    } finally {
      setPendingExport(null);
    }
  };

  const stats = data?.stats;
  const matching = data?.matching ?? 0;
  const totalPages = Math.max(1, Math.ceil(matching / PAGE_SIZE));

  const exportTargets: ExportTarget[] = [
    {
      type: "newsletter",
      label: "Newsletter subscribers",
      description: "Emails collected from the landing page newsletter form.",
      count: stats?.total,
    },
    {
      type: "users",
      label: "Registered users",
      description: "Every account email, with name and app language.",
      count: stats?.totalUsers,
    },
    {
      type: "all",
      label: "All emails",
      description:
        "Subscribers and users merged, deduplicated — addresses in both lists are tagged “both”.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
            <MailIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                (stats?.total ?? 0).toLocaleString()
              )}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 30 days</CardTitle>
            <MailIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                (stats?.last30Days ?? 0).toLocaleString()
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days: {(stats?.last7Days ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats && Object.keys(stats.bySource).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(stats.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([source, count]) => (
                    <div
                      key={source}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate pr-2 font-mono text-xs">
                        {source}
                      </span>
                      <span className="font-medium shrink-0">{count}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locales</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats && Object.keys(stats.byLocale).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(stats.byLocale)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([locale, count]) => (
                    <div
                      key={locale}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="uppercase">{locale}</span>
                      <span className="font-medium shrink-0">{count}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DownloadIcon className="h-5 w-5" />
            Export emails
          </CardTitle>
          <CardDescription>
            Download the platform&apos;s email addresses. CSV includes type,
            name, locale, source and signup date; .txt is a plain list of
            addresses, one per line.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {exportTargets.map((target) => (
              <ExportBlock
                key={target.type}
                target={target}
                pending={pendingExport}
                onDownload={handleDownload}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscribers list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailIcon className="h-5 w-5" />
            Newsletter subscribers
          </CardTitle>
          <CardDescription>
            Everyone who signed up through the landing page newsletter form,
            newest first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email…"
            className="max-w-sm"
          />

          {isError ? (
            <p className="text-muted-foreground text-center py-8">
              Failed to load newsletter subscribers
            </p>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.subscribers.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Email</th>
                      <th className="py-2 pr-4 font-medium">Locale</th>
                      <th className="py-2 pr-4 font-medium">Source</th>
                      <th className="py-2 pr-4 font-medium">Account</th>
                      <th className="py-2 font-medium">Subscribed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscribers.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 pr-4 font-medium">{s.email}</td>
                        <td className="py-2 pr-4 uppercase text-muted-foreground">
                          {s.locale}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {s.source}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {s.isUser ? (
                            <span className="text-green-600">Registered</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 whitespace-nowrap text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  {matching.toLocaleString()} subscriber
                  {matching !== 1 ? "s" : ""}
                  {search ? " matching" : ""} · page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeftIcon />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              {search
                ? "No subscriber matches this search"
                : "No subscribers yet"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
