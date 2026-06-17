"use client";

import {
  useAdminStats,
  useUserProfile,
  type AdminStats,
} from "@/hooks/use-api";
import { PageLayout } from "@/components/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3Icon,
  UsersIcon,
  FileTextIcon,
  CoinsIcon,
  MessageSquareIcon,
  ActivityIcon,
  CreditCardIcon,
  GlobeIcon,
  BriefcaseIcon,
  RepeatIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";

// Weekly retention cohort grid. Rows = registration week (newest first),
// columns = number of weeks after signup, cell = share of the cohort that was
// active (created a transcription or saved a revision) that week.
function RetentionHeatmap({
  retention,
}: {
  retention: AdminStats["retention"];
}) {
  if (!retention || retention.cohorts.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Not enough data yet to build retention cohorts.
      </p>
    );
  }

  const offsets = Array.from({ length: retention.maxOffset + 1 }, (_, i) => i);
  // Newest cohort on top.
  const cohorts = [...retention.cohorts].reverse();

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-separate border-spacing-1">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium pr-3 pb-1">
              Cohort (week of)
            </th>
            <th className="text-right font-medium pr-3 pb-1">Users</th>
            {offsets.map((o) => (
              <th key={o} className="font-medium text-center px-1 pb-1 w-14">
                {o === 0 ? "W0" : `+${o}w`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.weekStart}>
              <td className="pr-3 whitespace-nowrap text-muted-foreground">
                {new Date(cohort.weekStart).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td className="pr-3 text-right font-medium">{cohort.size}</td>
              {offsets.map((o) => {
                // Future weeks for this cohort haven't happened yet.
                if (o >= cohort.retention.length) {
                  return (
                    <td
                      key={o}
                      className="text-center text-muted-foreground/30"
                    >
                      ·
                    </td>
                  );
                }
                const count = cohort.retention[o];
                const pct = cohort.size > 0 ? count / cohort.size : 0;
                return (
                  <td
                    key={o}
                    className="text-center rounded-md px-1.5 py-1 tabular-nums"
                    style={{
                      backgroundColor:
                        pct > 0
                          ? `rgba(34, 197, 94, ${0.12 + pct * 0.78})`
                          : "hsl(var(--muted))",
                      color: pct > 0.55 ? "white" : undefined,
                    }}
                    title={`${count} of ${cohort.size} users active`}
                  >
                    {cohort.size > 0 ? `${Math.round(pct * 100)}%` : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: userProfile, isLoading: isLoadingProfile } = useUserProfile();
  const { data: stats, isLoading: isLoadingStats } = useAdminStats();

  // Redirect if not admin
  useEffect(() => {
    if (!isLoadingProfile && !userProfile?.isAdmin) {
      router.push("/app");
    }
  }, [userProfile, isLoadingProfile, router]);

  // Helper function to generate all days in the last 30 days
  const generateLast30Days = () => {
    const days: string[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split("T")[0]);
    }
    return days;
  };

  // Prepare chart data for Nivo - Bar charts with all 30 days
  const userBarData = useMemo(() => {
    if (!stats?.users.byDay) return [];
    const allDays = generateLast30Days();
    return allDays.map((date) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count: stats.users.byDay[date] || 0,
    }));
  }, [stats]);

  const transcriptionBarData = useMemo(() => {
    if (!stats?.transcriptions.byDayByStatus) return [];
    const allDays = generateLast30Days();
    return allDays.map((date) => {
      const breakdown = stats.transcriptions.byDayByStatus[date] || {
        completed: 0,
        error: 0,
        pending: 0,
      };
      return {
        date: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        completed: breakdown.completed,
        error: breakdown.error,
        pending: breakdown.pending,
      };
    });
  }, [stats]);

  const creditsBarData = useMemo(() => {
    if (!stats?.credits.usedPerDay) return [];
    const allDays = generateLast30Days();
    return allDays.map((date) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count: stats.credits.usedPerDay[date] || 0,
    }));
  }, [stats]);

  const visitorsBarData = useMemo(() => {
    if (!stats?.landing.visitorsByDay) return [];
    const allDays = generateLast30Days();
    return allDays.map((date) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count: stats.landing.visitorsByDay[date] || 0,
    }));
  }, [stats]);

  const transcriptionStatusPieData = useMemo(() => {
    if (!stats?.transcriptions.byStatus) return [];
    return Object.entries(stats.transcriptions.byStatus).map(
      ([status, count]) => ({
        id: status,
        label: status,
        value: count,
      }),
    );
  }, [stats]);

  const PROFESSION_LABELS: Record<string, string> = {
    researcher: "Researcher",
    phdStudent: "PhD Student",
    journalist: "Journalist",
    podcaster: "Podcaster",
    lawyer: "Lawyer",
    healthcare: "Healthcare",
    uxResearcher: "UX Researcher",
    student: "Student",
    other: "Other",
  };

  const MONTHLY_USAGE_LABELS: Record<string, string> = {
    lt1h: "< 1h / month",
    h1to5: "1–5h / month",
    h5to20: "5–20h / month",
    gt20h: "> 20h / month",
  };

  const professionPieData = useMemo(() => {
    if (!stats?.users.byProfession) return [];
    return Object.entries(stats.users.byProfession).map(([key, count]) => ({
      id: key,
      label: PROFESSION_LABELS[key] ?? key,
      value: count,
    }));
  }, [stats]);

  const monthlyUsagePieData = useMemo(() => {
    if (!stats?.users.byMonthlyUsage) return [];
    return Object.entries(stats.users.byMonthlyUsage).map(([key, count]) => ({
      id: key,
      label: MONTHLY_USAGE_LABELS[key] ?? key,
      value: count,
    }));
  }, [stats]);

  const dataResidencyPieData = useMemo(() => {
    if (!stats?.users.byDataResidency) return [];
    return Object.entries(stats.users.byDataResidency).map(([key, count]) => ({
      id: key,
      label:
        key === "eu" ? "EU (Gladia)" : key === "us" ? "US (ElevenLabs)" : key,
      value: count,
    }));
  }, [stats]);

  // Filter feedback by type
  const ratings = useMemo(() => {
    if (!stats?.feedback.recent) return [];
    return stats.feedback.recent.filter((f) => f.type === "RATING");
  }, [stats]);

  const featureRequests = useMemo(() => {
    if (!stats?.feedback.recent) return [];
    return stats.feedback.recent.filter((f) => f.type === "FEATURE_REQUEST");
  }, [stats]);

  // Don't show anything if not admin
  if (!isLoadingProfile && !userProfile?.isAdmin) {
    return null;
  }

  if (isLoadingProfile || isLoadingStats) {
    return (
      <PageLayout
        title="Admin Panel"
        description="System statistics and analytics"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </PageLayout>
    );
  }

  if (!stats) {
    return (
      <PageLayout title="Admin Panel" description="Failed to load statistics">
        <div className="text-center text-muted-foreground">
          Failed to load admin statistics
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Admin Panel"
      description="System statistics and analytics"
    >
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3Icon className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users">
            <UsersIcon className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="retention">
            <RepeatIcon className="h-4 w-4" />
            Retention
          </TabsTrigger>
          <TabsTrigger value="transcriptions">
            <FileTextIcon className="h-4 w-4" />
            Transcriptions
          </TabsTrigger>
          <TabsTrigger value="landing">
            <GlobeIcon className="h-4 w-4" />
            Landing
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <MessageSquareIcon className="h-4 w-4" />
            Feedback
          </TabsTrigger>
        </TabsList>

        {/* ---------- Overview ---------- */}
        <TabsContent value="overview" className="space-y-6">
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Users
                </CardTitle>
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.users.total}</div>
                <p className="text-xs text-muted-foreground">
                  Active (24h): {stats.users.active.last24h}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Transcriptions
                </CardTitle>
                <FileTextIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.values(stats.transcriptions.byStatus).reduce(
                    (a, b) => a + b,
                    0,
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Completed: {stats.transcriptions.byStatus.COMPLETED || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Credits in Stock
                </CardTitle>
                <CoinsIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.credits.totalInStock.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Used: {stats.credits.totalUsed.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg. Feedback Rating
                </CardTitle>
                <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.feedback.averageRating.toFixed(1)} / 5
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.feedback.recent.length} total feedbacks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Paying Customers
                </CardTitle>
                <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.paying.total}</div>
                <p className="text-xs text-muted-foreground">
                  One-time: {stats.paying.oneTime} | Subscribed:{" "}
                  {stats.paying.subscribed}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Landing Visitors
                </CardTitle>
                <GlobeIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.landing.totalUniqueVisitors}
                </div>
                <p className="text-xs text-muted-foreground">
                  Unique visitors (all time)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Users Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivityIcon className="h-5 w-5" />
                Active Users
              </CardTitle>
              <CardDescription>
                Users who have been active in different time periods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <div className="text-2xl font-bold">
                    {stats.users.active.last24h}
                  </div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {stats.users.active.last48h}
                  </div>
                  <p className="text-xs text-muted-foreground">Last 48 hours</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {stats.users.active.last7d}
                  </div>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {stats.users.active.last30d}
                  </div>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Users ---------- */}
        <TabsContent value="users" className="space-y-6">
          {/* Customer Profiles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseIcon className="h-5 w-5" />
                Customer Profiles
              </CardTitle>
              <CardDescription>
                Onboarding data — profession, usage volume, and data residency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Onboarding completion */}
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Onboarding complete
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.users.welcomeDoneCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.users.total > 0
                      ? `${Math.round((stats.users.welcomeDoneCount / stats.users.total) * 100)}% of users`
                      : "—"}
                  </div>
                </div>

                {/* Data residency */}
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Data residency
                  </div>
                  {dataResidencyPieData.length > 0 ? (
                    <div className="space-y-1">
                      {dataResidencyPieData.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{d.label}</span>
                          <span className="font-medium">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No data</p>
                  )}
                </div>

                {/* Profession breakdown */}
                <div className="flex flex-col gap-1 lg:col-span-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Profession
                  </div>
                  {professionPieData.length > 0 ? (
                    <div className="space-y-1">
                      {professionPieData
                        .sort((a, b) => b.value - a.value)
                        .map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="truncate pr-2">{d.label}</span>
                            <span className="font-medium shrink-0">
                              {d.value}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No data</p>
                  )}
                </div>

                {/* Monthly usage */}
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Monthly usage
                  </div>
                  {monthlyUsagePieData.length > 0 ? (
                    <div className="space-y-1">
                      {monthlyUsagePieData
                        .sort((a, b) => b.value - a.value)
                        .map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="truncate pr-2">{d.label}</span>
                            <span className="font-medium shrink-0">
                              {d.value}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No data</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                Latest Registered Users
              </CardTitle>
              <CardDescription>
                The 10 most recently registered users — their transcription and
                revision activity plus onboarding profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.users.recent && stats.users.recent.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Email</th>
                        <th className="py-2 pr-4 font-medium">Registered</th>
                        <th className="py-2 pr-4 font-medium text-right">
                          Transcriptions
                        </th>
                        <th className="py-2 pr-4 font-medium text-right">
                          Revisions
                        </th>
                        <th className="py-2 pr-4 font-medium">Onboarding</th>
                        <th className="py-2 pr-4 font-medium">Profession</th>
                        <th className="py-2 pr-4 font-medium">Usage</th>
                        <th className="py-2 font-medium">Residency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.users.recent.map((u) => (
                        <tr
                          key={u.id}
                          className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2 pr-4">
                            <div className="font-medium">{u.email}</div>
                            {u.name && (
                              <div className="text-xs text-muted-foreground">
                                {u.name}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium">
                            {u.transcriptionCount}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium">
                            {u.revisionCount}
                          </td>
                          <td className="py-2 pr-4">
                            {u.isWelcomeDone ? (
                              <span className="text-green-600">Done</span>
                            ) : (
                              <span className="text-muted-foreground">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {u.profession
                              ? (PROFESSION_LABELS[u.profession] ??
                                u.profession)
                              : "—"}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {u.monthlyUsage
                              ? (MONTHLY_USAGE_LABELS[u.monthlyUsage] ??
                                u.monthlyUsage)
                              : "—"}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {u.dataResidency === "eu"
                              ? "EU (Gladia)"
                              : u.dataResidency === "us"
                                ? "US (ElevenLabs)"
                                : (u.dataResidency ?? "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No users yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Users by Day Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3Icon className="h-5 w-5" />
                New Users (Last 30 Days)
              </CardTitle>
              <CardDescription>
                Number of new user registrations per day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {userBarData.length > 0 ? (
                  <ResponsiveBar
                    data={userBarData}
                    keys={["count"]}
                    indexBy="date"
                    margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
                    padding={0.3}
                    valueScale={{ type: "linear" }}
                    indexScale={{ type: "band", round: true }}
                    colors={{ scheme: "category10" }}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -45,
                      legend: "Date",
                      legendOffset: 50,
                      legendPosition: "middle",
                      tickValues: userBarData
                        .map((d, i) => (i % 3 === 0 ? d.date : null))
                        .filter(Boolean) as string[],
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      legend: "Users",
                      legendOffset: -45,
                      legendPosition: "middle",
                    }}
                    enableLabel={false}
                    theme={{
                      axis: {
                        ticks: {
                          text: {
                            fill: "hsl(var(--muted-foreground))",
                          },
                        },
                        legend: {
                          text: {
                            fill: "hsl(var(--foreground))",
                          },
                        },
                      },
                      grid: {
                        line: {
                          stroke: "hsl(var(--border))",
                        },
                      },
                      tooltip: {
                        container: {
                          background: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                          border: "1px solid hsl(var(--border))",
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Retention ---------- */}
        <TabsContent value="retention" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RepeatIcon className="h-5 w-5" />
                Weekly Retention Cohorts
              </CardTitle>
              <CardDescription>
                Each row groups users by the week they registered. A cell shows
                the share of that cohort who came back and were active — created
                a transcription or saved an editor revision — that many weeks
                later. W0 is the signup week (activation).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RetentionHeatmap retention={stats.retention} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Transcriptions ---------- */}
        <TabsContent value="transcriptions" className="space-y-6">
          {/* Transcriptions Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Transcription Status (Last 30 Days)</CardTitle>
                <CardDescription>
                  Breakdown of transcriptions by status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {transcriptionStatusPieData.length > 0 ? (
                    <ResponsivePie
                      data={transcriptionStatusPieData}
                      margin={{ top: 30, right: 80, bottom: 80, left: 80 }}
                      innerRadius={0.5}
                      padAngle={0.7}
                      cornerRadius={3}
                      activeOuterRadiusOffset={8}
                      colors={{ scheme: "category10" }}
                      borderWidth={1}
                      borderColor={{
                        from: "color",
                        modifiers: [["darker", 0.2]],
                      }}
                      arcLinkLabelsSkipAngle={10}
                      arcLinkLabelsTextColor="hsl(var(--foreground))"
                      arcLinkLabelsThickness={2}
                      arcLinkLabelsColor={{ from: "color" }}
                      arcLabelsSkipAngle={10}
                      arcLabelsTextColor={{
                        from: "color",
                        modifiers: [["darker", 2]],
                      }}
                      theme={{
                        tooltip: {
                          container: {
                            background: "hsl(var(--background))",
                            color: "hsl(var(--foreground))",
                            border: "1px solid hsl(var(--border))",
                          },
                        },
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credits Overview</CardTitle>
                <CardDescription>
                  Total credits across all users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Credits in Stock
                    </div>
                    <div className="text-2xl font-bold">
                      {stats.credits.totalInStock.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Total Credits Used
                    </div>
                    <div className="text-2xl font-bold">
                      {stats.credits.totalUsed.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Total Credits Refill
                    </div>
                    <div className="text-2xl font-bold">
                      {stats.credits.totalRefill.toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Credits Used Per Day */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CoinsIcon className="h-5 w-5" />
                Credits Used Per Day (Last 30 Days)
              </CardTitle>
              <CardDescription>
                Estimated credits consumed daily
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {creditsBarData.length > 0 ? (
                  <ResponsiveBar
                    data={creditsBarData}
                    keys={["count"]}
                    indexBy="date"
                    margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
                    padding={0.3}
                    valueScale={{ type: "linear" }}
                    indexScale={{ type: "band", round: true }}
                    colors={{ scheme: "category10" }}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -45,
                      legend: "Date",
                      legendOffset: 50,
                      legendPosition: "middle",
                      tickValues: creditsBarData
                        .map((d, i) => (i % 3 === 0 ? d.date : null))
                        .filter(Boolean) as string[],
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      legend: "Credits",
                      legendOffset: -45,
                      legendPosition: "middle",
                    }}
                    enableLabel={false}
                    theme={{
                      axis: {
                        ticks: {
                          text: {
                            fill: "hsl(var(--muted-foreground))",
                          },
                        },
                        legend: {
                          text: {
                            fill: "hsl(var(--foreground))",
                          },
                        },
                      },
                      grid: {
                        line: {
                          stroke: "hsl(var(--border))",
                        },
                      },
                      tooltip: {
                        container: {
                          background: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                          border: "1px solid hsl(var(--border))",
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transcriptions Per Day */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3Icon className="h-5 w-5" />
                Transcriptions Created Per Day (Last 30 Days)
              </CardTitle>
              <CardDescription>
                Number of transcriptions created daily — green: completed, red:
                failed, orange: pending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {transcriptionBarData.length > 0 ? (
                  <ResponsiveBar
                    data={transcriptionBarData}
                    keys={["completed", "error", "pending"]}
                    indexBy="date"
                    margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
                    padding={0.3}
                    valueScale={{ type: "linear" }}
                    indexScale={{ type: "band", round: true }}
                    colors={({ id }) =>
                      id === "completed"
                        ? "#22c55e"
                        : id === "error"
                          ? "#ef4444"
                          : "#f97316"
                    }
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -45,
                      legend: "Date",
                      legendOffset: 50,
                      legendPosition: "middle",
                      tickValues: transcriptionBarData
                        .map((d, i) => (i % 3 === 0 ? d.date : null))
                        .filter(Boolean) as string[],
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      legend: "Transcriptions",
                      legendOffset: -45,
                      legendPosition: "middle",
                    }}
                    enableLabel={false}
                    theme={{
                      axis: {
                        ticks: {
                          text: {
                            fill: "hsl(var(--muted-foreground))",
                          },
                        },
                        legend: {
                          text: {
                            fill: "hsl(var(--foreground))",
                          },
                        },
                      },
                      grid: {
                        line: {
                          stroke: "hsl(var(--border))",
                        },
                      },
                      tooltip: {
                        container: {
                          background: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                          border: "1px solid hsl(var(--border))",
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Landing ---------- */}
        <TabsContent value="landing" className="space-y-6">
          {/* Landing Page Visitors Per Day */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GlobeIcon className="h-5 w-5" />
                Unique Landing Page Visitors Per Day (Last 30 Days)
              </CardTitle>
              <CardDescription>
                Number of unique visitors to the landing page daily
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {visitorsBarData.length > 0 ? (
                  <ResponsiveBar
                    data={visitorsBarData}
                    keys={["count"]}
                    indexBy="date"
                    margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
                    padding={0.3}
                    valueScale={{ type: "linear" }}
                    indexScale={{ type: "band", round: true }}
                    colors={{ scheme: "category10" }}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -45,
                      legend: "Date",
                      legendOffset: 50,
                      legendPosition: "middle",
                      tickValues: visitorsBarData
                        .map((d, i) => (i % 3 === 0 ? d.date : null))
                        .filter(Boolean) as string[],
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      legend: "Unique Visitors",
                      legendOffset: -45,
                      legendPosition: "middle",
                    }}
                    enableLabel={false}
                    theme={{
                      axis: {
                        ticks: {
                          text: {
                            fill: "hsl(var(--muted-foreground))",
                          },
                        },
                        legend: {
                          text: {
                            fill: "hsl(var(--foreground))",
                          },
                        },
                      },
                      grid: {
                        line: {
                          stroke: "hsl(var(--border))",
                        },
                      },
                      tooltip: {
                        container: {
                          background: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                          border: "1px solid hsl(var(--border))",
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Most Visited Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GlobeIcon className="h-5 w-5" />
                Most Visited Pages (Last 30 Days)
              </CardTitle>
              <CardDescription>
                Breakdown of unique visitors by page
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.landing.byPage && stats.landing.byPage.length > 0 ? (
                <div className="space-y-2">
                  {stats.landing.byPage.map((pageStat, index) => (
                    <div
                      key={pageStat.page}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">
                          #{index + 1}
                        </span>
                        <span className="font-mono text-sm font-medium">
                          {pageStat.page}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {pageStat.uniqueVisitors} unique visitor
                          {pageStat.uniqueVisitors !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No page visit data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Feedback ---------- */}
        <TabsContent value="feedback" className="space-y-6">
          {/* User Ratings and Feature Requests */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* User Ratings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareIcon className="h-5 w-5" />
                  User Ratings
                </CardTitle>
                <CardDescription>
                  Recent rating feedback from users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {ratings.length > 0 ? (
                    ratings.slice(0, 20).map((feedback) => (
                      <div
                        key={feedback.id}
                        className="border-b pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {feedback.user.name || feedback.user.email}
                              </span>
                              {feedback.rating && (
                                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                  {feedback.rating}/5 ⭐
                                </span>
                              )}
                            </div>
                            {feedback.message && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {feedback.message}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(feedback.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No ratings yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Feature Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareIcon className="h-5 w-5" />
                  Feature Requests
                </CardTitle>
                <CardDescription>
                  User suggestions and feature requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {featureRequests.length > 0 ? (
                    featureRequests.slice(0, 20).map((feedback) => (
                      <div
                        key={feedback.id}
                        className="border-b pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {feedback.user.name || feedback.user.email}
                              </span>
                            </div>
                            {feedback.message && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {feedback.message}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(feedback.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">
                      No feature requests yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
