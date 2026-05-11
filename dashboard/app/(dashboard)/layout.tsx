import { AppSidebar } from "@/components/layout/AppSidebar"
import { LiveSessionBar } from "@/components/layout/LiveSessionBar"
import { DashboardProviders } from "@/components/providers/dashboard-providers"

// Permission model: the dashboard is intended for local/private instructor use.
// TODO: add authentication and map Discord roles (student / instructor / admin) to gate routes.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardProviders>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <LiveSessionBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </DashboardProviders>
  )
}
