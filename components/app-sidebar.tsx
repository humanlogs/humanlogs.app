"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { DocumentViewSettings } from "@/components/sidebar/document-view-settings";
import {
  PhaseGroupLabel,
  PhaseSection,
} from "@/components/sidebar/phase-section";
import { SidebarUserMenu } from "@/components/sidebar/sidebar-user-menu";
import { StudyPicker } from "@/components/sidebar/study-picker";
import { TranscriptionMenuItem } from "@/components/sidebar/transcription-menu-item";
import {
  DOCUMENT_PHASES,
  type DocumentPhase,
} from "@/components/transcriptions/editor/phase";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  useBetaFeatures,
  useProjects,
  useUpdateUser,
  useUserProfile,
  type Project,
} from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import { useDocumentViewPrefs } from "@/hooks/use-document-view-prefs";
import { groupableCodebooks } from "@/lib/codebooks/codebook";
import {
  codebookIdFromGroupBy,
  DEFAULT_GROUP_BY,
  filterByStudy,
  groupByForScope,
  groupDocuments,
  STUDY_SCOPE_ALL,
  type GroupLabel,
  type StudyScope,
} from "@/lib/documents/grouping";
import {
  FilePlusCornerIcon,
  HomeIcon,
  SearchIcon,
  ShieldIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useTranscriptions } from "../hooks/use-transcriptions";
import { useWelcomeRedirect } from "../hooks/use-welcome-redirect";
import { Locale, locales } from "../lib/utils/i18n";

/**
 * The text of a group header. `studyName` resolves a study group — grouping by
 * study only happens while looking at every study, where the header is the only
 * thing naming it; a group with no study is the documents never filed.
 */
