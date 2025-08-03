import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
import { Separator } from "../components/ui/separator";
import { useUser } from "../features/user/use-user";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user, logout } = useUser();

  const handleLogout = () => {
    logout();
  };

  const userData = user.data;
  const initials = userData?.name
    ? userData.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Transcription App</h1>
          </div>

          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userData?.avatar} alt={userData?.name} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {userData?.name && (
                      <p className="font-medium">{userData.name}</p>
                    )}
                    {userData?.email && (
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {userData.email}
                      </p>
                    )}
                  </div>
                </div>
                <Separator />
                <DropdownMenuItem onClick={handleLogout}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content area with resizable sidebar */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Sidebar */}
          <ResizablePanel
            defaultSize={20}
            minSize={15}
            maxSize={30}
            className="min-w-[200px]"
          >
            <div className="flex h-full flex-col bg-muted/20">
              <div className="flex-1 overflow-auto p-4">
                <nav className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start">
                    Dashboard
                  </Button>
                  <Button variant="ghost" className="w-full justify-start">
                    Transcriptions
                  </Button>
                  <Button variant="ghost" className="w-full justify-start">
                    Settings
                  </Button>
                </nav>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Main content */}
          <ResizablePanel defaultSize={80} minSize={70}>
            <main className="h-full overflow-auto p-6">{children}</main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
