import { AppSidebar } from "@/components/layout/AppSidebar"

// Permission model: the dashboard is intended for local/private instructor use.
// TODO: add authentication and map Discord roles (student / instructor / admin) to gate routes.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
