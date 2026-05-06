import { SidebarNav } from '@/components/dashboard/sidebar-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <SidebarNav />
      <main className="flex-1 ml-56 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
