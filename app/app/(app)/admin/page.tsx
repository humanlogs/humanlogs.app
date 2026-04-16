"use client";

import { useAdminStats, useUserProfile } from "@/hooks/use-api";
import { PageLayout } from "@/components/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3Icon,
  UsersIcon,
  FileTextIcon,
  CoinsIcon,
  MessageSquareIcon,
  ActivityIcon,
  CreditCardIcon,
  GlobeIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";

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
    if (!stats?.transcriptions.byDay) return [];
    const allDays = generateLast30Days();
    return allDays.map((date) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count: stats.transcriptions.byDay[date] || 0,
    }));
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
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
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
              <CardDescription>Total credits across all users</CardDescription>
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
            <CardDescription>Estimated credits consumed daily</CardDescription>
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
              Number of transcriptions created daily
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {transcriptionBarData.length > 0 ? (
                <ResponsiveBar
                  data={transcriptionBarData}
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
      </div>
    </PageLayout>
  );
}
