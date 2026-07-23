import { AppSidebar } from "@/components/app-sidebar";
import { FeedbackAutoPrompt } from "@/components/feedback/feedback-auto-prompt";
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
import { TranscriptionHistorySheet } from "@/components/transcriptions/dialogs/transcription-history-sheet";
import { AppHeader } from "@/components/app-header";
import { AppAmbientBackdrop } from "@/components/app-ambient-backdrop";
import { AppRouteTransition } from "@/components/app-route-transition";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WelcomeIntro } from "@/components/welcome/welcome-intro";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/app/login");
  }

  // Send users who haven't finished onboarding straight to the welcome flow.
  // Doing this server-side (rather than the client-side useWelcomeRedirect
  // fallback) avoids the app UI flashing behind the welcome screen.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isWelcomeDone: true },
  });
  if (dbUser && !dbUser.isWelcomeDone) {
    redirect("/app/welcome");
  }

  return (
    <WelcomeIntro>
      <SidebarProvider>
        <AppSidebar user={user}>
        <SidebarInset className="flex flex-col">
          <AppHeader />
          <main className="relative flex-1 min-w-0 overflow-hidden">
            <AppAmbientBackdrop />
            <ScrollArea className="app-main-scroll relative z-10 h-full">
              <AppRouteTransition>{children}</AppRouteTransition>
            </ScrollArea>
          </main>
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
      <FeedbackAutoPrompt />
      <HelpDialog />
      </SidebarProvider>
    </WelcomeIntro>
  );
}
