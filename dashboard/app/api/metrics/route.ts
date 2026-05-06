import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    data: {
      guilds: 1,
      users: 0,
      activeSessions: 0,
      commandsToday: 0,
      messagesProcessed: 0,
      voiceMinutesToday: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      latency: 0
    },
    timestamp: new Date().toISOString(),
  })
}
