# Auth, session, and cookies — how it works in this project

This document walks through **every step** where Supabase touches **sessions**, **tokens**, and **cookies** in this Next.js 16 + `@supabase/ssr` setup.

---

## 1. Concepts (Supabase + browser auth)

| Term | Meaning here |
|------|----------------|
| **Session** | A logged-in state backed by Supabase: access token, refresh token, and user metadata. The client exposes it as `session` (see `getSession()`). |
| **User** | The `user` object (id, email, etc.). You get it from `session.user` or directly via `getUser()`. |
| **Tokens** | Short-lived **access** JWT and longer-lived **refresh** token. Supabase stores them in **cookies** (when using SSR helpers), not only in `localStorage`. |
| **Cookies (HTTP)** | Small key/value pairs the browser sends on each request to your domain. Supabase’s SSR package uses them so **the server** can read the same session as the **browser**. |

---

## 2. Supabase clients (browser, server, proxy)

There are **three call sites**, but **two different server-side cookie adapters**:

| Where | API | File / location |
|--------|-----|-----------------|
| Client components | `createBrowserClient` | `lib/supabase/browser-client.ts` → `getSupabaseBrowserClient()` |
| Server Components, Server Actions, Route Handlers | `createServerClient` + `cookies()` from `next/headers` | `lib/supabase/server-client.ts` → `createSupabaseServerClient()` |
| Root **proxy** (request boundary) | `createServerClient` + `NextRequest` / `NextResponse` cookies | `lib/supabase/middleware-client.ts` → `createSupabaseMiddlewareClient()` (used from `proxy.ts`; **not** the same module as `server-client.ts`) |

**Shared env:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are read via **`getSupabaseEnv()`** in `lib/supabase/env.ts` (used by both server and middleware clients).

### 2.1 Browser client — `lib/supabase/browser-client.ts`

- Built with **`createBrowserClient`** from `@supabase/ssr`.
- Used in **`"use client"`** components (e.g. `GoogleLoginForm`, `EmailPasswordForm`).
- **Singleton** via module-level cache: one instance per tab load so listeners and internal state stay consistent.

**What it does with sessions/cookies**

- On sign-in / sign-up / OAuth, the browser client talks to Supabase and **updates auth storage**. With `@supabase/ssr`, that storage is aligned with **cookie-based** session handling suitable for SSR.
- **`supabase.auth.getSession()`** — reads the current session from the client’s perspective (e.g. logging on mount).
- **`supabase.auth.onAuthStateChange(...)`** — fires when login, logout, token refresh, or user updates happen; use it to keep UI state in sync without a full reload.
- **`signOut()`** — ends the session; cookies are cleared/updated according to Supabase’s client behavior.

### 2.2 Server client — `lib/supabase/server-client.ts`

- Built with **`createServerClient`** from `@supabase/ssr`.
- Uses Next.js **`cookies()`** from `next/headers` so the server can **read and write** the same cookie jar the browser uses for your app.

**Cookie adapter (why that code exists)**

```text
getAll()  →  return cookieStore.getAll()
           Supabase reads every auth-related cookie it needs.

setAll()  →  cookieStore.set(name, value, options) for each cookie
           Supabase writes cookies when the session changes (e.g. refresh).

try/catch  →  In some Server Component / request phases, setting cookies can throw
           (e.g. response already committed). Catching avoids crashing the request;
           token refresh in the proxy is often where writes succeed for edge-adjacent flows.
```

So: **you are not “manually managing JWT strings”** — you are **plugging Next’s cookie APIs into Supabase** so `createServerClient` can sync session state on the server.

### 2.3 Proxy uses a *different* `createServerClient` — why not reuse `server-client.ts`?

The proxy runs with a **`NextRequest`**, not the RSC `cookies()` API. **`await cookies()` from `next/headers` is not used in `proxy.ts`**.

- **Server / RSC:** `getAll` / `setAll` go through the async **`cookies()`** store (`createSupabaseServerClient()` in `server-client.ts`).
- **Proxy:** `getAll` reads **`request.cookies`**; `setAll` updates a mutable **`NextResponse`** (rebuild `NextResponse.next({ request: { headers } })`, then `response.cookies.set(...)`). That implementation lives in **`createSupabaseMiddlewareClient()`** (`middleware-client.ts`); `proxy.ts` holds a **`state`** object whose **`response`** field is reassigned when Supabase writes cookies.

You **cannot** swap in `createSupabaseServerClient()` inside the proxy without the wrong adapter. **Env** is shared via **`getSupabaseEnv()`**; the **cookie bridge** stays in **`middleware-client.ts`**, separate from `server-client.ts`.

---

## 3. End-to-end timelines

### 3.1 Email + password — sign up (`EmailPasswordForm`)

