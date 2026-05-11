'use client'

import PageHeader from '@/components/layout/PageHeader'
import ConfigModal from '@/components/modals/ConfigModal'
import { Bell, Lock, Palette, ShieldAlert } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your bot configuration and preferences"
      />

      <div className="grid gap-6">
        {/* General Settings */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Appearance</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Theme</p>
                <p className="text-sm text-muted-foreground">Choose light or dark theme</p>
              </div>
              <select className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent">
                <option>Dark</option>
                <option>Light</option>
                <option>System</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Notifications</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Session Started', key: 'session_started' },
              { label: 'Session Ended', key: 'session_ended' },
              { label: 'Errors', key: 'errors' },
              { label: 'System Alerts', key: 'system_alerts' },
            ].map((notif) => (
              <div key={notif.key} className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground cursor-pointer">
                  {notif.label}
                </label>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-border accent-accent"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Security</h3>
          </div>
          <div className="space-y-3">
            <ConfigModal />
            <button className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Change Password
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Danger Zone</h3>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              These actions cannot be undone. Please proceed with caution.
            </p>
            <button className="w-full rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors">
              Reset All Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
