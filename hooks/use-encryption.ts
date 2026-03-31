"use client";

import {
  createCertificate,
  downloadCertificate,
  generateDeviceSecret,
  getPrivateKey,
  isDeviceTrusted,
  parseCertificate,
  removePrivateKey,
  setDeviceTrust,
  storePrivateKey,
} from "@/lib/encryption";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EncryptedDataEntity,
  EncryptionUtils,
} from "../lib/encryption-entities";
import { browserCrypto } from "../lib/encryption-entities.browser";
import { useRef } from "react";

export type EncryptionStatus = {
  hasEncryption: boolean;
  publicKey: string | null;
  trustedDeviceSecret: string | null;
};

export type EncryptionState = {
  encryptionStatus: EncryptionStatus | null;
  hasLocalKey: boolean;
  deviceTrusted: boolean;
  privateKey: string | null;
  publicKey: string | null;
  userId: string;
};

/**
 * Fetch encryption status from the server
 */
export function useEncryptionStatus() {
  return useQuery({
    queryKey: ["encryption-status"],
    queryFn: async (): Promise<EncryptionState> => {
      const response = await fetch("/api/user/encryption");
      if (!response.ok) {
        throw new Error("Failed to fetch encryption status");
      }
      const data = await response.json();

      // Check local key and device trust status
      let hasLocalKey = false;
      let deviceTrusted = false;
      let privateKey: string | null = null;

      if (data.hasEncryption && data.trustedDeviceSecret) {
        privateKey = await getPrivateKey(data.trustedDeviceSecret);
        hasLocalKey = !!privateKey;
        deviceTrusted = await isDeviceTrusted();
      }

      return {
        encryptionStatus: data,
        hasLocalKey,
        deviceTrusted,
        privateKey,
        publicKey: data.publicKey,
        userId: data.userId,
      };
    },
  });
}

/**
 * Generate and download certificate (without uploading to server)
 */
export function useGenerateCertificate() {
  return useMutation({
    mutationFn: async () => {
      // Generate certificate
      const certificate = await createCertificate();

      // Generate device secret
      const deviceSecret = await generateDeviceSecret();

      // Download certificate
      downloadCertificate(certificate);

      return { certificate, deviceSecret };
    },
  });
}

/**
 * Upload public key to server and enable encryption
 */
export function useEnableEncryption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      publicKey: string;
      privateKey: string;
      deviceSecret: string;
      trustDevice?: boolean;
    }) => {
      // Store public key and device secret on server
      const response = await fetch("/api/user/encryption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: params.publicKey,
          trustedDeviceSecret: params.deviceSecret,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to enable encryption");
      }

      // Store private key locally
      await storePrivateKey(
        params.privateKey,
        params.deviceSecret,
        params.trustDevice ?? false,
      );

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate encryption status to refetch
      queryClient.invalidateQueries({ queryKey: ["encryption-status"] });
    },
  });
}

/**
 * Disable encryption
 */
export function useDisableEncryption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user/encryption", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disable encryption");
      }

      // Remove private key from local storage
      await removePrivateKey();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["encryption-status"] });
    },
  });
}

/**
 * Upload and load a certificate
 */
export function useUploadCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      certificateContent,
      trustedDeviceSecret,
      trustDevice = false,
    }: {
      certificateContent: string;
      trustedDeviceSecret: string;
      trustDevice?: boolean;
    }) => {
      const certificate = parseCertificate(certificateContent);

      // Update public key on the server
      const response = await fetch("/api/user/encryption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: certificate.publicKey,
          trustedDeviceSecret: trustedDeviceSecret,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to upload certificate to server");
      }

      // Store private key locally
      await storePrivateKey(
        certificate.privateKey,
        trustedDeviceSecret,
        trustDevice,
      );

      return certificate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["encryption-status"] });
    },
  });
}

/**
 * Toggle device trust setting
 */
export function useToggleDeviceTrust() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trust,
      deviceSecret,
    }: {
      trust: boolean;
      deviceSecret: string;
    }) => {
      await setDeviceTrust(trust, deviceSecret);
      return trust;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["encryption-status"] });
    },
  });
}

/**
 * Remove local encryption key
 */
export function useRemoveLocalKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await removePrivateKey();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["encryption-status"] });
    },
  });
}

/**
 * Download existing certificate
 */
export function useDownloadCertificate() {
  return useMutation({
    mutationFn: async ({
      privateKey,
      publicKey,
    }: {
      privateKey: string;
      publicKey: string;
    }) => {
      downloadCertificate({
        privateKey,
        publicKey,
        createdAt: new Date().toISOString(),
      });
    },
  });
}

export function useDecryptData() {
  const { data: status } = useEncryptionStatus();
  const statusRef = useRef(status);
  statusRef.current = status;

  return async <T>(data: EncryptedDataEntity): Promise<DecryptedWithRaw<T>> => {
    const encryption = new EncryptionUtils(browserCrypto);

    if (!statusRef.current) {
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (statusRef.current) {
            clearInterval(interval);
            resolve(true);
          }
        }, 500);
      });
    }

    const res = await encryption.decrypt<T>(
      data,
      statusRef.current?.privateKey || "",
      statusRef.current?.publicKey || "",
    );

    return { ...res, _raw: data };
  };
}

export type DecryptedWithRaw<T> = T & {
  _raw: EncryptedDataEntity | { [key: string]: EncryptedDataEntity };
};
