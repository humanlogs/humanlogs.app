import { SocketProvider } from "@/components/socket-provider";
import { TrustedEncryptionKeysProvider } from "../../components/trusted-encryption-keys-provider";

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
