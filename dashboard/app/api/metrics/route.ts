// dashboard/app/api/metrics/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/server/db';

export async function GET() {
  try {
    const totalSessions = (db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any)?.count ?? 0;
    const activeSessions = (db.prepare("SELECT COUNT(*) as count FROM sessions WHERE end_time IS NULL").get() as any)?.count ?? 0;
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count ?? 0;
    const totalVoiceEvents = (db.prepare('SELECT COUNT(*) as count FROM voice_events').get() as any)?.count ?? 0;
    const totalActivityEvents = (db.prepare('SELECT COUNT(*) as count FROM activity_events').get() as any)?.count ?? 0;

    // Voice minutes: sum of seconds from attendance_summary converted to minutes
    const voiceSecondsRow = (db.prepare(
      "SELECT SUM(total_time_seconds) as total FROM attendance_summary"
    ).get() as any);
    const totalVoiceMinutes = Math.round((voiceSecondsRow?.total ?? 0) / 60);

    // Commands today from logs
    const commandsToday = (db.prepare(
      "SELECT COUNT(*) as count FROM logs WHERE level = 'info' AND message LIKE 'Executed:%' AND created_at >= date('now')"
    ).get() as any)?.count ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        guilds: 1,
        users: totalUsers,
        totalSessions,
        activeSessions,
        commandsToday,
        messagesProcessed: totalActivityEvents,
        voiceMinutesToday: totalVoiceMinutes,
        totalVoiceEvents,
        cpuUsage: 0,
        memoryUsage: 0,
        latency: 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Dashboard] metrics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metrics.', data: null },
      { status: 500 }
    );
  }
}
