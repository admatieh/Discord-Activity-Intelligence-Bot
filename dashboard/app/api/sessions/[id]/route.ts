// dashboard/app/api/sessions/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/server/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Strip "sess_" prefix if present
    const { id } = await params;
    const rawId = id.replace(/^sess_/, '');
    const numId = parseInt(rawId, 10);

    if (isNaN(numId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid session ID.', data: null },
        { status: 400 }
      );
    }

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(numId) as any;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found.', data: null },
        { status: 404 }
      );
    }

    const attendees = db.prepare(
      'SELECT * FROM attendance_summary WHERE session_id = ? ORDER BY total_time_seconds DESC'
    ).all(numId) as any[];

    const participation = db.prepare(
      'SELECT * FROM participation_summary WHERE session_id = ? ORDER BY score DESC'
    ).all(numId) as any[];

    const voiceEvents = db.prepare(
      'SELECT * FROM voice_events WHERE session_id = ? ORDER BY join_time ASC'
    ).all(numId) as any[];

    const participantCount = (
      db.prepare(
        'SELECT COUNT(DISTINCT user_id) as count FROM voice_events WHERE session_id = ?'
      ).get(numId) as any
    )?.count ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        id: `sess_${session.id}`,
        channelId: session.channel_id,
        triggeredBy: session.triggered_by,
        startedAt: session.start_time,
        endedAt: session.end_time,
        duration: session.duration_minutes,
        status: session.end_time ? 'ended' : 'active',
        participantCount,
        attendees,
        participation,
        voiceEvents,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('[Dashboard] session detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session.', data: null },
      { status: 500 }
    );
  }
}
