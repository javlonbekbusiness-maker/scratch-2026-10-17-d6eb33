import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/tests', '/test/', '/results', '/profile', '/onboarding', '/checkout', '/admin'];

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  if (process.env.NODE_ENV === 'production' && req.headers.get('x-forwarded-proto') === 'http') {
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  // The Uzbek Cyrillic locale was removed: old /uz-Cyrl/... links go to the same page without the prefix.
  const retiredPrefix = /^\/uz-cyrl(?=\/|$)/i;
  if (retiredPrefix.test(url.pathname)) {
    const to = url.clone();
    to.pathname = url.pathname.replace(retiredPrefix, '') || '/';
    const res = NextResponse.redirect(to, 308);
    res.cookies.set('lang', 'uz', { path: '/', maxAge: 365 * 86400, sameSite: 'lax' });
    return res;
  }

  const hasSession = req.cookies.has('yhq_session');
  if (!hasSession && PROTECTED.some((p) => url.pathname.startsWith(p))) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', url.pathname);
    return NextResponse.redirect(login);
  }

  const res = NextResponse.next();
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');

  const ref = url.searchParams.get('ref');
  if (ref && /^[A-Za-z0-9]{4,32}$/.test(ref)) {
    res.cookies.set('ref', ref, { maxAge: 30 * 86400, httpOnly: true, sameSite: 'lax', path: '/' });
  }
  // Replace a stored retired language (e.g. "uz-Cyrl") so the browser stops sending it.
  const lang = req.cookies.get('lang')?.value;
  if (lang && lang !== 'uz' && lang !== 'ru') {
    res.cookies.set('lang', 'uz', { path: '/', maxAge: 365 * 86400, sameSite: 'lax' });
  }
  if (!req.cookies.has('did')) {
    res.cookies.set('did', crypto.randomUUID(), { maxAge: 5 * 365 * 86400, httpOnly: true, sameSite: 'lax', path: '/' });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icons|placeholders|signs|sw.js|manifest.webmanifest|favicon.ico).*)'],
};