1. User submits email/password in **sign up** mode.
2. **`supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`** runs in the browser.
3. Supabase may require **email confirmation** depending on project settings; if so, session might be **null** until the user clicks the link.
4. Confirmation link hits **`/welcome`** (or your configured path) — that route can establish or complete the flow per your Supabase settings.
5. After confirmation (or if email confirmation is off), the browser holds a **session**; cookies reflect that for subsequent **server** reads.

### 3.2 Email + password — sign in

1. **`supabase.auth.signInWithPassword({ email, password })`** in the browser.
2. On success, Supabase updates **session + cookies**; **`onAuthStateChange`** runs with a new `session`; UI updates.

### 3.3 Google OAuth (`GoogleLoginForm`)

1. **`signInWithOAuth({ provider: "google", options: { redirectTo, ... } })`** sends the user to Google.
2. User approves; Google redirects back through Supabase, then to your app (e.g. **`redirectTo`** pointing at an auth route).
3. **PKCE / code flow:** the return URL may include **`?code=...`** (and often **`state`**). The **proxy** calls **`supabase.auth.exchangeCodeForSession(code)`** so the session is established **before** the page runs.
4. After exchange, **`getUser()`** sees the user; the proxy can **redirect to the same path without `code` / `state`** so the address bar is clean (see §5).
5. **`onAuthStateChange`** / **`getSession`** on the client see the session once the page loads.

### 3.4 Sign out

1. **`supabase.auth.signOut()`** runs in the browser (e.g. from `app/profile/sign-out-button.tsx`).
2. Session ends; storage/cookies updated; **`onAuthStateChange`** fires; UI can clear local state.

---

## 4. Server Components — reading the session on the server

Example: auth pages under `app/google-login/`, `app/email-password/`, `app/profile/`.

1. **`await createSupabaseServerClient()`** — builds the server client with the **cookie adapter** tied to the current request’s `cookies()`.
2. **`await supabase.auth.getUser()`** — validates/refreshes using cookies and returns **`user`** (or `null`).
3. Pass **`user`** into client components so the first paint can match the real session where needed.

**Important:** `getUser()` is the preferred server check because it **verifies** the JWT with Supabase; it can also participate in **refresh** behavior depending on configuration and cookie updates.

---

## 5. Proxy — `proxy.ts` (Next.js 16 request boundary)

The root **`proxy.ts`** exports **`proxy`**, which runs at the **edge of the app** for matched routes (`config.matcher` skips static assets: `_next/static`, `_next/image`, `favicon.ico`, common image extensions).

### 5.1 Supabase in the proxy (not `createSupabaseServerClient`)

1. Build **`state`** with **`response: NextResponse.next({ request: { headers: request.headers } })`** — baseline outgoing response; the cookie **`setAll`** path **reassigns `state.response`** when Supabase needs to write cookies (standard `@supabase/ssr` middleware pattern).
2. **`createSupabaseMiddlewareClient(request, state)`** (`middleware-client.ts`) — same **`createServerClient`** + **`request.cookies`** / **`state.response.cookies`** adapter as §2.3. After **`exchangeCodeForSession`** / **`getUser()`**, read the latest response from **`state.response`** (not a stale copy).
3. If the URL has **`?code=`** → **`await supabase.auth.exchangeCodeForSession(code)`** (OAuth PKCE completion).
4. **`await supabase.auth.getUser()`** — session read/refresh from cookies.

### 5.2 Protected routes, public routes, and auth routes

The proxy does **not** implement a single “everything requires login” policy. It combines three ideas:

1. **Protected paths** — anonymous users are **turned away** (redirect to login).
2. **Everything else** — anonymous users **may** visit the URL (public for guests, with respect to this proxy).
3. **Auth routes** — special URLs for signing in; **signed-in** users are **redirected home** so they do not keep using login screens.

#### Protected (session required at the proxy)

These paths are **blocked for guests**: if `getUser()` returns **no user**, the proxy redirects to **`/login`**.

| Path | Role |
|------|------|
| **`/`** | Home |
| **`/profile`** | Profile |

Implementation: **`isProtectedPath(pathname)`** in `proxy.ts` — currently only **`/`** and **`/profile`**. To require login for another URL (e.g. **`/dashboard`**), add it there.

#### Not protected by the proxy (guests allowed)

Any route whose pathname is **not** handled by **`isProtectedPath`** is **not** sent to **`/login`** by the proxy. Anonymous users can open it like any public page.

Examples in this project:

| Path | Notes |
|------|--------|
| **`/welcome`** | Post-signup / marketing-style page; guests can open it |
| **`/login`** | Login hub |
| **`/email-password`** | Email/password sign-in or sign-up |
| **`/google-login`** | Google OAuth entry |

