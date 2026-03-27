"use client";

import * as React from "react";

/**
 * Reusable Modal Management System
 *
 * A lightweight, provider-free modal manager inspired by sonner (toast library).
 * Allows you to open/close modals from anywhere in your app without prop drilling.
 *
 * Usage:
 * 1. Define your modal data type (optional, for type safety)
 * 2. Create a convenience hook using `useModal<YourDataType>("modal-id")`
 * 3. Render your modal component once at the app level
 * 4. Open the modal from anywhere using the hook or imperative API
 *
 * See MODAL_SYSTEM.md for full documentation.
 */

// Generic modal state type
type ModalState<T> = {
  isOpen: boolean;
  data?: T;
};

type ModalStore = {
  [modalId: string]: ModalState<unknown>;
};

type Listener = () => void;

// Simple store for modal states (module-level, outside React)
const modalStore: ModalStore = {};
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

// Imperative API (can be called from anywhere)
export const modals = {
  open: (modalId: string, data?: unknown) => {
    modalStore[modalId] = { isOpen: true, data };
    emitChange();
  },
  close: (modalId: string) => {
    if (modalStore[modalId]) {
      modalStore[modalId] = { ...modalStore[modalId], isOpen: false };
      emitChange();
    }
  },
  getData: (modalId: string): unknown | undefined => {
    return modalStore[modalId]?.data as unknown;
  },
  isOpen: (modalId: string): boolean => {
    return modalStore[modalId]?.isOpen ?? false;
  },
};

// React hook to use modal state
export function useModal<T>(modalId: string) {
  const [state, setState] = React.useState<ModalState<T>>(
    () =>
      ({
        isOpen: modalStore[modalId]?.isOpen ?? false,
        data: modalStore[modalId]?.data,
      }) as ModalState<T>,
  );

  React.useEffect(() => {
    const listener = () => {
      setState({
        isOpen: modalStore[modalId]?.isOpen ?? false,
        data: modalStore[modalId]?.data as T,
      });
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [modalId]);

  const open = React.useCallback(
    (data?: T) => {
      modals.open(modalId, data);
    },
    [modalId],
  );

  const close = React.useCallback(() => {
    modals.close(modalId);
  }, [modalId]);

  return {
    isOpen: state.isOpen,
    data: state.data,
    open,
    close,
  };
}

export const useAnyModalOpen = () => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  React.useEffect(() => {
    const checkAnyModalOpen = () => {
      const anyOpen = Object.values(modalStore).some((modal) => modal.isOpen);
      setIsModalOpen(anyOpen);
    };

    listeners.add(checkAnyModalOpen);
    return () => {
      listeners.delete(checkAnyModalOpen);
    };
  }, []);

  return isModalOpen;
};
