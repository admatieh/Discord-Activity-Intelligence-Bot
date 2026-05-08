import { Topbar } from '@/components/dashboard/topbar'
import { Calendar, Plus } from 'lucide-react'
import Link from 'next/link'

export default function ScheduledPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Scheduled"
        subtitle="Manage upcoming sessions and messages"
      />
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Calendar</h1>
            <p className="text-muted-foreground text-sm mt-1">View and manage your scheduled recordings and announcements.</p>
          </div>
          <Link href="/record" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Schedule Item
          </Link>
        </div>

        <div className="bg-card border border-border border-dashed rounded-xl p-12 text-center flex flex-col items-center shadow-sm">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Scheduled Items</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            You don't have any upcoming sessions or messages. Scheduled items will appear here.
          </p>
          <Link href="/record" className="text-primary text-sm font-medium hover:underline">
            Schedule a recording
          </Link>
        </div>
      </div>
    </div>
  )
}
