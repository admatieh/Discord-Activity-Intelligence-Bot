// dashboard/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { getUsers } from '@/server/repositories';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    
    const offset = (page - 1) * pageSize;
    const { data, total } = getUsers(pageSize, offset);
    
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
    console.error('[Dashboard] Error fetching users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch users from database.',
      data: null
    }, { status: 500 });
  }
}
