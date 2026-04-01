import { AppSidebar } from "@/components/app-sidebar";
import { FeedbackDialog } from "@/components/dialogs/feedback-dialog";
import { HelpDialog } from "@/components/dialogs/help-dialog";
import { ProjectCreateModal } from "@/components/dialogs/project-create-modal";
import { ShortcutsDialog } from "@/components/transcriptions/dialogs/shortcuts-dialog";
import { SpeakerOptionsDialog } from "@/components/transcriptions/dialogs/speaker-options-dialog";
import { PauseConfigurationDialog } from "@/components/transcriptions/dialogs/pause-configuration-dialog";
import { TranscriptionDeleteDialog } from "@/components/transcriptions/dialogs/transcription-delete-dialog";
import { TranscriptionExportDialog } from "@/components/transcriptions/dialogs/transcription-export-dialog";
import { TranscriptionRenameDialog } from "@/components/transcriptions/dialogs/transcription-rename-dialog";
import { TranscriptionSetProjectDialog } from "@/components/transcriptions/dialogs/transcription-set-project-dialog";
import { TranscriptionShareDialog } from "@/components/transcriptions/dialogs/transcription-share-dialog";
import { TranscriptionHistorySheet } from "@/components/transcriptions/transcription-history-sheet";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import auth0 from "@/lib/auth0";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession();

  if (!session?.user) {
    redirect("/app/login");
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
      <TranscriptionRenameDialog />
      <TranscriptionDeleteDialog />
      <TranscriptionSetProjectDialog />
      <TranscriptionShareDialog />
      <ProjectCreateModal />
      <TranscriptionExportDialog />
      <TranscriptionHistorySheet />
      <SpeakerOptionsDialog />
      <PauseConfigurationDialog />
      <ShortcutsDialog />
      <FeedbackDialog />
      <HelpDialog />
    </SidebarProvider>
  );
}
