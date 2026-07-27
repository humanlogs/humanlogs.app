"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { DocumentViewSettings } from "@/components/sidebar/document-view-settings";
import { SidebarUserMenu } from "@/components/sidebar/sidebar-user-menu";
import { TranscriptionMenuItem } from "@/components/sidebar/transcription-menu-item";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useProjects, useUpdateUser, useUserProfile } from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import { useDocumentViewPrefs } from "@/hooks/use-document-view-prefs";
import { groupableCodebooks } from "@/lib/codebooks/codebook";
import {
  groupDocuments,
  sortDocuments,
  type GroupLabel,
} from "@/lib/documents/grouping";
import {
  FilePlusCornerIcon,
  HomeIcon,
  PencilIcon,
  SearchIcon,
  ShieldIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useTranscriptions } from "../hooks/use-transcriptions";
import { useWelcomeRedirect } from "../hooks/use-welcome-redirect";
import { Locale, locales } from "../lib/utils/i18n";
import { useProjectModal } from "./dialogs/project-create-modal";

/**
 * Headers for the groups that aren't a study — studies render their own link
 * and rename button.
 */
function groupLabelText(
  label: GroupLabel,
  t: (key: string) => string,
): string {
  switch (label.type) {
    case "study":
      return t("unassigned");
    case "bucket":
      return t(`view.buckets.${label.bucket}`);
    case "code":
      return label.codeId ? label.label : t("view.uncoded");
  }
}

type AppSidebarProps = {
  user: {
    email?: string;
    name?: string;
    picture?: string;
  };
  children?: React.ReactNode;
};

