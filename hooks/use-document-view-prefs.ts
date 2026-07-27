"use client";

import {
  DEFAULT_GROUP_BY,
  DEFAULT_SORT_BY,
  type GroupBy,
  type SortBy,
} from "@/lib/documents/grouping";
import * as React from "react";

const STORAGE_KEY = "humanlogs.documentView";

export type DocumentViewPrefs = {
  groupBy: GroupBy;
  sortBy: SortBy;
};

const DEFAULTS: DocumentViewPrefs = {
  groupBy: DEFAULT_GROUP_BY,
  sortBy: DEFAULT_SORT_BY,
};

// localStorage is an external store, so it is read through
// `useSyncExternalStore` rather than mirrored into state. The snapshot is
// cached against the raw string: `getSnapshot` must return a stable reference
// as long as nothing changed, or React re-renders forever.
let cachedRaw: string | null = null;
let cached: DocumentViewPrefs = DEFAULTS;

const listeners = new Set<() => void>();

function parse(raw: string | null): DocumentViewPrefs {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<DocumentViewPrefs>;
    return {
      groupBy: parsed.groupBy ?? DEFAULTS.groupBy,
      sortBy: parsed.sortBy ?? DEFAULTS.sortBy,
    };
  } catch {
    return DEFAULTS;
  }
}

function getSnapshot(): DocumentViewPrefs {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULTS;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function getServerSnapshot(): DocumentViewPrefs {
  return DEFAULTS;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab changing the preference should move this one too.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * How the document list is grouped and sorted. Kept in localStorage rather than
 * on the user: it is a per-device view preference, not account data.
 */
export function useDocumentViewPrefs() {
  const prefs = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const update = React.useCallback((patch: Partial<DocumentViewPrefs>) => {
    const next = { ...getSnapshot(), ...patch };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode or a full quota: the choice simply doesn't persist. Update
      // the cache anyway so the current session still reflects the choice.
      cachedRaw = null;
      cached = next;
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { prefs, update };
}
