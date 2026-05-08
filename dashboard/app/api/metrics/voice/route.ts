// dashboard/app/api/metrics/voice/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/server/db';

export async function GET() {
  try {
    // Voice minutes per day for last 7 days from attendance_summary
    const rows = db.prepare(`
      SELECT date(created_at) as day, SUM(total_time_seconds) as seconds
      FROM attendance_summary
      WHERE created_at >= date('now', '-7 days')
      GROUP BY day
      ORDER BY day ASC
    `).all() as any[];

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({
        date: r.day,
        minutes: Math.round((r.seconds ?? 0) / 60),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Dashboard] voice metrics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch voice metrics.', data: [] },
      { status: 500 }
    );
  }
}
