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

## 2. Two Supabase clients (and why)

### 2.1 Browser client — `lib/supabase/browser-client.ts`

- Built with **`createBrowserClient`** from `@supabase/ssr`.
- Used only in **`"use client"`** components (e.g. `GoogleLoginDemo`, `EmailPasswordDemo`).
- **Singleton**: one instance per tab load so listeners and internal state stay consistent.

**What it does with sessions/cookies**

- On sign-in / sign-up / OAuth, the browser client talks to Supabase and **updates auth storage**. With `@supabase/ssr`, that storage is aligned with **cookie-based** session handling suitable for SSR.
- **`supabase.auth.getSession()`** — reads the current session from the client’s perspective (used on mount in the demos for logging).
- **`supabase.auth.onAuthStateChange(...)`** — fires when login, logout, token refresh, or user updates happen; the demos use it to **`setCurrentUser`** so the UI stays in sync without a full reload.
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
           token refresh in middleware/proxy is the usual place where writes succeed.
```

So: **you are not “manually managing JWT strings”** — you are **plugging Next’s cookie APIs into Supabase** so `createServerClient` can sync session state on the server.

---

## 3. End-to-end timelines

### 3.1 Email + password — sign up (`EmailPasswordDemo`)

1. User submits email/password in **sign up** mode.
2. **`supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`** runs in the browser.
3. Supabase may require **email confirmation** depending on project settings; if so, session might be **null** until the user clicks the link.
4. Confirmation link hits **`/welcome`** (or your configured path) — that route can establish or complete the flow per your Supabase settings.
5. After confirmation (or if email confirmation is off), the browser holds a **session**; cookies reflect that for subsequent **server** reads.

### 3.2 Email + password — sign in

1. **`supabase.auth.signInWithPassword({ email, password })`** in the browser.
2. On success, Supabase updates **session + cookies**; **`onAuthStateChange`** runs with a new `session`; UI updates.

### 3.3 Google OAuth (`GoogleLoginDemo`)

1. **`signInWithOAuth({ provider: "google", options: { redirectTo, ... } })`** sends the user to Google.
2. User approves; Google redirects back to Supabase, then to your app (e.g. **`redirectTo`: `/google-login`**).
3. Supabase completes the exchange; **session is established** and **cookies** are set for your domain.
4. **`onAuthStateChange`** / **`getSession`** see the new session on the client.

### 3.4 Sign out (both demos)

1. **`supabase.auth.signOut()`** runs in the browser.
2. Session ends; storage/cookies updated; **`onAuthStateChange`** fires; **`currentUser`** cleared in React state.

---

## 4. Server Components — reading the session on the server

Example: `app/google-login/page.tsx` and `app/email-password/page.tsx`.

1. **`await createSupabaseServerClient()`** — builds the server client with the **cookie adapter** tied to the current request’s `cookies()`.
2. **`await supabase.auth.getUser()`** — validates/refreshes using cookies and returns **`user`** (or `null`).
3. That **`user`** is passed as a prop into the client demo so the first paint can match the real session.

**Important:** `getUser()` is the preferred server check because it **verifies** the JWT with Supabase; it can also participate in **refresh** behavior depending on configuration and cookie updates.

---

## 5. Proxy — `proxy.ts` (Next.js 16 request boundary)

In Next.js 16, the root **`proxy.ts`** file (with an exported **`proxy`**) runs at the **edge of your app** for matched routes (see Next.js docs for `matcher` / defaults).

Per request (as written in this repo):

1. **`NextResponse.next({ request: { headers } })`** — baseline response to continue the request.
2. **`createSupabaseServerClient()`** + **`supabase.auth.getUser()`** — same idea as RSC: read session from **cookies**, refresh if needed.
3. If **`!user`** and path **`/protected`** → **redirect to `/login`**.
4. Otherwise return the **`next`** response.

So the proxy is where you enforce **“must be logged in”** for URL prefixes **without** putting that logic in every page.

---

## 6. Token refresh (when it happens)

- **`getUser()`** on the server (RSC or proxy) triggers Supabase to **validate** the user and, when appropriate, **refresh** tokens.
- The refreshed values are written via the **`setAll`** path of your cookie adapter **when the runtime allows cookie writes**.
- The browser client also refreshes over time; **`onAuthStateChange`** can emit **`TOKEN_REFRESHED`** (you’ll see it in logs if you log events).

---

## 7. Quick checklist — “where is session X handled?”

| Moment | Where | What |
|--------|--------|------|
| User signs in (password/OAuth) | Browser client | Session created/updated; cookies updated for SSR |
| UI updates without reload | `onAuthStateChange` in demos | React state tracks `user` |
| First load of a page with server `user` | Page `page.tsx` + `getUser()` | Server reads cookies |
| Visit `/protected` while logged out | `proxy.ts` | Redirect to `/login` |
| Request hits server API/RSC | `createSupabaseServerClient()` | `getAll` / `setAll` on cookies |
| Cookie write throws | `setAll` `catch` | Logged; request not crashed |
| User signs out | `signOut()` in browser | Session cleared; UI and cookies follow |

---

## 8. Environment variables

- **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** must be set (see `.env.local`).  
- They are used by **both** browser and server clients so everyone talks to the **same** Supabase project.

---

## 9. Related files (map)

| File | Role |
|------|------|
| `lib/supabase/browser-client.ts` | Client-only Supabase; demos, listeners |
| `lib/supabase/server-client.ts` | Cookie adapter + `createServerClient` |
| `app/**/page.tsx` (auth pages) | `getUser()` → pass `user` to demos |
| `proxy.ts` | Optional global gate + session touch on each matched request |
| `app/welcome/page.tsx` | Example server usage with `createSupabaseServerClient` |

This should cover **every main touchpoint** for session, cookies, and redirects in the current codebase.
