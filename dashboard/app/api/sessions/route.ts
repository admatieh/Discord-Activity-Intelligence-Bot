// dashboard/app/api/sessions/route.ts
import { NextResponse } from 'next/server';
import { getSessions } from '@/server/repositories';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    
    const offset = (page - 1) * pageSize;
    const { data, total } = getSessions(status, pageSize, offset);
    
    return NextResponse.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total
      },
      error: null
    });
  } catch (error: any) {
    console.error('[Dashboard] Error fetching sessions:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sessions from database.',
      data: null
    }, { status: 500 });
  }
}
