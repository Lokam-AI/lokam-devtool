# Codebase Flaw Audit

---

## BACKEND

### Security

**B-1 · Weak default `SECRET_KEY`**
`server/app/core/config.py:14` — `SECRET_KEY` defaults to `"insecure-dev-key"`. If the env var is unset in production, any JWT is trivially forgeable.

**B-2 · `secure=False` on auth cookie**
`server/app/api/v1/endpoints/auth.py:44` — The httpOnly cookie is set with `secure=False` hardcoded. In production the cookie travels in plaintext over HTTP.

**B-3 · No brute-force protection on `/auth/login`**
No rate limiting, lockout, or CAPTCHA. The endpoint is fully open to credential stuffing.

**B-4 · `FERNET_KEY` not validated at startup**
`server/app/core/encryption.py:13-14` — Only raises `ValidationError` on first call. The app boots normally with an empty `FERNET_KEY` and then crashes on the first encrypted write/read.

**B-5 · Silent decryption fallback passes ciphertext as auth header**
`server/app/services/admin_proxy_service.py:79` and `call_sync_service.py:57` — If `decrypt_secret` fails, the bare ciphertext string is forwarded as the `Authorization` header to the downstream API. The failure is silently swallowed.

---

### Correctness

**B-6 · `ConflictError` has no registered exception handler**
`server/app/main.py` — `NotFoundError`, `AuthError`, `PermissionError`, and the base `AppError` all have handlers, but `ConflictError` is missing. It falls through to the `AppError` handler and returns 400 instead of 409.

**B-7 · `_categorize_calls` operator-precedence ambiguity**
`server/app/services/assignment_service.py:45`:
```python
elif call.nps_score is None or call.nps_score > DETRACTOR_NPS_MAX and call.nps_score < PROMOTER_NPS_MIN:
```
`and` binds tighter than `or`. Missing parentheses make the intent unverifiable at a glance and will break silently if the condition is ever refactored.

**B-8 · `get_unassigned_for_date` subquery is unscoped**
`server/app/repositories/raw_call_repo.py:41` — The subquery `select(Eval.call_id)` returns every call_id ever assigned, across all dates. A call that was assigned on a past date will never be re-assigned, even if the original eval was deleted. Intent vs. implementation is undocumented.

**B-9 · `datetime.utcnow()` is deprecated**
`server/app/core/security.py:27` and `server/app/services/eval_service.py:53` — Python 3.12+ emits `DeprecationWarning`; should be `datetime.now(timezone.utc)`.

**B-10 · `HTTPException` raised directly in a route**
`server/app/api/v1/endpoints/calls.py:62-63` — `GET /calls/{call_id}` raises `HTTPException` inline, bypassing the domain `NotFoundError` pattern used everywhere else.

---

### Design / Architecture

**B-11 · `EvalRead` inherits from `EvalCreate`**
`server/app/schemas/eval.py:41` — A read schema inheriting a create schema couples input and output shapes. Fields that should never be user-supplied (e.g. `call_id`, `assigned_to`) are implicitly part of the response schema.

**B-12 · `_build_headers` duplicated across two services**
`admin_proxy_service.py:86-93` and `call_sync_service.py:65-72` — Identical function, different module. Bug fixes must be applied twice.

**B-13 · `sync_calls_for_date` syncs envs sequentially**
`server/app/services/call_sync_service.py:19-22` — Envs are processed one by one in a `for` loop inside an `async` function. `asyncio.gather()` would run them concurrently.

**B-14 · No soft-delete endpoint exposed**
`user_repo.soft_delete` exists but no router exposes `DELETE /users/{id}` or `PATCH /users/{id}` for deactivation. Admins have no way to disable a user via the API.

**B-15 · `PermissionError` and `ValidationError` shadow Python builtins**
`server/app/exceptions.py:18,27` — Shadows `builtins.PermissionError` and `pydantic.ValidationError`. Any bare `except PermissionError` in a calling scope will match the wrong class.

**B-16 · No pagination on `GET /evals/my`**
`server/app/api/v1/endpoints/evals.py:13-20` — Returns the full list of a reviewer's evals in one response. Unbounded as workload grows.

---

## FRONTEND

### Data / API

**F-1 · `apiGetCalls` makes N+1 HTTP requests**
`client/src/lib/api.ts:165-185` — Fetches all evals first, then fires one `GET /calls/{id}` per eval in parallel. 15 assigned calls = 16 requests per page load.

**F-2 · `apiGetCall` calls `apiGetCalls` internally**
`client/src/lib/api.ts:189` — Single-call lookup triggers the full N+1 waterfall from F-1 before falling back to a direct fetch. Opening any eval form doubles the request count.