**New routes** you add under `app/` (e.g. **`/about`**, **`/pricing`**) are **public for guests by default** until you add their pathname to **`isProtectedPath`**. The proxy **`matcher`** still runs for those requests (session refresh + OAuth code handling apply), but there is **no** “must be logged in” redirect unless you extend **`isProtectedPath`**.

#### Auth routes (`AUTH_ROUTES`) — not “protected”, but redirect signed-in users

**`/login`**, **`/email-password`**, and **`/google-login`** are listed in **`AUTH_ROUTES`** in `proxy.ts`. They are **not** protected in the sense above: **guests are allowed** (otherwise nobody could sign in). The extra rule is: if there **is** a **`user`**, the proxy **redirects to `/`** so authenticated users do not stay on sign-in pages.

#### Summary of outcomes

| Condition | Result |
|-----------|--------|
| **No user** and path is **`/`** or **`/profile`** | Redirect to **`/login`** |
| **No user** on any other path (e.g. **`/welcome`**, **`/login`**) | Request continues; **no** login redirect from the proxy |
| **User** on **`/login`**, **`/email-password`**, **`/google-login`** | Redirect to **`/`** |
| **User** and URL had **`?code=`** (OAuth just finished) | Redirect to **same pathname**, **`code` / `state` removed** from query |

### 5.3 Redirects and cookies

**`redirectWithCookies`** / **`redirectCleanUrlWithCookies`** build a **`NextResponse.redirect(...)`** and **copy every cookie** from the intermediate `next` response onto the redirect. That matters because **`getUser()`** (or the code exchange) may have **refreshed** session cookies onto `response`; a naive redirect would drop them.

---

## 6. Token refresh (when it happens)

- **`getUser()`** on the server (RSC or proxy) triggers Supabase to **validate** the user and, when appropriate, **refresh** tokens.
- The refreshed values are written via the **`setAll`** path of the relevant cookie adapter **when the runtime allows cookie writes**.
- The browser client also refreshes over time; **`onAuthStateChange`** can emit **`TOKEN_REFRESHED`** (visible in logs if you log events).

---

## 7. Quick checklist — “where is session X handled?”

| Moment | Where | What |
|--------|--------|------|
| User signs in (password/OAuth) | Browser client | Session created/updated; cookies updated for SSR |
| UI updates without reload | `onAuthStateChange` in client forms | React state tracks `user` |
| First load with server `user` | Page `page.tsx` + `getUser()` | Server reads cookies |
| Visit **`/`** or **`/profile`** while logged out | `proxy.ts` | Redirect to `/login` |
| OAuth return with **`?code=`** | `proxy.ts` | `exchangeCodeForSession` → optional clean URL redirect |
| Request hits RSC / Server Action / Route Handler | `createSupabaseServerClient()` | `getAll` / `setAll` via `cookies()` |
| Matched request hits proxy | `createSupabaseMiddlewareClient()` in `middleware-client.ts`, called from `proxy.ts` | `getAll` / `setAll` via `NextRequest` / `NextResponse` |
| Cookie write throws in server client | `setAll` `catch` | Request not crashed |
| User signs out | `signOut()` in browser | Session cleared; UI and cookies follow |

---

## 8. Environment variables

- **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** must be set (see `.env.local`).
- **`getSupabaseEnv()`** in `lib/supabase/env.ts` reads and validates them for **server** and **middleware** clients (missing values throw a clear error). The **browser** client still reads the same variables directly when creating the Supabase URL/key for `createBrowserClient`.
- They are used by **browser**, **server**, and **proxy** paths so everything talks to the **same** Supabase project.

---

## 9. Related files (map)

| File | Role |
|------|------|
| `lib/supabase/env.ts` | `getSupabaseEnv()` — shared URL + anon key validation for server and middleware clients |
| `lib/supabase/browser-client.ts` | `getSupabaseBrowserClient()` — client-only Supabase |
| `lib/supabase/server-client.ts` | `createSupabaseServerClient()` — RSC / actions / routes (`cookies()` adapter) |
| `lib/supabase/middleware-client.ts` | `createSupabaseMiddlewareClient()` — `NextRequest` / `NextResponse` cookie adapter for the proxy |
| `proxy.ts` | Session refresh, OAuth code exchange, route gating; calls **`createSupabaseMiddlewareClient`** |
| `app/email-password/EmailPasswordForm.tsx` | Email/password UI |
| `app/google-login/GoogleLoginForm.tsx` | Google OAuth button / flow |
| `app/login/page.tsx` | Login hub |
| `app/profile/page.tsx`, `app/profile/sign-out-button.tsx` | Profile + sign out |
| `app/welcome/page.tsx` | Example post-signup / welcome route |

This should cover the main touchpoints for session, cookies, and redirects in the current codebase.