function groupLabelText(
  label: GroupLabel,
  t: (key: string) => string,
  studyName: (projectId: string) => string | undefined,
): string {
  switch (label.type) {
    case "study":
      return (
        (label.projectId ? studyName(label.projectId) : null) ?? t("unassigned")
      );
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
  const tCoding = useTranslations("codebook.coding.phase");
  const { setLocale } = useLocale();
  const [searchQuery, setSearchQuery] = React.useState("");
  useWelcomeRedirect();

  // Fetch data using React Query
  const { data: projects = [] } = useProjects();
  const { data: transcriptions = [] } = useTranscriptions();
  const { data: userProfile } = useUserProfile();
  const { data: codebooks = [] } = useCodebooks();
  const updateLanguage = useUpdateUser();
  const { prefs, update } = useDocumentViewPrefs();

  // Only codebooks covering every study, and only those whose codes land on a
  // document — its own codes, or the codes of its participants.
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

  /**
   * Every study reachable from the document list, own or received.
   *
   * Not `useProjects()` alone: that is scoped to the studies you own, and a
   * document shared with you belongs to somebody else's — which the list now
   * carries, precisely so the scope can name it.
   */
  const studies: Project[] = React.useMemo(() => {
    const byId = new Map<string, Project>(projects.map((p) => [p.id, p]));
    for (const doc of transcriptions) {
      if (doc.study && !byId.has(doc.study.id)) byId.set(doc.study.id, doc.study);
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [projects, transcriptions]);

  // A stored scope outlives the study it points at — a study deleted, or a share
  // withdrawn, must fall back to the whole corpus rather than to an empty list
  // with no way of telling why.
  const scope: StudyScope =
    prefs.studyScope === STUDY_SCOPE_ALL ||
    prefs.studyScope === "none" ||
    studies.some((study) => study.id === prefs.studyScope)
      ? prefs.studyScope
      : STUDY_SCOPE_ALL;

  // A stored `codebook:<id>` grouping outlives the codebook it points at —
  // leaving the beta, or losing access to it, must fall back to the default
  // axis rather than lumping every document under "uncoded". And grouping by
  // study says nothing once the list is scoped to one.
  const groupBy = React.useMemo(() => {
    const codebookId = codebookIdFromGroupBy(prefs.groupBy);
    const resolved =
      !codebookId ||
      groupingCodebooks.some((codebook) => codebook.id === codebookId)
        ? prefs.groupBy
        : DEFAULT_GROUP_BY;
    return groupByForScope(resolved, scope);
  }, [prefs.groupBy, groupingCodebooks, scope]);

  const projectsById = React.useMemo(
    () => new Map(studies.map((p) => [p.id, p])),
    [studies],
  );

  const handleLocaleChange = async (newLocale: "en" | "fr" | "es" | "de") => {
    setLocale(newLocale);
    try {
      await updateLanguage.mutateAsync({ language: newLocale });
    } catch (error) {
      console.error("Error saving language:", error);
    }
  };

  /**
   * The documents both phases list: the chosen study, matching the search.
   *
   * Owned and received are no longer split. A shared interview belongs to a
   * study like any other, and filing it under "Shared" said who gave it to you
   * instead of what it is about — the row carries that as a marker.
   */
  const documents = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const inScope = filterByStudy(transcriptions, scope);
    if (!query) return inScope;
    // Typing a study name keeps all of its documents, whatever the grouping is.
    return inScope.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.projectId
          ? projectsById.get(t.projectId)?.name.toLowerCase().includes(query)
          : false),
    );
  }, [transcriptions, scope, searchQuery, projectsById]);

  const groups = React.useMemo(
    () =>
      groupDocuments({
        documents,
        projects: studies,
        codebooks: groupingCodebooks,
        groupBy,
        sortBy: prefs.sortBy,
      }),
    [documents, studies, groupingCodebooks, groupBy, prefs.sortBy],
  );

  // Coding is part of the codebooks beta, like the phase switch in the header:
  // without the opt-in there is only one pass over a document, so there is only
  // one section and it needs no header at all.
  const betaFeatures = useBetaFeatures();
  const phase: DocumentPhase = betaFeatures ? prefs.phase : "transcription";

  // Outside of the "by study" grouping the study is no longer implied by the
  // header, so each row carries it as a prefix.
  const studyFor = (doc: { projectId?: string; study?: Project | null }) =>
    groupBy === "study" || scope !== STUDY_SCOPE_ALL
      ? null
      : (doc.study ?? (doc.projectId ? projectsById.get(doc.projectId) : null) ?? null);

  const viewSettings = (
    <DocumentViewSettings
      groupBy={groupBy}
      sortBy={prefs.sortBy}
      codebooks={groupingCodebooks}
      allowGroupByStudy={scope === STUDY_SCOPE_ALL}
      onChange={update}
    />
  );

  /** The list of one phase: its groups, its rows, and where each row opens. */
  const phaseList = (of: DocumentPhase) => {
    if (documents.length === 0) {
      return (
        <p className="px-3.5 py-1.5 text-xs text-sidebar-foreground/60">
          {searchQuery.trim() ? t("noResults") : t("study.empty")}
        </p>
      );
    }
    return groups.map((group) => (
      <React.Fragment key={group.key}>
        {/* One group is the whole list: a header over all of it says nothing the
            phase header above has not already said. */}
        {groups.length > 1 && (
          <PhaseGroupLabel>
            {groupLabelText(group.label, t, (id) => projectsById.get(id)?.name)}
          </PhaseGroupLabel>
        )}
        <SidebarMenu>
          {group.documents.map((transcription) => (
            <TranscriptionMenuItem
              key={transcription.id}
              transcription={transcription}
              study={studyFor(transcription)}
              phase={of}
              indented
              shared={transcription.isOwner === false}
              isActive={
                pathname === `/app/transcription/${transcription.id}` &&
                phase === of
              }
            />
          ))}
        </SidebarMenu>
      </React.Fragment>
    ));
  };

  const codedCount = documents.filter((doc) => (doc.codes ?? []).length > 0)
    .length;

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

          {/* The study is a folder, and the phases live inside it: the scope is
              not one of the things being listed, it says what the list is about.
              Its tab and the phases' filled headers are two different devices on
              purpose — with the grouping options adding a third level of heading
              inside, type weight alone could not tell them apart. */}
          <SidebarGroup className="pt-0">
            <div className="overflow-hidden rounded-lg border">
              <StudyPicker
                scope={scope}
                studies={studies}
                documentCount={documents.length}
                onChange={(studyScope) => update({ studyScope })}
              />

              <div className="flex flex-col gap-0.5 p-1.5">
                {DOCUMENT_PHASES.filter(
                  (value) => betaFeatures || value === "transcription",
                ).map((value) => (
                  <PhaseSection
                    key={value}
                    label={tCoding(value)}
                    count={
                      value === "coding"
                        ? `${codedCount}/${documents.length}`
                        : String(documents.length)
                    }
                    accent={value === "coding"}
                    open={phase === value}
                    onOpen={() => update({ phase: value })}
                    action={viewSettings}
                  >
                    {phaseList(value)}
                  </PhaseSection>
                ))}
              </div>
            </div>
          </SidebarGroup>
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
