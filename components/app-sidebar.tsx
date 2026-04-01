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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects, useUpdateUser, useUserProfile } from "@/hooks/use-api";
import { FilePlusCornerIcon, PencilIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useTranscriptions } from "../hooks/use-transcriptions";
import { useWelcomeRedirect } from "../hooks/use-welcome-redirect";
import { Locale, locales } from "../lib/i18n";
import { useProjectModal } from "./dialogs/project-create-modal";

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
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  const { data: transcriptions = [], isLoading: isLoadingTranscriptions } =
    useTranscriptions();
  const { data: userProfile } = useUserProfile();
  const updateLanguage = useUpdateUser();

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
    return transcriptions
      .filter((t) => t.isOwner === false)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [transcriptions]);

  // Combine projects with their transcriptions (owned only)
  const projectsWithTranscriptions = React.useMemo(() => {
    return projects.map((project) => ({
      ...project,
      transcriptions: ownedTranscriptions
        .filter((t) => t.projectId === project.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }));
  }, [projects, ownedTranscriptions]);

  // Get unassigned transcriptions (owned only)
  const unassignedTranscriptions = React.useMemo(() => {
    return ownedTranscriptions
      .filter((t) => !t.projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [ownedTranscriptions]);

  const handleLocaleChange = async (newLocale: "en" | "fr" | "es" | "de") => {
    setLocale(newLocale);
    try {
      await updateLanguage.mutateAsync({ language: newLocale });
    } catch (error) {
      console.error("Error saving language:", error);
    }
  };

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

  const filteredShared = React.useMemo(() => {
    if (!searchQuery.trim()) return sharedTranscriptions;
    const query = searchQuery.toLowerCase();
    return sharedTranscriptions.filter((t) =>
      t.title.toLowerCase().includes(query),
    );
  }, [searchQuery, sharedTranscriptions]);

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
          <div className="px-2">
            <SidebarMenuItem>
              <Link href="/app/new">
                <SidebarMenuButton isActive={pathname === "/new"}>
                  <FilePlusCornerIcon className="h-4 w-4" />
                  {t("newTranscription")}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>

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
          </div>

          {/* Projects with transcriptions */}
          {isLoadingProjects || isLoadingTranscriptions ? (
            // Skeleton loading state
            <>
              <SidebarGroup>
                <SidebarGroupLabel>
                  <Skeleton className="h-4 w-24" />
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {[1, 2, 3].map((i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuButton>
                          <Skeleton className="h-4 w-full" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel>
                  <Skeleton className="h-4 w-32" />
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {[1, 2].map((i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuButton>
                          <Skeleton className="h-4 w-full" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          ) : (
            <>
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
                            pathname ===
                            `/app/transcription/${transcription.id}`
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
                            pathname ===
                            `/app/transcription/${transcription.id}`
                          }
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              {/* Shared section */}
              {filteredShared.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>{t("shared")}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredShared.map((transcription) => (
                        <TranscriptionMenuItem
                          key={transcription.id}
                          transcription={transcription}
                          isActive={
                            pathname ===
                            `/app/transcription/${transcription.id}`
                          }
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </>
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
