"use client";

import * as React from "react";

type SidebarRefreshContextType = {
  refresh: () => void;
};

const SidebarRefreshContext = React.createContext<
  SidebarRefreshContextType | undefined
>(undefined);

export function SidebarRefreshProvider({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh: () => void;
}) {
  const contextValue = React.useMemo(
    () => ({
      refresh: onRefresh,
    }),
    [onRefresh],
  );

  return (
    <SidebarRefreshContext.Provider value={contextValue}>
      {children}
    </SidebarRefreshContext.Provider>
  );
}

export function useSidebarRefresh() {
  const context = React.useContext(SidebarRefreshContext);
  if (!context) {
    throw new Error(
      "useSidebarRefresh must be used within SidebarRefreshProvider",
    );
  }
  return context;
}
