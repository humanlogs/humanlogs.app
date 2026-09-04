import { prisma } from "../prisma";

/**
 * Credit accounting for transcriptions.
 *
 * Credits are charged up front, at creation, from the durations the client
 * reports — the audio has not been processed yet, so that estimate is all we
 * have. When the job never produces a transcript (audio processing threw, the
 * STT provider failed, the row was reaped as stale, the user deleted it before
 * it finished) the charge has bought nothing and has to go back.
 *
 * Two properties make that possible, and both live here:
 *
 *  - **What each transcription cost is recorded on the row itself**
 *    (`Transcription.creditsCharged`). The charge is a batch-level lump sum —
 *    `ceil(total seconds / 60)` over every file in one upload — so a per-file
 *    share cannot be recomputed afterwards without re-deriving the rounding.
 *    `distributeCredits` splits the lump at creation time instead.
 *  - **Refunds are idempotent.** `refundTranscriptionCredits` clears
 *    `creditsCharged` in the same conditional write that reads it, so the
 *    polling path and the webhook can both resolve the same failed job (they
 *    routinely do) and only one of them moves the balance.
 */

/**
 * Split a batch credit charge across its files, proportionally to duration.
 *
 * The parts always sum back to exactly `totalCredits`: the batch is billed as
 * `ceil(sum / 60)`, which is generally less than the sum of per-file `ceil`s,
 * so per-file rounding would either overcharge on creation or over-refund on
 * failure. Largest-remainder apportionment keeps the total intact and hands the
 * rounding gain to the longest files.
 *
 * Files of unknown length (duration 0, which the client sends when it could not
 * probe the media) share the charge equally — that is the only fair split when
 * there is nothing to weight by.
 */
export function distributeCredits(
  totalCredits: number,
  durations: number[],
): number[] {
  const count = durations.length;
  if (count === 0) return [];
  if (totalCredits <= 0) return new Array(count).fill(0);

  const totalDuration = durations.reduce((sum, d) => sum + Math.max(0, d), 0);

  // Nothing to weight by: spread the charge as evenly as it divides.
  const weights =
    totalDuration > 0
      ? durations.map((d) => Math.max(0, d) / totalDuration)
      : new Array(count).fill(1 / count);

  const exact = weights.map((w) => w * totalCredits);
  const shares = exact.map((value) => Math.floor(value));

  // Hand out the credits lost to flooring, largest fractional part first.
  let remainder = totalCredits - shares.reduce((sum, s) => sum + s, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0; i = (i + 1) % count) {
    shares[byRemainder[i].index] += 1;
    remainder -= 1;
  }

  return shares;
}

type RefundResult = {
  refunded: boolean;
  credits: number;
};

/**
 * Return the credits charged for a transcription that will never produce a
 * transcript, and mark the row as no longer holding a charge.
 *
 * Safe to call more than once and from more than one code path at a time: the
 * conditional `updateMany` is the compare-and-swap. It matches only while
 * `creditsCharged > 0`, so whichever caller gets there first zeroes the field
 * and every later call reports `refunded: false` without touching the balance.
 *
 * `creditsUsed` is a lifetime counter of consumed minutes, so it is wound back
 * too — floored at zero, since rows predating this accounting were charged
 * without ever recording it.
 */
export async function refundTranscriptionCredits(
  transcriptionId: string,
  reason: string,
): Promise<RefundResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const transcription = await tx.transcription.findUnique({
        where: { id: transcriptionId },
        select: { userId: true, creditsCharged: true },
      });

      if (!transcription || transcription.creditsCharged <= 0) {
        return { refunded: false, credits: 0 };
      }

      // Claim the charge. A concurrent refund that got here first has already
      // set the field to 0, so its `where` no longer matches and this returns 0.
      const claimed = await tx.transcription.updateMany({
        where: { id: transcriptionId, creditsCharged: { gt: 0 } },
        data: { creditsCharged: 0 },
      });

      if (claimed.count === 0) {
        return { refunded: false, credits: 0 };
      }

      const credits = transcription.creditsCharged;

      const user = await tx.user.findUnique({
        where: { id: transcription.userId },
        select: { creditsUsed: true },
      });

      await tx.user.update({
        where: { id: transcription.userId },
        data: {
          credits: { increment: credits },
          // Never let the lifetime counter go negative.
          creditsUsed: Math.max(0, (user?.creditsUsed ?? 0) - credits),
        },
      });

      console.log(
        `[CREDITS] Refunded ${credits} credit(s) to user ${transcription.userId} for transcription ${transcriptionId} (${reason})`,
      );

      return { refunded: true, credits };
    });
  } catch (error) {
    // A refund must never be the reason a failure path throws — the caller is
    // usually already handling an error and would lose it.
    console.error(
      `[CREDITS] Failed to refund credits for transcription ${transcriptionId} (${reason}):`,
      error,
    );
    return { refunded: false, credits: 0 };
  }
}

/**
 * Give back a whole batch charge when the upload is abandoned before any
 * transcription row survives to carry it (the creation loop threw and its
 * records were rolled back).
 */
export async function refundBatchCredits(
  userId: string,
  credits: number,
  reason: string,
): Promise<void> {
  if (credits <= 0) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsUsed: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: { increment: credits },
        creditsUsed: Math.max(0, (user?.creditsUsed ?? 0) - credits),
      },
    });

    console.log(
      `[CREDITS] Refunded batch of ${credits} credit(s) to user ${userId} (${reason})`,
    );
  } catch (error) {
    console.error(
      `[CREDITS] Failed to refund batch credits to user ${userId} (${reason}):`,
      error,
    );
  }
}
