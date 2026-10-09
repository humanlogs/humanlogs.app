"use client";

import { useTranslations } from "@/components/locale-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useShareContacts } from "@/hooks/use-transcriptions";
import { Users2Icon } from "lucide-react";

/**
 * Everyone you share documents with, in either direction — the same list the
 * share dialog suggests from, so what you see here is what it will offer.
 */
export function CollaboratorsCard() {
  const t = useTranslations("account");
  const { data: contacts = [], isLoading } = useShareContacts();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users2Icon className="w-5 h-5" />
          {t("collaborators.title")}
        </CardTitle>
        <CardDescription>{t("collaborators.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("collaborators.empty")}
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <UserAvatar user={c} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {c.name || c.email}
                  </div>
                  {c.name && (
                    <div className="truncate text-xs text-muted-foreground">
                      {c.email}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.documents === 1
                    ? t("collaborators.documentsOne")
                    : t("collaborators.documentsOther", {
                        count: c.documents,
                      })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
