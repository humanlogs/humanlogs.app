"use client";

import {
  EncryptedDataEntity,
  EncryptionUtils,
} from "@/lib/encryption/encryption-entities";
import { mentionedUserIds } from "@/components/transcriptions/editor/text/utils/mentions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { browserCrypto } from "../lib/encryption/encryption-entities.browser";
import { fetchGateway } from "./fetch";
import { DecryptedWithRaw, useDecryptData } from "./use-encryption";
import type { TranscriptionDetail } from "./use-transcriptions";

/** A comment note as returned by the API (body still encrypted when applicable). */
export type CommentDTO = {
  id: string;
  anchorId: string;
  userId: string;
  author: { id: string; name: string | null; email: string } | null;
  body: EncryptedDataEntity | { text: string };
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
};

/** A comment note with its body decrypted to plain text, ready for display. */
export type DecryptedComment = Omit<CommentDTO, "body"> & { text: string };

function isEncryptedEntity(body: unknown): body is EncryptedDataEntity {
  return (
    !!body &&
    typeof body === "object" &&
    Array.isArray((body as EncryptedDataEntity).privateKeys) &&
    typeof (body as EncryptedDataEntity).payload === "string"
  );
}

/**
 * Build the accessor set for encrypting a comment from the transcription's own
 * authorized users (the `privateKeys` of its encrypted content). Returns null when the
 * transcription is not encrypted, in which case comments are stored as plain `{ text }`.
 */
function commentAccessors(
  transcription: DecryptedWithRaw<TranscriptionDetail> | undefined,
): Array<{ userId: string; publicKey: string }> | null {
  const raw = (transcription?._raw as { transcription?: EncryptedDataEntity })
    ?.transcription;
  if (!raw?.privateKeys?.length) return null;
  return raw.privateKeys.map((pk) => ({
    userId: pk.userId,
    publicKey: pk.publicKey,
  }));
}

/** Someone with access to the transcription — the pool @-mentions can pick from. */
export type Participant = {
  id: string;
  name: string | null;
  email: string;
  picture: string | null;
  role?: string;
};

/** Everyone with access to a transcription, with display names. */
export function useTranscriptionParticipants(transcriptionId: string | undefined) {
  return useQuery({
    queryKey: ["transcriptions", transcriptionId, "participants"],
    enabled: !!transcriptionId,
    queryFn: async (): Promise<Participant[]> => {
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/participants`,
      );
      if (!response.ok) throw new Error("Failed to fetch participants");
      const { participants } = (await response.json()) as {
        participants: Participant[];
      };
      return participants;
    },
  });
}

/** Fetch + decrypt all comments for a transcription. */
export function useComments(transcriptionId: string | undefined) {
  const decrypt = useDecryptData();

  return useQuery({
    queryKey: ["comments", transcriptionId],
    enabled: !!transcriptionId,
    queryFn: async (): Promise<DecryptedComment[]> => {
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/comments`,
      );
      if (!response.ok) throw new Error("Failed to fetch comments");
      const { comments } = (await response.json()) as {
        comments: CommentDTO[];
      };

      return Promise.all(
        comments.map(async (c) => {
          let text = "";
          if (isEncryptedEntity(c.body)) {
            try {
              const dec = await decrypt<{ text: string }>(c.body);
              text = dec.text ?? "";
            } catch {
              text = "";
            }
          } else {
            text = (c.body as { text?: string })?.text ?? "";
          }
          return {
            id: c.id,
            anchorId: c.anchorId,
            userId: c.userId,
            author: c.author,
            resolved: c.resolved,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            text,
          };
        }),
      );
    },
  });
}

async function encryptCommentBody(
  text: string,
  transcription: DecryptedWithRaw<TranscriptionDetail> | undefined,
): Promise<EncryptedDataEntity | { text: string }> {
  const accessors = commentAccessors(transcription);
  if (!accessors) return { text };
  const utils = new EncryptionUtils(browserCrypto);
  return utils.createEncryptedDataEntity({ text }, accessors);
}

/** Create a new comment note in thread `anchorId`. */
export function useAddComment(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      anchorId,
      text,
    }: {
      anchorId: string;
      text: string;
    }) => {
      const transcription = queryClient.getQueryData<
        DecryptedWithRaw<TranscriptionDetail>
      >(["transcriptions", transcriptionId]);
      const body = await encryptCommentBody(text, transcription);

      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Mentioned ids travel next to the ciphertext: the mention token is inside
          // the encrypted body, so this is the only way the server can notify them.
          // Ids only — the note itself stays end-to-end encrypted.
          body: JSON.stringify({
            anchorId,
            body,
            mentions: mentionedUserIds(text),
          }),
        },
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add comment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", transcriptionId],
      });
      // Posting subscribes the author to the thread server-side.
      queryClient.invalidateQueries({
        queryKey: ["transcriptions", transcriptionId, "subscriptions"],
      });
    },
  });
}

/**
 * Which threads of this transcription the current user follows. Posting in a thread or
 * being mentioned subscribes them server-side, so this is refetched after commenting.
 */
export function useThreadSubscriptions(transcriptionId: string | undefined) {
  return useQuery({
    queryKey: ["transcriptions", transcriptionId, "subscriptions"],
    enabled: !!transcriptionId,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/comments/subscriptions`,
      );
      if (!response.ok) throw new Error("Failed to fetch subscriptions");
      const { subscriptions } = (await response.json()) as {
        subscriptions: { anchorId: string; subscribed: boolean }[];
      };
      return Object.fromEntries(
        subscriptions.map((s) => [s.anchorId, s.subscribed]),
      );
    },
  });
}

/** Follow or unfollow a thread. */
export function useToggleThreadSubscription(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      anchorId,
      subscribed,
    }: {
      anchorId: string;
      subscribed: boolean;
    }) => {
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/comments/subscriptions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anchorId, subscribed }),
        },
      );
      if (!response.ok) throw new Error("Failed to update subscription");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["transcriptions", transcriptionId, "subscriptions"],
      });
    },
  });
}

/** Edit an existing comment note (author only). */
export function useEditComment(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      text,
    }: {
      commentId: string;
      text: string;
    }) => {
      const transcription = queryClient.getQueryData<
        DecryptedWithRaw<TranscriptionDetail>
      >(["transcriptions", transcriptionId]);
      const body = await encryptCommentBody(text, transcription);

      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to edit comment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", transcriptionId],
      });
    },
  });
}

/** Soft-delete a comment note. Resolves to `{ threadEmpty }`. */
export function useDeleteComment(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
    }: {
      commentId: string;
      anchorId: string;
    }): Promise<{ threadEmpty: boolean }> => {
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/comments/${commentId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete comment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", transcriptionId],
      });
    },
  });
}
