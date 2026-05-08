// dashboard/app/api/metrics/messages/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/server/db';

export async function GET() {
  try {
    // Messages per day for last 7 days from activity_events
    const rows = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM activity_events
      WHERE created_at >= date('now', '-7 days')
      GROUP BY day
      ORDER BY day ASC
    `).all() as any[];

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({ date: r.day, count: r.count })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Dashboard] messages metrics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch message metrics.', data: [] },
      { status: 500 }
    );
  }
}
