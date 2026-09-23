"use client";

import { useExcerptPanel } from "@/components/codebooks/excerpts/excerpt-panel-context";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { DocumentViewSettings } from "@/components/sidebar/document-view-settings";
import {
  PhaseGroupLabel,
  PhaseSection,
} from "@/components/sidebar/phase-section";
import { SidebarUserMenu } from "@/components/sidebar/sidebar-user-menu";
import { StudyList, type StudyEntry } from "@/components/sidebar/study-list";
import { TranscriptionMenuItem } from "@/components/sidebar/transcription-menu-item";
import {
  WORKSPACE_AREAS,
  type WorkspaceArea,
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
  STUDY_SCOPE_NONE,
  type GroupLabel,
  type StudyScope,
} from "@/lib/documents/grouping";
import {
  FilePlusCornerIcon,
  HomeIcon,
  LayoutGridIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
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
      if (doc.study && !byId.has(doc.study.id))
        byId.set(doc.study.id, doc.study);
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

  // Only codebooks whose codes land on a document — its own codes, or the codes
  // of its participants — and that can apply to the documents listed: a study's
  // own codebooks, not only the ones covering every study.
  const groupingCodebooks = React.useMemo(
    () =>
      groupableCodebooks(
        codebooks,
        scope === STUDY_SCOPE_ALL
          ? undefined
          : scope === STUDY_SCOPE_NONE
            ? null
            : scope,
      ),
    [codebooks, scope],
  );

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
  const matching = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return transcriptions;
    // Typing a study name keeps all of its documents, whatever the grouping is.
    return transcriptions.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.projectId
          ? projectsById.get(t.projectId)?.name.toLowerCase().includes(query)
          : false),
    );
  }, [transcriptions, searchQuery, projectsById]);

  // The search is applied BEFORE the scope, not after, so the same filtered set
  // can be counted per study: a search that matches nothing here tells you at a
  // glance which other study it does match.
  const documents = React.useMemo(
    () => filterByStudy(matching, scope),
    [matching, scope],
  );

  /**
   * Every scope the sidebar can be put into, in display order: the studies first
   * (alphabetical, as `studies` already is), then the two views, which are ways of
   * looking at the corpus rather than places in it.
   */
  const studyEntries: StudyEntry[] = React.useMemo(
    () => [
      ...studies.map((study) => ({
        scope: study.id as StudyScope,
        study,
        label: study.name,
        documentCount: filterByStudy(matching, study.id).length,
      })),
      {
        scope: STUDY_SCOPE_ALL,
        label: t("study.all"),
        documentCount: matching.length,
      },
      {
        scope: STUDY_SCOPE_NONE,
        label: t("study.none"),
        documentCount: filterByStudy(matching, STUDY_SCOPE_NONE).length,
      },
    ],
    [studies, matching, t],
  );

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
  const area: WorkspaceArea = betaFeatures ? prefs.phase : "transcription";

  /**
   * The interview the analysis table is currently narrowed to, if any.
   *
   * Read from the excerpt panel's context — which the analysis page sets — rather
   * than from `useSearchParams`: this component is in the layout wrapping every
   * route, and that hook there would demand a Suspense boundary around all of
   * them. Guarded by the route, because the editor reports a document too.
   */
  const panel = useExcerptPanel();
  const analysisDocumentId = pathname.endsWith("/analysis")
    ? panel.context.documentId
    : null;

  /** The study the two workshops are about, when the scope names a real one. */
  const study =
    scope !== STUDY_SCOPE_ALL && scope !== STUDY_SCOPE_NONE ? scope : null;

  /**
   * The sections on offer. Analysis needs a study to be about — it has no
   * document route at all, only a page for the corpus — so it is absent while the
   * sidebar is showing every study, or the documents filed under none.
   */
  const areas = WORKSPACE_AREAS.filter(
    (value) =>
      (betaFeatures || value === "transcription") &&
      (value !== "analysis" || study),
  );

  /**
   * The documents the later passes list.
   *
   * A document still being transcribed, or one whose transcription failed, has no
   * settled text: there is nothing to code and nothing to analyse. Listing it
   * there offered a row that opens onto a spinner or an error — those belong to
   * editing, which is where they are dealt with.
   */
  const readable = React.useMemo(
    () => documents.filter((doc) => doc.state === "COMPLETED"),
    [documents],
  );

  const readableGroups = React.useMemo(
    () =>
      groupDocuments({
        documents: readable,
        projects: studies,
        codebooks: groupingCodebooks,
        groupBy,
        sortBy: prefs.sortBy,
      }),
    [readable, studies, groupingCodebooks, groupBy, prefs.sortBy],
  );

  // Outside of the "by study" grouping the study is no longer implied by the
  // header, so each row carries it as a prefix.
  const studyFor = (doc: { projectId?: string; study?: Project | null }) =>
    groupBy === "study" || scope !== STUDY_SCOPE_ALL
      ? null
      : (doc.study ??
        (doc.projectId ? projectsById.get(doc.projectId) : null) ??
        null);

  const viewSettings = (
    <DocumentViewSettings
      groupBy={groupBy}
      sortBy={prefs.sortBy}
      codebooks={groupingCodebooks}
      allowGroupByStudy={scope === STUDY_SCOPE_ALL}
      onChange={update}
    />
  );

  /**
   * Opening a section.
   *
   * It sets which list is shown — and, when a document is actually open, moves
   * that document into the phase too. The phase lives in the URL, and the page
   * pushes it back onto these preferences, so a header that only changed the
   * preference was immediately overruled by the document still being in the other
   * one: the section snapped shut and coding could not be left. Changing the URL
   * is what makes the header a switch rather than a suggestion.
   *
   * Analysis is not a phase of a document, so it moves the PAGE instead: there is
   * one screen for it, the study's excerpt table. And leaving it has to move the
   * page too, or the sidebar would say "coding" over a screen that is still the
   * analysis table.
   */
  const openArea = (value: WorkspaceArea) => {
    update({ phase: value });

    if (value === "analysis") {
      if (study) router.push(`/app/project/${study}/analysis`);
      return;
    }

    if (/^\/app\/project\/[^/]+\/analysis/.test(pathname)) {
      router.push(
        value === "coding" && study
          ? `/app/project/${study}/coding`
          : study
            ? `/app/project/${study}`
            : "/app",
      );
      return;
    }

    const open = /^\/app\/transcription\/([^/]+)/.exec(pathname);
    if (!open) return;
    // Read from the URL itself rather than through `useSearchParams`: this lives
    // in the layout, which wraps every route, and that hook would demand a
    // Suspense boundary around all of them. Inside a click handler there is
    // always a window.
    const query = new URLSearchParams(window.location.search);
    if (value === "transcription") query.delete("phase");
    else query.set("phase", value);
    const suffix = query.toString();
    router.replace(
      `/app/transcription/${open[1]}${suffix ? `?${suffix}` : ""}`,
      { scroll: false },
    );
  };

  /** The list of one section: its groups, its rows, and where each row opens. */
  const areaList = (of: WorkspaceArea) => {
    const shown = of === "transcription" ? groups : readableGroups;
    const count = of === "transcription" ? documents.length : readable.length;

    if (count === 0) {
      return (
        <p className="px-3.5 py-1.5 text-xs text-sidebar-foreground/60">
          {searchQuery.trim() ? t("noResults") : t("study.empty")}
        </p>
      );
    }
    return shown.map((group) => (
      <React.Fragment key={group.key}>
        {/* One group is the whole list: a header over all of it says nothing the
            section header above has not already said. */}
        {shown.length > 1 && (
          <PhaseGroupLabel>
            {groupLabelText(group.label, t, (id) => projectsById.get(id)?.name)}
          </PhaseGroupLabel>
        )}
        <SidebarMenu>
          {group.documents.map((transcription) => {
            // In analysis the row is a FILTER on the study's table, not a
            // document to open — so it stays on that page and names the
            // interview in the query string.
            const analysisHref =
              of === "analysis" && study
                ? `/app/project/${study}/analysis?document=${transcription.id}`
                : undefined;
            return (
              <TranscriptionMenuItem
                key={transcription.id}
                transcription={transcription}
                study={studyFor(transcription)}
                phase={of === "coding" ? "coding" : "transcription"}
                href={analysisHref}
                indented
                shared={transcription.isOwner === false}
                isActive={
                  analysisHref
                    ? pathname.endsWith("/analysis") &&
                      analysisDocumentId === transcription.id
                    : pathname === `/app/transcription/${transcription.id}` &&
                      area === of
                }
              />
            );
          })}
        </SidebarMenu>
      </React.Fragment>
    ));
  };

  const codedCount = readable.filter(
    (doc) => (doc.codes ?? []).length > 0,
  ).length;

  /**
   * The one action that belongs INSIDE a phase rather than beside it.
   *
   * Each pass has a thing you do before working through the list: add material to
   * transcribe, or step back and look at the whole study's coding. They used to be
   * an icon on the study band, which put them at the same level as choosing a study
   * and made them hard to find; as the first row of the phase they read as what
   * they are, the start of that pass.
   *
   * The coding board needs a real study to be about, so it is absent on "all
   * studies" and on the loose documents.
   */
  const areaLead = (of: WorkspaceArea) => {
    if (of === "transcription") {
      return (
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href={study ? `/app/new?projectId=${study}` : "/app/new"}>
              <SidebarMenuButton className="pl-3.5 text-sidebar-foreground/80">
                <PlusIcon className="h-4 w-4" />
                {t("addDocument")}
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      );
    }

    if (!study) return null;
    const href = `/app/project/${study}/${of}`;
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Link href={href}>
            <SidebarMenuButton
              // In analysis the overview is the page with NO document filter, so
              // it is the active row exactly when no document is named.
              isActive={
                pathname === href && (of !== "analysis" || !analysisDocumentId)
              }
              className="pl-3.5 text-sidebar-foreground/80"
            >
              <LayoutGridIcon className="h-4 w-4" />
              {t("overview")}
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          {/* Logo Section. The header already pads; only the horizontal inset is
              ours, so the mark lines up with the menu icons below it. */}
          <div className="flex h-8 items-center gap-2 px-2">
            <img
              src="/logo.svg"
              alt="Logo"
              className="flex items-center justify-center w-7 h-7"
            />
            <h2 className="text-lg font-bold">humanlogs</h2>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-1">
          <SidebarMenu className="gap-0.5 px-2">
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

            {/* Separated from the two links above: this filters the documents in
                the block below, it is not a third place to go. */}
            <SidebarMenuItem className="mt-1 mb-3">
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted-foreground" />
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

          {/* The study says what the list is about; the phases are the list. The
              scope used to be a DROPDOWN, which hid how many studies there were
              behind a click — a corpus you cannot see the shape of is one you
              navigate from memory. The others are laid out under the open one
              instead, closed, one click from taking its place. Full-bleed, so the
              current study reads as the heading of everything below rather than as
              a box beside the navigation. The phases' filled headers and the group
              rules inside them are still three distinct devices, which is what
              keeps three levels of heading legible in 256px. */}
          <SidebarGroup className="p-0">
            <StudyList
              entries={studyEntries}
              scope={scope}
              onChange={(studyScope) => update({ studyScope })}
            >
              <div className="flex flex-col gap-0.5 px-2 py-1.5">
                {areas.map((value) => (
                  <PhaseSection
                    key={value}
                    label={tCoding(value)}
                    count={
                      value === "coding"
                        ? `${codedCount}/${readable.length}`
                        : String(
                            value === "transcription"
                              ? documents.length
                              : readable.length,
                          )
                    }
                    area={value}
                    open={area === value}
                    onOpen={() => openArea(value)}
                    action={viewSettings}
                  >
                    {areaLead(value)}
                    {areaList(value)}
                  </PhaseSection>
                ))}
              </div>
            </StudyList>
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
