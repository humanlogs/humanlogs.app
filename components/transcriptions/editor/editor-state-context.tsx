"use client";

import React, {
  createContext,
  useContext,
  useRef,
  ReactNode,
  useState,
  useCallback,
  useEffect,
} from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { Speaker } from "./hooks/use-speaker-actions";
import { SpeakerOptionsData } from "../dialogs/speaker-options-dialog";
import { PauseConfigurationData } from "../dialogs/pause-configuration-dialog";

type EditorState = {
  segments: TranscriptionSegment[];
  speakers: Speaker[];
};

type EditorOperations = {
  applyPauseConfiguration?: (config: PauseConfigurationData) => void;
  applySpeakerOptions?: (options: SpeakerOptionsData) => void;
};

type EditorStateContextType = {
  getState: () => EditorState | null;
  register: (getState: () => EditorState) => void;
  unregister: () => void;
  operations: EditorOperations;
  registerOperations: (operations: EditorOperations) => void;
  unregisterOperations: () => void;
};

const EditorStateContext = createContext<EditorStateContextType | null>(null);

export function EditorStateProvider({ children }: { children: ReactNode }) {
  const getStateRef = useRef<(() => EditorState) | null>(null);
  const operationsRef = useRef<EditorOperations>({});

  const register = useCallback((getState: () => EditorState) => {
    getStateRef.current = getState;
  }, []);

  const unregister = useCallback(() => {
    getStateRef.current = null;
  }, []);

  const getState = useCallback(() => {
    return getStateRef.current?.() ?? null;
  }, []);

  const registerOperations = useCallback((operations: EditorOperations) => {
    operationsRef.current = operations;
  }, []);

  const unregisterOperations = useCallback(() => {
    operationsRef.current = {};
  }, []);

  // Use a stable reference but provide access to current operations
  const contextValue = useRef({
    getState,
    register,
    unregister,
    get operations() {
      return operationsRef.current;
    },
    registerOperations,
    unregisterOperations,
  });

  return (
    <EditorStateContext.Provider value={contextValue.current}>
      {children}
    </EditorStateContext.Provider>
  );
}

export function useEditorStateRegister(getState: () => EditorState) {
  const context = useContext(EditorStateContext);

  // Register on mount, unregister on unmount
  if (context) {
    // Using useRef to avoid re-registering on every render
    const getStateRef = useRef(getState);
    getStateRef.current = getState;

    // Register with the context
    useEffect(() => {
      context.register(() => getStateRef.current());
      return () => context.unregister();
    }, [context]);
  }
}

export function useEditorState() {
  const context = useContext(EditorStateContext);
  if (!context) {
    throw new Error("useEditorState must be used within EditorStateProvider");
  }
  return context;
}

/**
 * Optional hook that returns null if not within an EditorStateProvider.
 * Useful for components that may or may not have access to editor state.
 */
export function useOptionalEditorState() {
  return useContext(EditorStateContext);
}
