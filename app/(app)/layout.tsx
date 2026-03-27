import { redirect } from "next/navigation";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import auth0 from "@/lib/auth0";
import { ProjectCreateModal } from "@/components/project-create-modal";
import { TranscriptionRenameDialog } from "@/components/transcriptions/dialogs/transcription-rename-dialog";
import { TranscriptionDeleteDialog } from "@/components/transcriptions/dialogs/transcription-delete-dialog";
import { TranscriptionSetProjectDialog } from "@/components/transcriptions/dialogs/transcription-set-project-dialog";
import { TranscriptionExportDialog } from "@/components/transcriptions/dialogs/transcription-export-dialog";
import { TranscriptionHistorySheet } from "@/components/transcriptions/transcription-history-sheet";
import { VersionComparisonModal } from "@/components/transcriptions/dialogs/version-comparison-modal";
import { SpeakerOptionsDialog } from "@/components/transcriptions/dialogs/speaker-options-dialog";
import { ShortcutsDialog } from "@/components/transcriptions/dialogs/shortcuts-dialog";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar user={session.user}>
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 bg-background/50 backdrop-blur-lg z-10">
            <div className="border-b px-4 flex h-14 shrink-0 items-center gap-2 bg-background">
              <SidebarTrigger className="-ml-1" />
              <div
                id="header-actions-portal"
                className="flex-1 flex items-center justify-between"
              />
            </div>
            <div id="header-sub-portal" className="w-full" />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </SidebarInset>
      </AppSidebar>
      <ProjectCreateModal />
      <TranscriptionRenameDialog />
      <TranscriptionDeleteDialog />
      <TranscriptionSetProjectDialog />
      <TranscriptionExportDialog />
      <TranscriptionHistorySheet />
      <VersionComparisonModal />
      <SpeakerOptionsDialog />
      <ShortcutsDialog />
    </SidebarProvider>
  );
}
