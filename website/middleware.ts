import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;

  if (!adminUser || !adminPass) {
    return new NextResponse('Admin not configured', { status: 503 });
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Endura Admin"' },
    });
  }

  const base64 = authHeader.split(' ')[1];
  const decoded = atob(base64);
  const colonIdx = decoded.indexOf(':');
  const user = decoded.substring(0, colonIdx);
  const pass = decoded.substring(colonIdx + 1);

  if (user !== adminUser || pass !== adminPass) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Endura Admin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard-e9x2k/:path*',
};
