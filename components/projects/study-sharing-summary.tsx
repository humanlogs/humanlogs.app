"use client";

import { useTranslations } from "@/components/locale-provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useShareContacts, type SharedUser } from "@/hooks/use-transcriptions";

type StudyDocument = { id: string; title: string; shared?: SharedUser[] };

/**
 * Who has access to which documents of a study, one row per person. Renders
 * nothing until at least one document of the study is shared.
 *
 * Grouped from the document list the page already holds; names come from the
 * share contacts, which by construction include everyone on your documents.
 */
export function StudySharingSummary({
  documents,
}: {
  documents: StudyDocument[];
}) {
  const t = useTranslations("study");
  const byPerson = new Map<string, StudyDocument[]>();
  for (const doc of documents) {
    for (const s of doc.shared ?? []) {
      byPerson.set(s.userId, [...(byPerson.get(s.userId) ?? []), doc]);
    }
  }

  const { data: contacts = [] } = useShareContacts(byPerson.size > 0);
  if (byPerson.size === 0) return null;

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  // Most widely shared first, then by name: the study's core team on top.
  const people = [...byPerson.entries()]
    .map(([userId, docs]) => ({
      userId,
      docs,
      contact: contactById.get(userId),
    }))
    .sort(
      (a, b) =>
        b.docs.length - a.docs.length ||
        (a.contact?.name || a.contact?.email || "").localeCompare(
          b.contact?.name || b.contact?.email || "",
        ),
    );

  return (
    <section className="space-y-3" data-testid="study-sharing-summary">
      <h2 className="text-sm font-medium text-muted-foreground">
        {t("sharing.title", { count: people.length })}
      </h2>
      <ul className="divide-y rounded-lg border">
        {people.map(({ userId, docs, contact }) => (
          <li key={userId} className="flex items-start gap-3 px-3 py-2.5">
            <UserAvatar user={contact ?? {}} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {contact?.name || contact?.email || t("sharing.unknownUser")}
              </div>
              {contact?.name && (
                <div className="truncate text-xs text-muted-foreground">
                  {contact.email}
                </div>
              )}
              {docs.length < documents.length && (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {docs.map((d) => d.title).join(", ")}
                </div>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {docs.length === documents.length
                ? t("sharing.allDocuments")
                : docs.length === 1
                  ? t("sharing.someDocumentsOne", { total: documents.length })
                  : t("sharing.someDocumentsOther", {
                      count: docs.length,
                      total: documents.length,
                    })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
