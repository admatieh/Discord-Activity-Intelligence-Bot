// dashboard/app/api/metrics/weekly/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/server/db';

export async function GET() {
  try {
    // Sessions per day for last 7 days
    const rows = db.prepare(`
      SELECT date(start_time) as day, COUNT(*) as sessions
      FROM sessions
      WHERE start_time >= date('now', '-7 days')
      GROUP BY day
      ORDER BY day ASC
    `).all() as any[];

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({ date: r.day, sessions: r.sessions })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Dashboard] weekly metrics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weekly metrics.', data: [] },
      { status: 500 }
    );
  }
}
