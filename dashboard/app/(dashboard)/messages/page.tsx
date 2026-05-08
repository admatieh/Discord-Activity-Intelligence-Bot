import { Topbar } from '@/components/dashboard/topbar'
import { MessageSquare, Send, Users, AlignLeft } from 'lucide-react'

export default function MessagesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Messages"
        subtitle="Send announcements and messages"
      />
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">Send an Announcement</h1>
          <p className="text-muted-foreground text-sm">Draft and send messages to Discord text channels from the dashboard.</p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-8">
          <div className="space-y-6">
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Target Channel
              </label>
              <select className="w-full bg-background border border-input rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow">
                <option value="">Select text channel...</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-muted-foreground" />
                Message Content
              </label>
              <textarea 
                rows={6}
                placeholder="Type your message here..."
                className="w-full bg-background border border-input rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow resize-y"
              ></textarea>
            </div>

            <div className="pt-4 flex items-center gap-4">
              <button className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm">
                <Send className="w-4 h-4" /> Send Now
              </button>
              <button className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Schedule for later
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
