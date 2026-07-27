import { SocketProvider } from "@/components/socket-provider";
import type { Metadata } from "next";
import { TrustedEncryptionKeysProvider } from "../../components/trusted-encryption-keys-provider";

// The root layout carries the marketing title, which makes no sense once you
// are inside the product. Pages can override it (see useDocumentTitle).
export const metadata: Metadata = {
  title: {
    default: "HumanLogs",
    template: "%s · HumanLogs",
  },
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TrustedEncryptionKeysProvider>
      <SocketProvider>{children}</SocketProvider>
    </TrustedEncryptionKeysProvider>
  );
}
