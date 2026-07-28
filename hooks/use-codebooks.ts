"use client";

import {
  EncryptionUtils,
  type EncryptedAccessorEntity,
  type EncryptedDataEntity,
} from "@/lib/encryption/encryption-entities";
import {
  DEFAULT_CODEBOOK_TARGET,
  type Code,
  type CodebookContent,
  type CodebookDTO,
  type CodebookTarget,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { browserCrypto } from "../lib/encryption/encryption-entities.browser";
import { fetchGateway } from "./fetch";
import { useBetaFeatures } from "./use-api";
import { useDecryptData, useEncryptionStatus } from "./use-encryption";

type Accessor = { userId: string; publicKey: string };

function isEncryptedEntity(content: unknown): content is EncryptedDataEntity {
  return (
    !!content &&
    typeof content === "object" &&
    Array.isArray((content as EncryptedDataEntity).privateKeys) &&
    typeof (content as EncryptedDataEntity).payload === "string"
  );
}

/**
 * Everyone the codebook must be readable by, for a given scope: the owner plus
 * the collaborators of the documents in those studies. Resolved server-side
 * (public keys only); the wrapping itself happens here, in the browser.
 */
async function fetchAccessors(scope: {
  allStudies: boolean;
  studyIds: string[];
}): Promise<Accessor[]> {
  const query = scope.allStudies
    ? "allStudies=1"
    : `studyIds=${encodeURIComponent(scope.studyIds.join(","))}`;
  const response = await fetchGateway(`/api/codebooks/accessors?${query}`);
  if (!response.ok) throw new Error("Failed to resolve accessors");
  const { accessors } = (await response.json()) as { accessors: Accessor[] };
  return accessors;
}

/**
 * Encrypts `{ name, codes }` for the scope's accessors, or returns it in clear
 * when nobody involved has an encryption key — the same fallback comments use.
 */
async function buildContent(
  content: CodebookContent,
  scope: { allStudies: boolean; studyIds: string[] },
): Promise<EncryptedDataEntity | CodebookContent> {
  const accessors = await fetchAccessors(scope);
  if (accessors.length === 0) return content;
  const utils = new EncryptionUtils(browserCrypto);
  return utils.createEncryptedDataEntity(content, accessors);
}

/**
 * Fetch every codebook of the user, with names and codes decrypted.
 *
 * Codebooks are a beta feature: without the opt-in the query never runs, so
 * every consumer (study section, sidebar grouping, editor dialog) sees an empty
 * list instead of each having to check the flag.
 */
export function useCodebooks() {
  const decrypt = useDecryptData();
  const betaFeatures = useBetaFeatures();

  return useQuery({
    enabled: betaFeatures,
    queryKey: ["codebooks"],
    queryFn: async (): Promise<DecryptedCodebook[]> => {
      const response = await fetchGateway("/api/codebooks");
      if (!response.ok) throw new Error("Failed to fetch codebooks");
      const { codebooks } = (await response.json()) as {
        codebooks: CodebookDTO[];
      };

      return Promise.all(
        codebooks.map(async ({ content, ...rest }) => {
          let decoded: CodebookContent = { name: "", codes: [] };
          if (isEncryptedEntity(content)) {
            try {
              decoded = await decrypt<CodebookContent>(content);
            } catch {
              // No key on this device: keep the codebook listed but unreadable
              // rather than dropping it, so its codes still group documents.
              decoded = { name: "", codes: [] };
            }
          } else {
            decoded = content as CodebookContent;
          }
          return {
            ...rest,
            name: decoded?.name ?? "",
            codes: Array.isArray(decoded?.codes) ? decoded.codes : [],
          };
        }),
      );
    },
  });
}

export type CodebookInput = {
  name: string;
  codes: Code[];
  allStudies: boolean;
  studyIds: string[];
  target?: CodebookTarget;
  preset?: string | null;
};

/** Fresh, meaningless ids: the server stores them in clear on documents. */
export function newCodeId(): string {
  return crypto.randomUUID();
}

export function useCreateCodebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CodebookInput): Promise<CodebookDTO> => {
      const scope = {
        allStudies: input.allStudies,
        studyIds: input.studyIds,
      };
      const content = await buildContent(
        { name: input.name, codes: input.codes },
        scope,
      );

      const response = await fetchGateway("/api/codebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          allStudies: input.allStudies,
          studyIds: input.studyIds,
          target: input.target ?? DEFAULT_CODEBOOK_TARGET,
          preset: input.preset ?? null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create codebook");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codebooks"] });
    },
  });
}

export function useUpdateCodebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CodebookInput> & { id: string }) => {
      const body: Record<string, unknown> = {};

      if (input.allStudies !== undefined) body.allStudies = input.allStudies;
      if (input.studyIds !== undefined) body.studyIds = input.studyIds;
      if (input.target !== undefined) body.target = input.target;

      // Name or codes changed: re-encrypt for the scope the codebook will have
      // after this update, not the one it had before.
      if (input.name !== undefined || input.codes !== undefined) {
        const current = queryClient
          .getQueryData<DecryptedCodebook[]>(["codebooks"])
          ?.find((c) => c.id === id);
        const scope = {
          allStudies: input.allStudies ?? current?.allStudies ?? false,
          studyIds: input.studyIds ?? current?.studyIds ?? [],
        };
        body.content = await buildContent(
          {
            name: input.name ?? current?.name ?? "",
            codes: input.codes ?? current?.codes ?? [],
          },
          scope,
        );
      }

      const response = await fetchGateway(`/api/codebooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update codebook");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codebooks"] });
    },
  });
}

export function useDeleteCodebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchGateway(`/api/codebooks/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete codebook");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codebooks"] });
      // Documents keep stale refs; the list reflects that once refetched.
      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
    },
  });
}

/**
 * Grants a newly-shared collaborator access to the codebooks covering a study.
 * Called right after a document is shared: the codebook AES key can only be
 * rewrapped here, where the owner's private key lives.
 *
 * Failures are reported but never block the document share itself — the
 * collaborator simply sees no code names until the next share or edit.
 */
export function useShareCodebooksForStudy() {
  const { data: encryptionState } = useEncryptionStatus();
  const queryClient = useQueryClient();

  return async (projectId: string | null | undefined, accessor: Accessor) => {
    const privateKey = encryptionState?.privateKey;
    const publicKey = encryptionState?.publicKey;
    if (!privateKey || !publicKey) return;

    const response = await fetchGateway("/api/codebooks");
    if (!response.ok) return;
    const { codebooks } = (await response.json()) as {
      codebooks: CodebookDTO[];
    };

    const inScope = codebooks.filter(
      (c) => c.allStudies || (!!projectId && c.studyIds.includes(projectId)),
    );

    const utils = new EncryptionUtils(browserCrypto);
    const newAccessor: EncryptedAccessorEntity = {
      userId: accessor.userId,
      publicKey: accessor.publicKey,
      metadata: { sharedAt: new Date().toISOString() },
    };

    for (const codebook of inScope) {
      if (!isEncryptedEntity(codebook.content)) continue;
      if (
        codebook.content.privateKeys.some(
          (k) => k.publicKey === accessor.publicKey,
        )
      ) {
        continue;
      }
      try {
        const shared = await utils.share(
          codebook.content,
          newAccessor,
          privateKey,
          publicKey,
        );
        await fetchGateway(`/api/codebooks/${codebook.id}/accessors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privateKeys: shared.privateKeys }),
        });
      } catch (error) {
        console.error("Failed to share codebook", codebook.id, error);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["codebooks"] });
  };
}
