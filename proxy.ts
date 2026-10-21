import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/env'

function isProtectedPath(pathname: string) {
  return (
    pathname === '/app/projects' ||
    pathname.startsWith('/app/projects/') ||
    pathname === '/app/history' ||
    pathname === '/app/billing' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  )
}

export async function proxy(request: NextRequest) {
  const needsAuthentication = isProtectedPath(request.nextUrl.pathname)

  if (!isSupabaseConfigured()) {
    if (needsAuthentication) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/app/login'
      loginUrl.search = '?setup=supabase'
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next({ request })
  }

  const { url, publishableKey } = getSupabaseConfig()
  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data: claims } = await supabase.auth.getClaims()

  if (needsAuthentication && !claims) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/app/login'
    loginUrl.search = ''
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
