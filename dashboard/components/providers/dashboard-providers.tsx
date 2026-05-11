"use client"

import { WorkspaceProvider } from "@/components/providers/workspace-context"

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>
}