export function AppSidebar({ user, children }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const { setLocale } = useLocale();
  const [searchQuery, setSearchQuery] = React.useState("");
  const { openRename } = useProjectModal();
  useWelcomeRedirect();

  // Fetch data using React Query
  const { data: projects = [] } = useProjects();
  const { data: transcriptions = [] } = useTranscriptions();
  const { data: userProfile } = useUserProfile();
  const { data: codebooks = [] } = useCodebooks();
  const updateLanguage = useUpdateUser();
  const { prefs, update } = useDocumentViewPrefs();

  // Only roots that cover every study are offered as a grouping axis.
  const groupingCodebooks = React.useMemo(
    () => groupableCodebooks(codebooks),
    [codebooks],
  );

  // Sync language with locale provider when user profile loads
  React.useEffect(() => {
    if (userProfile?.language && locales.includes(userProfile.language)) {
      setLocale(userProfile.language as Locale);
    }
  }, [userProfile, setLocale]);

  // Separate owned and shared transcriptions
  const ownedTranscriptions = React.useMemo(() => {
    return transcriptions.filter((t) => t.isOwner !== false);
  }, [transcriptions]);

  const sharedTranscriptions = React.useMemo(() => {
    return transcriptions.filter((t) => t.isOwner === false);
  }, [transcriptions]);

  const projectsById = React.useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const handleLocaleChange = async (newLocale: "en" | "fr" | "es" | "de") => {
    setLocale(newLocale);
    try {
      await updateLanguage.mutateAsync({ language: newLocale });
    } catch (error) {
      console.error("Error saving language:", error);
    }
  };

  // Searching matches a document's title or its study's name — typing a study
  // name keeps all of its documents, whatever the current grouping is.
  const filteredOwned = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ownedTranscriptions;
    return ownedTranscriptions.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.projectId
          ? projectsById.get(t.projectId)?.name.toLowerCase().includes(query)
          : false),
    );
  }, [ownedTranscriptions, searchQuery, projectsById]);

  const groups = React.useMemo(
    () =>
      groupDocuments({
        documents: filteredOwned,
        projects,
        codebooks: groupingCodebooks,
        groupBy: prefs.groupBy,
        sortBy: prefs.sortBy,
      }),
    [filteredOwned, projects, groupingCodebooks, prefs.groupBy, prefs.sortBy],
  );

  const filteredShared = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matching = query
      ? sharedTranscriptions.filter((t) =>
          t.title.toLowerCase().includes(query),
        )
      : sharedTranscriptions;
    return sortDocuments(matching, prefs.sortBy);
  }, [searchQuery, sharedTranscriptions, prefs.sortBy]);

  // The display-options button lives on the first header only — one control for
  // the whole list. It falls through to the shared section so an account with
  // only shared documents still has it.
  const settingsGroupKey = groups[0]?.key ?? "shared";

  // Outside of the "by study" grouping the study is no longer implied by the
  // header, so each row carries it as a prefix.
  const studyFor = (projectId?: string | null) =>
    prefs.groupBy === "study" || !projectId
      ? null
      : (projectsById.get(projectId) ?? null);

  const viewSettings = (
    <DocumentViewSettings
      groupBy={prefs.groupBy}
      sortBy={prefs.sortBy}
      codebooks={groupingCodebooks}
      onChange={update}
    />
  );

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          {/* Logo Section */}
          <div className="flex items-center gap-2 px-2 py-2">
            <img
              src="/logo.svg"
              alt="Logo"
              className="flex items-center justify-center w-7 h-7"
            />
            <h2 className="text-lg font-bold">humanlogs</h2>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu className="px-2">
            <SidebarMenuItem>
              <Link href="/app">
                <SidebarMenuButton isActive={pathname === "/app"}>
                  <HomeIcon className="h-4 w-4" />
                  {t("home")}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <Link href="/app/new">
                <SidebarMenuButton isActive={pathname === "/app/new"}>
                  <FilePlusCornerIcon className="h-4 w-4" />
                  {t("newTranscription")}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>

            {/* Admin Panel Link */}
            {userProfile?.isAdmin && (
              <SidebarMenuItem>
                <Link href="/app/admin">
                  <SidebarMenuButton isActive={pathname === "/app/admin"}>
                    <ShieldIcon className="h-4 w-4" />
                    Admin Panel
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}

            <SidebarMenuItem>
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none" />
                <SidebarInput
                  type="search"
                  placeholder={t("search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 border-none bg-transparent! focus:ring-0 focus-visible:ring-0"
                />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Documents, grouped and sorted per the display options */}

          {groups.map((group) => {
            const project =
              group.label.type === "study" && group.label.projectId
                ? projectsById.get(group.label.projectId)
                : undefined;

            return (
              <SidebarGroup key={group.key}>
                <SidebarGroupLabel className="group/label">
                  {project ? (
                    <>
                      <Link
                        href={`/app/project/${project.id}`}
                        className="flex-1 truncate hover:underline"
                      >
                        {project.name}
                      </Link>
                      <Button
                        type="button"
                        className="opacity-0 group-hover/label:opacity-100 transition-opacity"
                        variant={"ghost"}
                        size={"icon-xs"}
                        onClick={() => {
                          openRename(project.id, project.name);
                        }}
                        aria-label="Edit study name"
                      >
                        <PencilIcon className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <span className="flex-1 truncate">
                      {groupLabelText(group.label, t)}
                    </span>
                  )}
                  {group.key === settingsGroupKey && viewSettings}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.documents.map((transcription) => (
                      <TranscriptionMenuItem
                        key={transcription.id}
                        transcription={transcription}
                        study={studyFor(transcription.projectId)}
                        isActive={
                          pathname === `/app/transcription/${transcription.id}`
                        }
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}

          {/* Shared section */}
          {filteredShared.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel className="group/label">
                <span className="flex-1 truncate">{t("shared")}</span>
                {settingsGroupKey === "shared" && viewSettings}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredShared.map((transcription) => (
                    <TranscriptionMenuItem
                      key={transcription.id}
                      transcription={transcription}
                      isActive={
                        pathname === `/app/transcription/${transcription.id}`
                      }
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarUserMenu
            user={user}
            userProfile={userProfile || null}
            onLocaleChange={handleLocaleChange}
          />
        </SidebarFooter>
      </Sidebar>
      {children}
    </>
  );
}
