# Platform Auth & Host Config — Security and Stability

**Scope:** the Auth0 tenant and its applications, the Google OAuth relationships, and the
platform host/domain configuration that determines which callback URLs are in play.

**Why this doc exists:** an audit on **2026-10-16** found a `*.vercel.app` wildcard in the
Auth0 Allowed Callback URLs of *both* production and staging applications. That is a
directly exploitable misconfiguration — Vercel subdomains are free and instant to claim.
The same audit turned up an Auth0 dev-keys warning on the production login page and a
host-canonicalization mismatch that cost a redirect on every scanned QR. None of it was
recorded anywhere, because the Auth0 config lives only in dashboard state.

Read this before touching Auth0, Google OAuth, or Vercel domain settings. Run
[§5 Verification](#5-verification-run-this-after-any-authhost-change) afterwards.

---

## 1. Auth0 tenancy and application inventory

One tenant serves both environments: **`dev-jaiggvvi3zsttaoo.us.auth0.com`**.

The `dev-` prefix is cosmetic — it is the name chosen at tenant creation. It does not
mean the tenant is unsuitable for production, and nothing needs "fixing" about the name.

Three applications exist. **Match on Client ID, not name** — the naming is actively
misleading and has already caused an edit to land in the wrong application.

| Auth0 app name | Client ID | Type | Serves | Notes |
|---|---|---|---|---|
| `visible-shelf-production-admin-dashboard` | `Nv81D3lvTPiLmeQd75UW669rbriUTFgR` | Regular Web App | `visibleshelf.com`, `www.visibleshelf.com`, `retail-visibility-platform-web.vercel.app`, `retail-visibility-platform-web-paul-yarls-projects.vercel.app` | **production** |
| `Visible Shelf` | `qa3lsBavdX2uIZ5lSElylPvwF58Dzs8C` | Regular Web App | `visibleshelf.store`, `www.visibleshelf.store` | **staging** — rename to `visible-shelf-staging` |
| `Default App` | `zjVeIsujvk33u9wndSVJTJsISfWABoKt` | Generic | *no consumers found* | delete (see §7) |

How each was identified: request `/auth/login` on the host and read the `client_id` in
the redirect to the tenant's `/authorize`. See §5.

`visibleshelf.store` / `www.visibleshelf.store` are **staging** domains per the Vercel
project, which is what makes `Visible Shelf` the staging application despite the name.

---

## 2. The allowlists

Four separate fields in Auth0. They are **not** interchangeable, and the correct *shape*
differs per field:

| Field | Where it applies | Correct shape |
|---|---|---|
| **Allowed Callback URLs** | Auth0 → your app, after login. Validated against the `redirect_uri` your app sends. | **Exact paths**: `https://host/auth/callback` |
| **Allowed Logout URLs** | Auth0 → your app, after logout | **Bare origins**: `https://host` |
| **Allowed Web Origins** | CORS for Auth0's own endpoints / silent auth | **Bare origins**: `https://host` |
| **Allowed Origins (CORS)** | Cross-origin auth (embedded Lock / custom HTML) | **Bare origins**: `https://host` |

### The rules

1. **No wildcards.** A single `*` is permitted in the subdomain or domain position only,
   and even then it is almost always wrong here. `https://*.vercel.app/auth/callback` and
   `https://retail-visibility-platform-*.vercel.app/auth/callback` are both dangerous:
   anyone can register a Vercel project matching either pattern. The second is *not*
   meaningfully safer than the first — it only requires the project name to start with
   `retail-visibility-platform-`.
2. **Callbacks need a path.** A bare origin in the *Callback* field tells Auth0 to deliver
   `?code=…` to the site root, which is not the callback handler — the code lands on a page
   that won't consume it and can leak into logs, analytics, or a `Referer` header. Bare
   origins belong in the Logout / Web Origins / CORS fields, not this one.
3. **No `localhost`.** Local development belongs in its own Auth0 application, not in the
   staging or production allowlists.
4. **One host per environment.** A production alias (`…paul-yarls-projects.vercel.app`)
   does not belong on the staging application.

### Target state

**Production application:**

```
Allowed Callback URLs   https://visibleshelf.com/auth/callback
                        https://www.visibleshelf.com/auth/callback
Allowed Logout URLs     https://visibleshelf.com
                        https://www.visibleshelf.com
Allowed Web Origins     https://visibleshelf.com
                        https://www.visibleshelf.com
```

Optionally add the specific auto-generated aliases as callbacks
(`https://retail-visibility-platform-web.vercel.app/auth/callback`,
`https://retail-visibility-platform-web-paul-yarls-projects.vercel.app/auth/callback`) —
these are concrete hosts, not wildcards. Omit them if nobody should authenticate on the
alias.

> **Status 2026-10-16 — allowlist work complete.** Each application now carries exactly
> three entries per field: its two canonical hosts plus its own stable
> `-git-<branch>-<team>.vercel.app` branch alias. No wildcards, no cross-environment hosts,
> no per-deployment hosts. Verified: every legitimate callback returns `302`; the removed
> bare origins, the stray production alias on staging, and the retired `-<hash>-` hosts all
> return `403 Callback URL mismatch`; and an arbitrary `vercel.app` host returns `403` on
> both. The only remaining item in this area is `Application Login URI` (§7).

**Staging application:**

```
Allowed Callback URLs   https://visibleshelf.store/auth/callback
                        https://www.visibleshelf.store/auth/callback
Allowed Logout URLs     https://visibleshelf.store
                        https://www.visibleshelf.store
Allowed Web Origins     https://visibleshelf.store
                        https://www.visibleshelf.store
```

**Preview deployments:** each environment lists only its own hosts — production gets the
`-git-main-…` alias, staging the `-git-staging-…` alias. Consequence to expect: a preview
deployment on a **new branch** will fail login with `403 Callback URL mismatch` until its
branch alias is added, because there is no longer a wildcard to catch it. That is the
intended trade-off. If preview logins become routine, the clean fix is a dedicated preview
Auth0 application selected via Vercel's **Preview**-scoped `AUTH0_CLIENT_ID`, rather than
widening either of these two allowlists.

> Do **not** add the per-deployment `{project}-{hash}-{team}.vercel.app` hosts. They are
> unique to a single build and are never reused, so they become dead entries on the next
> deploy. The `-git-<branch>-` branch alias is the stable one.

**Local development:** create a separate application (e.g. `visible-shelf-local-dev`) whose
allowlist is only `http://localhost:3000/auth/callback` and
`https://localhost:3000/auth/callback`, and point local `AUTH0_CLIENT_ID` at it.

> `docs/AUTH0_SETUP.md` currently lists the **staging** client ID as the local-dev value.
> That is wrong and should not be followed.

---

## 3. The two Google relationships

The platform talks to Google in two completely independent ways. Confusing them leads to
fixing the wrong thing when something breaks.

### 3a. Login — brokered by Auth0

```
1. your app  →  Auth0     /authorize?redirect_uri=https://visibleshelf.com/auth/callback
                          ↑ Auth0 validates against ALLOWED CALLBACK URLS
2. Auth0     →  Google    accounts.google.com/o/oauth2/auth?redirect_uri=
                          https://dev-jaiggvvi3zsttaoo.us.auth0.com/login/callback
                          ↑ Google validates against AUTHORIZED REDIRECT URIs
                            in Google Cloud Console
3. Google    →  Auth0     back to Auth0's /login/callback
4. Auth0     →  your app  back to your Allowed Callback URL with ?code=…
                          your app exchanges it at /oauth/token
```

Key points:

- **Google never reads Allowed Callback URLs.** The Google-facing allowlist is
  *Authorized redirect URIs* in the Google Cloud Console, and it points at **Auth0's**
  `/login/callback`, not at the platform.
- The "third party returns the response" hop lands on Auth0, not on the app.
- Terminology collision: Auth0 also calls *its* Google-facing endpoint a "callback URL"
  and shows it in **Authentication → Social → Google**. Two different things, same name.
- If Google sign-in fails with `redirect_uri_mismatch`, the fix is in Google Cloud Console.
  If Auth0 sign-in fails with `Callback URL mismatch`, the fix is in Allowed Callback URLs.
- `apps/web/src/lib/auth0.ts` passes no `baseURL`, so the SDK **infers the callback from the
  request host**. This is why the allowlist must enumerate every host that may serve login,
  and why the host configuration in §4 is auth-relevant.

### 3b. Google Business Profile + Merchant Center — direct, platform-owned

Entirely separate from Auth0 and not brokered by anything:

`apps/api/src/lib/google/oauth.ts`

```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
scopes: content (Merchant), business.manage (Business Profile), openid, userinfo
access_type=offline, prompt=consent   → refresh token for later API calls
```

Its `redirect_uri` is `GOOGLE_REDIRECT_URI` — the **platform's own** callback. Auth0 is not
involved at any point. This is the platform's own OAuth client, registered in its own
Google Cloud project.

### 3c. ⚠️ Dev keys on the login connection

The production login page renders Auth0's own warning:

> **Alerts — Dev Keys:** One or more of your connections are currently using Auth0
> development keys and should not be used in production.

and offers `Continue with Google` (`connection=google-oauth2`). So the login Google
connection runs on **Auth0's shared development keys**:

- The Google consent screen shows **"Auth0"** instead of Visible Shelf.
- The quota is shared across every Auth0 tenant using dev keys — it can throttle or break
  through no fault of ours.
- Auth0 can rotate or disable them without notice.
- Auth0 states plainly: not for production.

**Confirmed 2026-10-16:** both the production *and* staging login pages render this warning,
because Auth0 connections are tenant-scoped — the Google connection is shared across both
applications. **Fixing the connection fixes both at once.**

**Fix:** create a Google OAuth 2.0 client in Google Cloud Console, register
`https://dev-jaiggvvi3zsttaoo.us.auth0.com/login/callback` as an Authorized redirect URI,
then put that client ID + secret into Auth0 → Authentication → Social → Google.

Two things that will bite if missed:

1. **Publish the OAuth consent screen to "In production", not "Testing".** While it is in
   Testing, only explicitly added test users can sign in — every other user is refused.
   The scopes in play here (`openid`, `email`, `profile`) are non-sensitive, so publishing
   needs no Google review.
2. **Existing Google-linked users may need a re-link.** Google's `sub` — which becomes the
   Auth0 user ID `google-oauth2|<sub>` — is scoped to the OAuth client, so switching client
   IDs can change it. If it does, Auth0 treats each existing Google user as a *new* Auth0
   user on their next login. The app absorbs this: `/api/auth/sync-user` matches `auth0_id`
   first and then **falls back to matching by email**, so the existing `users` row is reused
   and login keeps working. Roles live in the DB (`users.role`), not Auth0 `app_metadata`,
   so access is not lost. One wart: that handler writes
   `auth0_id: user.auth0_id || auth0Id`, so a switched user keeps the **stale** `auth0_id`
   rather than the new one.

   Blast radius at the time of writing: **3 of 11 users** are `google-oauth2|…`; 2 are
   `auth0|…` (password, unaffected) and 6 have no `auth0_id` (unaffected).

   Verify with one of the three before rolling out:

   ```sql
   SELECT email, auth0_id FROM users WHERE auth0_id LIKE 'google-oauth2|%';
   ```

   Note the `auth0_id`, switch the connection keys, sign in with Google for that account,
   then confirm login succeeds, the same `users` row is reused, and whether `auth0_id`
   changed. Also check any Auth0 Actions for `app_metadata` reads — a new Auth0 user would
   not carry the old `app_metadata`.

Note the ownership distinction, because it is the whole point: Auth0 is the runtime broker
in both cases, but with dev keys **Auth0 owns the Google client**; with own keys **we** do.

---

## 4. Platform host configuration

### The origin chain

`apps/web/src/lib/storefront-routing.ts`

```ts
platformOrigin() = NEXT_PUBLIC_WEB_URL || NEXT_PUBLIC_APP_ORIGIN || WEB_URL || 'https://visibleshelf.com'
```

First one set wins. In production this resolves to `https://visibleshelf.com`.

`NEXT_PUBLIC_*` values are **inlined into the client bundle at build time**, and
`platformOrigin()` is called from ~23 files including client components. Changing a
`NEXT_PUBLIC_*` value therefore requires a **rebuild**, not just an env edit; and Vercel
does not retroactively inject changed env vars into an existing deployment, so a redeploy
is required either way.

### ⚠️ Why you must not simply point this at `www.`

`platformApexHost()` is derived from `platformOrigin()`, and it builds tenant subdomain URLs:

```ts
platformApexHost() = new URL(platformOrigin()).hostname
canonicalStorefrontOrigin() → `https://${host}.${platformApexHost()}`
```

Setting the origin to `https://www.visibleshelf.com` would make `platformApexHost()` return
`www.visibleshelf.com` and produce `https://baraka-international-market.www.visibleshelf.com`.
Two live tenants have subdomains (`baraka-international-market`,
`ivoire-african-market-pa`), so this would break paying customers' storefront URLs.

**Correct fixes, in order of preference:**

1. Make the apex serve the app directly (Vercel → Domains → remove the redirect on
   `visibleshelf.com`) so `platformOrigin()` already matches the serving host. *(Applied
   2026-10-16 — see changelog.)*
2. Or strip a leading `www.` inside `platformApexHost()` first, then the env var can safely
   point at `www.`.

### Vercel domains

The redirect was Vercel **domain** configuration, not repo code — `vercel.json` has no
`redirects`, and `proxy.ts` has no platform-apex canonicalization (its only `www` handling
is a custom-host www→apex 301 for tenant domains). Diagnostic signal: a Vercel edge
redirect returns `Server: Vercel` + `X-Vercel-Id` but **no `X-Matched-Path`**, because it
never reaches the Next.js app.

**Resolution (2026-10-16):** the `↳ 307 www.visibleshelf.com` redirect on the apex was
removed, so both hosts now serve `200` directly and app-generated URLs (always the apex)
cost no hop.

---

## 5. Verification (run this after any auth/host change)

Replaying the `/authorize` request with a substituted `redirect_uri` is the only way to
confirm an allowlist change actually took effect — a wildcard can be visually absent and
still present in a cached rule.

```bash
# 1. Which client does a host use?
for h in https://visibleshelf.com https://visibleshelf.store; do
  cid=$(curl -sS -o /dev/null -D - "$h/auth/login" 2>/dev/null \
    | grep -i '^location:' | grep -oE 'client_id=[^&]*')
  printf '%-30s %s\n' "$h" "$cid"
done

# 2. Replay authorize with a substituted redirect_uri
probe_against() {
  local base="$1" uri="$2"
  local enc=$(printf '%s' "$uri" | sed 's|:|%3A|g; s|/|%2F|g')
  local u=$(printf '%s' "$base" | sed "s|redirect_uri=[^&]*|redirect_uri=$enc|")
  curl -sS -o /tmp/t.html -D /tmp/h.txt "$u" >/dev/null 2>&1
  local code=$(head -1 /tmp/h.txt | tr -d '\r' | awk '{print $2}')
  printf '  %-64s %s\n' "$uri" "$code"
}
BASE=$(curl -sS -o /dev/null -D - "https://visibleshelf.com/auth/login" 2>/dev/null \
  | grep -i '^location:' | sed 's/^[Ll]ocation: *//' | tr -d '\r')
probe_against "$BASE" "https://visibleshelf.com/auth/callback"                    # expect 302
probe_against "$BASE" "https://evil-probe.vercel.app/auth/callback"               # expect 403
probe_against "$BASE" "https://retail-visibility-platform-evil.vercel.app/auth/callback"  # expect 403
probe_against "$BASE" "https://totally-unrelated.example/auth/callback"           # expect 403 (control)
```

`302` = the redirect_uri is accepted (Auth0 proceeds to the login page).
`403 Callback URL mismatch` = rejected. **Always include the control row** — it proves the
method is sound. If the control returns `302`, the probe is meaningless.

Host-canonicalization check:

```bash
for u in https://visibleshelf.com/ https://www.visibleshelf.com/; do
  printf '%-32s -> ' "$u"; curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "$u"
done
# both should be 200 with no redirect_url
curl -sSI https://visibleshelf.com/seed-report/x | grep -i x-matched-path   # present = app served
```

**Side effects:** probing `/r/*` or `/rb/*` tracked redirects writes a `qr_scan_events` row.
Prefer `/seed-report/{seedId}` (no tracking) where it answers the question.

---

## 6. Code-level items worth tightening

| Item | Location | Risk |
|---|---|---|
| Identity cookies set `httpOnly: false` (`auth0_email`, `auth0_id`) with no explicit `secure`/`sameSite` | `apps/web/src/lib/auth0.ts` | Any XSS can read the user's email and Auth0 `sub`. Prefer an API route over a JS-readable cookie. |
| PII in production logs — `session.user.email`, `sub`, session keys logged on every login | `apps/web/src/lib/auth0.ts` (`onCallback`) | PII in log storage. |
| Email + role logged on every admin route check | `apps/web/src/proxy.ts` | Same. |
| `baseURL` inferred from request host (no explicit value) | `apps/web/src/lib/auth0.ts` | Every host that can serve login must be enumerated in Auth0's allowlist. Correct as designed, but the allowlist must be kept in step. |
| Auth0 config exists **only** in Vercel env vars — zero `AUTH0_*` in any `.env*` or `.vercel` | — | Cannot be reviewed in a PR or drift-checked. This doc is the compensating control. |
| `AUTH0_SECRET` must differ per environment | Vercel env vars | It is the session-cookie encryption key. If the two environments shared it, a session minted on one host could be replayed against the other. Rotating it **invalidates every existing session** — expected, and the reason to rotate if it is ever disclosed. `AUTH0_CLIENT_SECRET` is likewise a secret. |
| `Allow Cross-Origin Authentication` is **on** | Auth0 app settings | Not needed for a server-side redirect flow (it exists for embedded Lock / custom HTML with third-party cookies). Off removes surface. |

---

## 7. Outstanding

- [ ] **Dev keys** (§3c) — the largest remaining production item. Until fixed, login depends
      on credentials Auth0 shares with every other tenant.
- [ ] **Staging app rename** — `Visible Shelf` → `visible-shelf-staging`. The name is what
      caused the original wrong-application edit.
- [ ] **`Application Login URI` on both apps** still points at the branch alias rather than
      a login route. Should be `https://visibleshelf.com/auth/login` and
      `https://visibleshelf.store/auth/login` — a branch alias is a non-canonical host and
      would bounce users to a `vercel.app` hostname in the flows that use this field.
- [x] ~~Delete `Default App`~~ — done 2026-10-16; `/authorize` with its client ID now
      returns `Unknown client`.
- [ ] **Review** Auth0 Attack Protection (MFA, brute-force, suspicious-IP) — this app has
      `PLATFORM_ADMIN` / `SUPER_ADMIN` roles behind it — plus refresh-token rotation and
      session lifetime, since the flow requests `offline_access`.
- [ ] **Consider** a `docs/AUTH0_SETUP.md` rewrite; it has drifted (see the note in §2).

---

## 8. Change log

| Date | Change |
|---|---|
| 2026-10-16 | Audit. Found `*.vercel.app` + `retail-visibility-platform-*.vercel.app` in Allowed Callback URLs of both the production and staging applications — both verified accepted (`302`) for arbitrary hosts. Wildcards removed from both; re-verified `403 Callback URL mismatch` for arbitrary `vercel.app` hosts while legitimate callbacks stay `302`. |
| 2026-10-16 | Vercel: removed the `307` apex→`www` redirect on `visibleshelf.com`. Both hosts now serve `200`; `X-Matched-Path` confirms the app serves the apex. Canonical tags (apex) now match the serving host. |
| 2026-10-16 | Removed the bare origins from both applications' Callback fields (they were still accepted as callbacks, delivering `?code=` to the site root). Re-verified: `https://visibleshelf.com`, `https://www.visibleshelf.com` and `https://visibleshelf.store` now return `403 Callback URL mismatch`, while the real `/auth/callback` entries stay `302`. Production Callback now matches the §2 target state exactly. |
| 2026-10-16 | Replaced the stray production alias on staging with staging's **own** preview hosts, and added production's own branch alias. Allowlist work complete: no wildcards, no cross-environment hosts. Verified — all legitimate callbacks `302`; `retail-visibility-platform-web-paul-yarls-projects.vercel.app` now `403` against staging; arbitrary `vercel.app` `403` against both. |
| 2026-10-16 | Dropped the per-deployment `-<hash>-` hosts from both applications (single-build URLs that never match again). Verified `403` for both retired hashes; the `-git-<branch>-` aliases stay `302`. Each app is now exactly: two canonical hosts + its own branch alias, per field. |
| 2026-10-16 | Deleted `Default App` (`zjVeIs…`); `/authorize` now returns `Unknown client`. Confirmed the dev-keys warning appears on **both** the production and staging login pages — the Google connection is tenant-scoped and shared, so one fix covers both. |
| 2026-10-16 | Found the dev-keys warning on the production login page (§3c). Not yet fixed. |
