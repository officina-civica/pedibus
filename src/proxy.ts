import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/* Rinfresca la sessione Supabase a ogni richiesta e protegge le pagine dell'app:
   senza utente si va all'accesso, con utente l'accesso rimanda dentro.
   getClaims() verifica il JWT in locale (chiavi asimmetriche del progetto, JWKS in cache):
   niente chiamata al server di autenticazione a ogni richiesta, a differenza di getUser(). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;
  const { pathname } = request.nextUrl;
  const pubblica = pathname === "/accesso";

  if (!user && !pubblica) {
    const url = request.nextUrl.clone();
    url.pathname = "/accesso";
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/accesso") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/).*)"],
};
