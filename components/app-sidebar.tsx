"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "@/components/locale-provider";
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
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  SearchIcon,
  FileTextIcon,
  PencilIcon,
  FolderIcon,
  LogOutIcon,
  MicIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  MoonIcon,
  SunIcon,
  LanguagesIcon,
  CheckIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";

type Project = {
  id: string;
  name: string;
  transcriptions: Transcription[];
};

type Transcription = {
  id: string;
  title: string;
  updatedAt: Date;
};

type AppSidebarProps = {
  user: {
    email?: string;
    name?: string;
    picture?: string;
  };
};

// Mock data - this will be replaced with real data from API/database
const mockProjects: Project[] = [
  {
    id: "project-1",
    name: "Project A",
    transcriptions: [
      {
        id: "t1",
        title: "Meeting Notes - March 20",
        updatedAt: new Date("2026-03-20"),
      },
      {
        id: "t2",
        title: "Interview Recording",
        updatedAt: new Date("2026-03-19"),
      },
    ],
  },
  {
    id: "project-2",
    name: "Project B",
    transcriptions: [
      {
        id: "t3",
        title: "Podcast Episode 1",
        updatedAt: new Date("2026-03-18"),
      },
    ],
  },
];

const mockUnassignedTranscriptions: Transcription[] = [
  { id: "t4", title: "Random Audio File", updatedAt: new Date("2026-03-17") },
];

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const { locale, setLocale } = useLocale();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isHoveringAvatar, setIsHoveringAvatar] = React.useState(false);
  const { theme, setTheme } = useTheme();

  const handleLocaleChange = (newLocale: "en" | "fr" | "es" | "de") => {
    setLocale(newLocale);
  };

  // Mock credits data - replace with real data from API
  const creditsUsed = 750;
  const creditsTotal = 1000;
  const creditsPercentage = (creditsUsed / creditsTotal) * 100;

  // Mock plan data - replace with real data from API
  const planType = "Pro Plan";
  const renewalDate = "April 20, 2026";

  // Get user's initials
  const getUserInitial = () => {
    if (user.name) {
      return user.name.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Get current theme
  const currentTheme =
    theme === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  // Filter projects and their transcriptions
  const filteredProjects = React.useMemo(() => {
    if (!searchQuery.trim()) return mockProjects;

    const query = searchQuery.toLowerCase();
    return mockProjects
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
  }, [searchQuery]);

  const filteredUnassigned = React.useMemo(() => {
    if (!searchQuery.trim()) return mockUnassignedTranscriptions;
    const query = searchQuery.toLowerCase();
    return mockUnassignedTranscriptions.filter((t) =>
      t.title.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  return (
    <Sidebar>
      <SidebarHeader>
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
            <MicIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t("appName")}</h2>
            <p className="text-xs text-muted-foreground">{t("appSubtitle")}</p>
          </div>
        </div>

        {/* New Transcription Button */}
        <div className="px-2 py-2">
          <Link href="/new">
            <Button className="w-full bg-blue-500 text-white" size="lg">
              <PlusIcon className="mr-2 h-4 w-4" />
              {t("newTranscription")}
            </Button>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <div className="px-4">
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

        {/* Projects with transcriptions */}
        {filteredProjects.map((project) => (
          <SidebarGroup key={project.id}>
            <SidebarGroupLabel className="group/label">
              <FolderIcon className="mr-2 h-4 w-4" />
              <span className="flex-1">{project.name}</span>
              <button
                type="button"
                className="opacity-0 group-hover/label:opacity-100 transition-opacity"
                onClick={() => {
                  // TODO: Implement project name editing
                  console.log("Edit project:", project.id);
                }}
                aria-label="Edit project name"
              >
                <PencilIcon className="h-3 w-3" />
              </button>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {project.transcriptions.map((transcription) => (
                  <SidebarMenuItem key={transcription.id}>
                    <Link href={`/transcription/${transcription.id}`}>
                      <SidebarMenuButton
                        isActive={
                          pathname === `/transcription/${transcription.id}`
                        }
                      >
                        <FileTextIcon className="h-4 w-4" />
                        <span>{transcription.title}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* No Projects section */}
        {filteredUnassigned.length > 0 && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel>
              <FileTextIcon className="mr-2 h-4 w-4" />
              No Projects
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredUnassigned.map((transcription) => (
                  <SidebarMenuItem key={transcription.id}>
                    <Link href={`/transcription/${transcription.id}`}>
                      <SidebarMenuButton
                        isActive={
                          pathname === `/transcription/${transcription.id}`
                        }
                      >
                        <FileTextIcon className="h-4 w-4" />
                        <span>{transcription.title}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* User Avatar with Credits Progress - Entire footer is clickable */}
        <DropdownMenu
          trigger={
            <button
              className="flex items-center justify-between w-full px-4 py-3 rounded hover:bg-accent/50 transition-colors cursor-pointer"
              onMouseEnter={() => setIsHoveringAvatar(true)}
              onMouseLeave={() => setIsHoveringAvatar(false)}
            >
              {/* Avatar with Progress Ring */}
              <div className="relative w-10 h-10 shrink-0">
                {/* Background circle */}
                <svg className="w-10 h-10 transform -rotate-90 absolute inset-0">
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    className="text-muted-foreground/20"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${
                      2 * Math.PI * 18 * (1 - creditsPercentage / 100)
                    }`}
                    className="text-primary transition-all duration-300"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Avatar content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {isHoveringAvatar ? (
                    <span className="text-[10px] font-bold">
                      {Math.round(creditsPercentage)}%
                    </span>
                  ) : user.picture ? (
                    <Image
                      src={user.picture}
                      alt={user.name || "User"}
                      width={28}
                      height={28}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                      {getUserInitial()}
                    </div>
                  )}
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0 ml-3 text-left">
                <p className="text-sm font-medium truncate">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {creditsTotal - creditsUsed} credits left
                </p>
              </div>
            </button>
          }
          align="start"
        >
          {/* Account Info Section */}
          <div className="px-3 py-3 border-b">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{user.name || "User"}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-2">{planType}</p>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {t("user.credits")}
                </span>
                <span className="font-medium">
                  {creditsUsed} / {creditsTotal}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {t("user.renewal")}
                </span>
                <span className="font-medium">{renewalDate}</span>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <DropdownMenuItem onClick={() => console.log("Billing")}>
              <CreditCardIcon className="w-4 h-4 mr-2" />
              {t("user.billing")}
            </DropdownMenuItem>

            <DropdownMenuSub
              trigger={
                <>
                  {currentTheme === "dark" ? (
                    <MoonIcon className="w-4 h-4 mr-2" />
                  ) : (
                    <SunIcon className="w-4 h-4 mr-2" />
                  )}
                  {t("user.theme")}
                </>
              }
            >
              <DropdownMenuItem
                onClick={() => setTheme("light")}
                preventClose
                className="justify-between"
              >
                <span>{t("user.light")}</span>
                {theme === "light" && <CheckIcon className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme("dark")}
                preventClose
                className="justify-between"
              >
                <span>{t("user.dark")}</span>
                {theme === "dark" && <CheckIcon className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme("system")}
                preventClose
                className="justify-between"
              >
                <span>{t("user.system")}</span>
                {theme === "system" && <CheckIcon className="w-4 h-4" />}
              </DropdownMenuItem>
            </DropdownMenuSub>

            <DropdownMenuSub
              trigger={
                <>
                  <LanguagesIcon className="w-4 h-4 mr-2" />
                  {t("user.language")}
                </>
              }
            >
              {["en", "fr", "es", "de"].map((lang) => (
                <DropdownMenuItem
                  key={lang}
                  onClick={() =>
                    handleLocaleChange(lang as "en" | "fr" | "es" | "de")
                  }
                  className="justify-between"
                >
                  <span>{t(`languages.${lang}`)}</span>
                  {locale === lang && <CheckIcon className="w-4 h-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSub>

            <DropdownMenuItem
              onClick={() =>
                window.open("https://feedback.example.com", "_blank")
              }
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              {t("user.feedback")}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => window.open("https://help.example.com", "_blank")}
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              {t("user.help")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => (window.location.href = "/api/auth/logout")}
            >
              <LogOutIcon className="w-4 h-4 mr-2" />
              {t("user.logout")}
            </DropdownMenuItem>
          </div>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
