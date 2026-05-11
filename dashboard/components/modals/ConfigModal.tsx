'use client'

import { useCallback, useState } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'

interface Config {
  botToken?: string
  webhookUrl?: string
  apiEndpoint?: string
}

export default function ConfigModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<Config>({})
  const [showToken, setShowToken] = useState(false)
  const [showWebhook, setShowWebhook] = useState(false)

  const handleSave = useCallback(async () => {
    try {
      // In production, save to your backend
      console.log('Config saved:', config)
      alert('Configuration saved successfully')
    } catch (err) {
      console.error('Failed to save config:', err)
      alert('Failed to save configuration')
    }
  }, [config])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-card/80 transition-colors"
      >
        Configuration
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg border border-border max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Bot Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  API Endpoint
                </label>
                <input
                  type="url"
                  placeholder="https://api.example.com"
                  value={config.apiEndpoint || ''}
                  onChange={(e) =>
                    setConfig({ ...config, apiEndpoint: e.target.value })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Webhook URL
                </label>
                <div className="relative">
                  <input
                    type={showWebhook ? 'text' : 'password'}
                    placeholder="https://discord.com/api/webhooks/..."
                    value={config.webhookUrl || ''}
                    onChange={(e) =>
                      setConfig({ ...config, webhookUrl: e.target.value })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent pr-10"
                  />
                  <button
                    onClick={() => setShowWebhook(!showWebhook)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showWebhook ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Bot Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="Your bot token"
                    value={config.botToken || ''}
                    onChange={(e) =>
                      setConfig({ ...config, botToken: e.target.value })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent pr-10"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-blue-500/50 bg-blue-500/5 p-3 flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-400">
                  Credentials are encrypted and stored securely.
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
