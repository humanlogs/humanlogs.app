import { prisma } from "@/lib/prisma";

/**
 * Weekly retention cohorts for the admin dashboard.
 *
 * There is no per-user login log in the schema, so "did the user come back?"
 * is approximated from datable engagement events: a transcription creation
 * (`Transcription.createdAt`) or an editor revision
 * (`TranscriptionHistory.updatedAt`). Each event marks the user as active for
 * the ISO week it falls in.
 *
 * A cohort is the (Monday-aligned) week a user registered in. For each cohort
 * we count how many of its users were active `offset` weeks later, where
 * offset 0 is the registration week itself (i.e. the activation rate).
 *
 * Kept side-effect free and admin-only — it is intentionally NOT folded into
 * `getAppStats()` so it never leaks into the public marketing stats export.
 */

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
// 2024-01-01 (UTC) was a Monday, so flooring against it yields Monday-aligned
// week boundaries.
const WEEK_EPOCH = Date.UTC(2024, 0, 1);

function weekIndex(date: Date): number {
  return Math.floor((date.getTime() - WEEK_EPOCH) / MS_PER_WEEK);
}

function weekIndexToDate(index: number): string {
  return new Date(WEEK_EPOCH + index * MS_PER_WEEK).toISOString().split("T")[0];
}

export type RetentionCohort = {
  /** Monday of the registration week, as YYYY-MM-DD. */
  weekStart: string;
  /** Number of users that registered during this week. */
  size: number;
  /**
   * Active-user counts indexed by week offset. `retention[0]` is the
   * registration week; the array only extends to the most recent completed
   * offset for this cohort (older cohorts have more columns).
   */
  retention: number[];
};

export type RetentionStats = {
  /** Number of weekly cohorts included (most recent N weeks). */
  weeks: number;
  /** Largest offset across all cohorts, i.e. the number of columns to render. */
  maxOffset: number;
  /** Cohorts ordered oldest → newest. */
  cohorts: RetentionCohort[];
};

export async function getRetentionCohorts(weeks = 12): Promise<RetentionStats> {
  const now = new Date();
  const currentWeek = weekIndex(now);
  const firstCohortWeek = currentWeek - (weeks - 1);
  const startDate = new Date(WEEK_EPOCH + firstCohortWeek * MS_PER_WEEK);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: startDate } },
    select: { id: true, createdAt: true },
  });

  if (users.length === 0) {
    return { weeks, maxOffset: currentWeek - firstCohortWeek, cohorts: [] };
  }

  const userIds = users.map((u) => u.id);

  // Datable engagement events for these users.
  const [transcriptions, revisions] = await Promise.all([
    prisma.transcription.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, createdAt: true },
    }),
    prisma.transcriptionHistory.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, updatedAt: true },
    }),
  ]);

  // Per-user set of week indices in which they were active.
  const activeWeeksByUser = new Map<string, Set<number>>();
  const addActivity = (userId: string, date: Date) => {
    let set = activeWeeksByUser.get(userId);
    if (!set) {
      set = new Set();
      activeWeeksByUser.set(userId, set);
    }
    set.add(weekIndex(date));
  };
  transcriptions.forEach((t) => addActivity(t.userId, t.createdAt));
  revisions.forEach((r) => addActivity(r.userId, r.updatedAt));

  // Accumulate per-cohort, per-offset distinct user counts.
  type CohortAcc = {
    week: number;
    size: number;
    offsets: Map<number, Set<string>>;
  };
  const cohortMap = new Map<number, CohortAcc>();
  for (let w = firstCohortWeek; w <= currentWeek; w++) {
    cohortMap.set(w, { week: w, size: 0, offsets: new Map() });
  }

  users.forEach((u) => {
    const cohortWeek = weekIndex(u.createdAt);
    const cohort = cohortMap.get(cohortWeek);
    if (!cohort) return; // outside the window (guards rounding edge cases)
    cohort.size += 1;

    const active = activeWeeksByUser.get(u.id);
    if (!active) return;
    active.forEach((activeWeek) => {
      const offset = activeWeek - cohortWeek;
      if (offset < 0) return; // ignore stray pre-registration activity
      let set = cohort.offsets.get(offset);
      if (!set) {
        set = new Set();
        cohort.offsets.set(offset, set);
      }
      set.add(u.id);
    });
  });

  const cohorts: RetentionCohort[] = Array.from(cohortMap.values())
    .sort((a, b) => a.week - b.week)
    .map((c) => {
      const maxForCohort = currentWeek - c.week;
      const retention: number[] = [];
      for (let offset = 0; offset <= maxForCohort; offset++) {
        retention.push(c.offsets.get(offset)?.size ?? 0);
      }
      return { weekStart: weekIndexToDate(c.week), size: c.size, retention };
    });

  return { weeks, maxOffset: currentWeek - firstCohortWeek, cohorts };
}
