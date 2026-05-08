import { Topbar } from '@/components/dashboard/topbar'
import Link from 'next/link'
import { Terminal, FileText, Command, ShieldAlert } from 'lucide-react'

export default function AdvancedToolsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Advanced Tools"
        subtitle="System diagnostics and technical controls"
      />
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">Advanced Tools</h1>
          <p className="text-muted-foreground text-sm">Access technical diagnostics, direct bot commands, and raw system logs.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/advanced/terminal" className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-sm transition-all block">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <Terminal className="w-6 h-6 text-secondary-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Terminal</h3>
            <p className="text-sm text-muted-foreground">Execute raw bot commands with full context.</p>
          </Link>

          <Link href="/advanced/commands" className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-sm transition-all block">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <Command className="w-6 h-6 text-secondary-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Command Explorer</h3>
            <p className="text-sm text-muted-foreground">View all registered bot commands and schemas.</p>
          </Link>

          <Link href="/advanced/logs" className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-sm transition-all block">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <FileText className="w-6 h-6 text-secondary-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold text-lg mb-1">System Logs</h3>
            <p className="text-sm text-muted-foreground">View raw bot runtime logs and database traces.</p>
          </Link>
          
          <div className="bg-card border border-border rounded-xl p-6 opacity-70">
             <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6 text-secondary-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">System Health</h3>
            <p className="text-sm text-muted-foreground">Check database health and bot API connectivity. (Coming soon)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
