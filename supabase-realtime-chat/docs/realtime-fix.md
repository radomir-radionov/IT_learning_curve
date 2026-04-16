# Realtime Chat Fix

## Problems

### 1. No broadcast after send
`sendMessage` (server action) only inserted into the DB — it never called `channel.send()`.
Other users' subscriptions received nothing.

**Fix:** after a successful send, the sender's client now calls `channel.send()` to broadcast the message to all channel subscribers.

### 2. Realtime subscription silently rejected
The `realtime.messages` RLS policy verified room membership via a subquery on `chat_room_member`. But `chat_room_member` had RLS enabled with **zero policies**, so the subquery always returned empty — every subscription was rejected. Presence stayed at "1 user online" and no broadcasts were received.

**Fix:** added a SELECT policy on `chat_room_member` allowing users to read their own memberships.

### 3. All public tables had RLS on with no policies
`chat_room`, `chat_room_member`, `message`, `user_profile` — all blocked for browser clients. Not noticed earlier because all server-side code uses the admin client (bypasses RLS).

**Fix:** added SELECT policies to all public tables.

## Why it seemed to work
Server-side code (page load, sending) uses the **admin client** → RLS bypassed → always worked.
Client-side code (Realtime, infinite scroll) uses the **browser client** → RLS applied → silently broken.
