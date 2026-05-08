import { Topbar } from '@/components/dashboard/topbar'
import { Activity } from 'lucide-react'

export default function ActivityPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Activity Feed"
        subtitle="Recent events in your workspace"
      />
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">Activity</h1>
          <p className="text-muted-foreground text-sm">A timeline of sessions, messages, and major events.</p>
        </div>

        <div className="bg-card border border-border border-dashed rounded-xl p-12 text-center flex flex-col items-center shadow-sm">
          <Activity className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Recent Activity</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            When sessions are recorded or messages are sent, they will appear in this timeline.
          </p>
        </div>
      </div>
    </div>
  )
}
