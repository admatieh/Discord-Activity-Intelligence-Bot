import { AppSidebar } from "@/components/layout/AppSidebar"
import { LiveSessionBar } from "@/components/layout/LiveSessionBar"
import { DashboardProviders } from "@/components/providers/dashboard-providers"
import { MobileNav } from "@/components/layout/MobileNav"

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
        <div className="hidden md:flex">
          <AppSidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MobileNav />
          <LiveSessionBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </DashboardProviders>
  )
}