**F-3 · `apiGetHealth` is hardcoded to return zeroes**
`client/src/lib/api.ts:281-283` — Returns `{ active_calls: 0, queue_depth: 0, workers: 0 }` always. The dashboard shows "Real-time Telemetry" and "Auto-refresh active" but the numbers are permanently fake.

**F-4 · `apiGetTeam` returns zero progress for everyone**
`client/src/lib/api.ts:286-296` — Maps users to `TeamMember` with `calls_assigned: 0`, `completed_today: 0`, `completion_pct: 0`. The team progress bars in DashboardPage always show 0%.

**F-5 · `AllCallsPage` env filter options are hardcoded**
`client/src/pages/AllCallsPage.tsx:198-202` — Dropdown hardcodes `playground`, `staging`, `prod`. Actual envs come from `/admin/envs` and should be fetched dynamically.

---

### React / State

**F-6 · `useMemo` contains a side effect (`setPage`)**
`client/src/pages/MyCallsPage.tsx:29-31` — `setPage(1)` is called inside `useMemo`. Side effects in memos are incorrect React; in strict mode this runs twice and triggers a double reset.

**F-7 · `useEffect` missing `refreshMe` in deps**
`client/src/components/layout/AppLayout.tsx:14-16`:
```tsx
useEffect(() => {
  if (!initialized) refreshMe();
}, []);   // refreshMe missing
```
Stale closure. ESLint exhaustive-deps would flag this.

**F-8 · Stale persisted user role**
`client/src/store/auth-store.ts:59-63` — The `user` object is persisted to `localStorage`. If an admin changes a user's role on the backend, the frontend silently uses the old role until the next `refreshMe()`, which only fires once on first render.

**F-9 · `AllCallsPage` search doesn't reset page**
`client/src/pages/AllCallsPage.tsx:29` — Changing `searchQuery` does not reset `page` to 0. If you're on page 5 and type a filter, the page stays at 5 (which likely has no results) with no feedback.

**F-10 · `QueryClient` instantiated at module level**
`client/src/App.tsx:21` — Created outside the component tree. Shared across HMR cycles in dev; breaks test isolation when the module is imported.

---

### Auth / Routing

**F-11 · `/change-password` has no auth guard**
`client/src/App.tsx:38-40` — The route is outside `AppLayout`, so unauthenticated users can navigate to it directly. The API call will fail, but the page renders without redirecting to login.

---

### UI / UX

**F-12 · "Forgot Password?" link is dead**
`client/src/pages/LoginPage.tsx:152-155` — Rendered as a clickable `<span>` with no `onClick`. Nothing happens on click.

**F-13 · Dashboard "Completed Today" shows static "98% Efficient"**
`client/src/pages/DashboardPage.tsx:199` — `{completed > 0 ? "98% Efficient" : "—"}` — hardcoded badge, unrelated to actual data.

**F-14 · Dashboard traffic chart always shows hour 0**
`client/src/pages/DashboardPage.tsx:39` — `new Date(call.date).getHours()` where `call.date` is a date-only string (`YYYY-MM-DD`). Parsed as UTC midnight; local timezone offset flips it to hour 23 or 0. All bars land on the same bucket.

**F-15 · "Export", "View System Logs", "Clear Cache" buttons are non-functional**
`client/src/pages/DashboardPage.tsx:282`, `client/src/pages/AdminPage.tsx:268-275` — Styled buttons with no `onClick`. Clicking does nothing.

**F-16 · Pagination counter shows "1–0 of 0" when empty**
`client/src/pages/AllCallsPage.tsx:222` — When `totalCount = 0`, displays `1–0 of 0` because `page * PAGE_SIZE + 1 = 1` regardless. Should guard against this.

**F-17 · No error state handling in most pages**
`DashboardPage`, `MyCallsPage`, `EvalFormPage` all use `isLoading` from React Query but ignore `isError`. A failed fetch silently shows empty state with no user feedback.

**F-18 · `EvalFormPage` uses `as any` to build submit payload**
`client/src/pages/EvalFormPage.tsx:147-148` — Casts `evalUpdate` to `any` when assigning gt_ fields. Type errors in this mapping are invisible.

**F-19 · `EvalFormPage` transcript parser silently drops unknown lines**
`client/src/pages/EvalFormPage.tsx:816-884` — Lines that don't start with `"assistant:"` or `"human:"` return `null` and are silently discarded. Any transcript format variation renders an empty panel.

**F-20 · `AdminPage` creates a second Axios instance without the 401 interceptor**
`client/src/pages/AdminPage.tsx:9-13` — `internalApi` is a fresh `axios.create()` separate from the shared `api` client. It does not have the response interceptor that auto-logs out on 401. Admin users whose session expires will see raw error toasts instead of being redirected to login.
