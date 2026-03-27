"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
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
} from "@/components/ui/sidebar";
import {
  useProjects,
  useTranscriptions,
  useUpdateUserLanguage,
  useUserProfile,
} from "@/hooks/use-api";
import { MicIcon, PencilIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useProjectModal } from "./project-create-modal";

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

  // Fetch data using React Query
  const { data: projects = [] } = useProjects();
  const { data: transcriptions = [] } = useTranscriptions();
  const { data: userProfile } = useUserProfile();
  const updateLanguage = useUpdateUserLanguage();

  // Sync language with locale provider when user profile loads
  React.useEffect(() => {
    if (
      userProfile?.language &&
      ["en", "fr", "es", "de"].includes(userProfile.language)
    ) {
      setLocale(userProfile.language as "en" | "fr" | "es" | "de");
    }
  }, [userProfile, setLocale]);

  // Combine projects with their transcriptions
  const projectsWithTranscriptions = React.useMemo(() => {
    return projects.map((project) => ({
      ...project,
      transcriptions: transcriptions
        .filter((t) => t.projectId === project.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }));
  }, [projects, transcriptions]);

  // Get unassigned transcriptions
  const unassignedTranscriptions = React.useMemo(() => {
    return transcriptions
      .filter((t) => !t.projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [transcriptions]);

  const handleLocaleChange = async (newLocale: "en" | "fr" | "es" | "de") => {
    setLocale(newLocale);
    try {
      await updateLanguage.mutateAsync(newLocale);
    } catch (error) {
      console.error("Error saving language:", error);
    }
  };

  // Check if there are any transcriptions
  const hasTranscriptions = transcriptions.length > 0;

  // Filter projects and their transcriptions
  const filteredProjects = React.useMemo(() => {
    if (!searchQuery.trim()) return projectsWithTranscriptions;

    const query = searchQuery.toLowerCase();
    return projectsWithTranscriptions
      .map((project) => ({
        ...project,
        transcriptions: project.transcriptions.filter((t) =>
          t.title.toLowerCase().includes(query),
        ),
      }))
      .filter(
        (project) =>
          project.transcriptions.length > 0 ||
          project.name.toLowerCase().includes(query),
      );
  }, [searchQuery, projectsWithTranscriptions]);

  const filteredUnassigned = React.useMemo(() => {
    if (!searchQuery.trim()) return unassignedTranscriptions;
    const query = searchQuery.toLowerCase();
    return unassignedTranscriptions.filter((t) =>
      t.title.toLowerCase().includes(query),
    );
  }, [searchQuery, unassignedTranscriptions]);

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          {/* Logo Section */}
          <div className="flex items-center gap-2 px-2 py-2">
            <img
              src="/logo-black.png"
              alt="Logo"
              className="flex dark:hidden items-center justify-center w-5 h-5"
            />
            <img
              src="/logo.svg"
              alt="Logo"
              className="dark:flex hidden items-center justify-center w-5 h-5"
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Transcription</h2>
            </div>
          </div>

          {/* New Transcription Button */}
          <div className="px-2 py-2">
            <Link href="/new">
              <Button className="w-full bg-blue-500 text-white" size="lg">
                {t("newTranscription")}
              </Button>
            </Link>
          </div>
        </SidebarHeader>

        <SidebarContent className="pt-2">
          {/* Search only shown when there are transcriptions */}
          {hasTranscriptions && (
            <div className="px-4 pb-2">
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <SidebarInput
                  type="search"
                  placeholder={t("search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          )}

          {/* Projects with transcriptions */}
          {filteredProjects.map((project) => (
            <SidebarGroup key={project.id}>
              <SidebarGroupLabel className="group/label">
                <span className="">{project.name}</span>
                <Button
                  type="button"
                  className="opacity-0 group-hover/label:opacity-100 transition-opacity"
                  variant={"ghost"}
                  size={"icon-xs"}
                  onClick={() => {
                    openRename(project.id, project.name);
                  }}
                  aria-label="Edit project name"
                >
                  <PencilIcon className="h-3 w-3" />
                </Button>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {project.transcriptions.map((transcription) => (
                    <TranscriptionMenuItem
                      key={transcription.id}
                      transcription={transcription}
                      isActive={
                        pathname === `/transcription/${transcription.id}`
                      }
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          {/* No Projects section */}
          {filteredUnassigned.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>No Projects</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredUnassigned.map((transcription) => (
                    <TranscriptionMenuItem
                      key={transcription.id}
                      transcription={transcription}
                      isActive={
                        pathname === `/transcription/${transcription.id}`
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
