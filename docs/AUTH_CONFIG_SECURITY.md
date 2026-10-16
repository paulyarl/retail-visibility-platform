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

Two applications exist. **Match on Client ID, not name** — before the 2026-10-16 rename the
staging application was called "Visible Shelf" and the production one
`visible-shelf-production-admin-dashboard`, which sent an edit into the wrong application.
The names now match the environments; the habit is still worth keeping.

| Auth0 app name | Client ID | Type | Serves | Notes |
|---|---|---|---|---|
| `visible-shelf-production` | `Nv81D3lvTPiLmeQd75UW669rbriUTFgR` | Regular Web App | `visibleshelf.com`, `www.visibleshelf.com`, `retail-visibility-platform-web-git-main-paul-yarls-projects.vercel.app` | **production** |
| `visible-shelf-staging` | `qa3lsBavdX2uIZ5lSElylPvwF58Dzs8C` | Regular Web App | `visibleshelf.store`, `www.visibleshelf.store`, `retail-visibility-platform-web-git-staging-paul-yarls-projects.vercel.app` | **staging** |

Renaming an application does **not** change its Client ID — verified after the rename:
`visibleshelf.com` still resolves to `Nv81…`, `visibleshelf.store` still to `qa3ls…`.

How each was identified: request `/auth/login` on the host and read the `client_id` in
the redirect to the tenant's `/authorize`. See §5.

`visibleshelf.store` / `www.visibleshelf.store` are **staging** domains per the Vercel
project — that is what identifies the staging application, not its name.

### What is shared across environments, and what is not

The most useful thing to know before making any change here — it decides whether you edit once
or twice.

| Config | Scope | Editing it affects |
|---|---|---|
| Auth0 **tenant** — domain, connections (including the Google credentials), Actions/Rules, branding, Attack Protection, custom domains | shared | **both environments** |
| Auth0 **application** — Allowed Callback / Logout / Web Origins, `Application Login URI`, app Client ID/Secret | per-application | **one environment** — two apps exist |
| Vercel env vars — `AUTH0_CLIENT_ID`, `AUTH0_SECRET` | per-environment | **one environment** — distinct values required |
| Google OAuth client for **login** | shared, via the connection | **both environments** — one client is enough |
| Google OAuth client for **GBP / Merchant Center** | platform-owned, environment-independent | both — and not part of this tenant's config at all (§3b) |

Consequences worth remembering:

- **The dev-keys fix is a single edit.** The credentials live on the tenant-scoped connection, so
  pasting them once clears the warning on both login pages. Do **not** create a second Google
  client for staging — that means a second connection and a fix maintained in two places. (If
  isolated quota or separate auth events are ever wanted, that *is* the deliberate shape: a
  second connection enabled only on the staging app. Not worth the overhead today.)
- **The allowlists and `Application Login URI` are two edits** — they live on the applications,
  and production and staging are different applications.
- **`AUTH0_SECRET` must be two *distinct* values.** One shared value would let a session minted
  on one host be replayed against the other.
- **The Node runtime deprecation warning is one check**, not two — Actions/Rules are tenant-scoped
  and not attached per application.

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
connection runs on **Auth0's shared development keys**.

Canonical reference: [Test Social Connections with Auth0 Developer Keys](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/devkeys)
(the older `/docs/connections/social/devkeys` path that Auth0 renders in the banner redirects
there). There is also a step-by-step walkthrough for this exact migration:
[Google social connection → production keys](https://developer.auth0.com/resources/labs/authentication/google-social-connection-to-login#set-up-google-production-keys).

#### Why this is not cosmetic

With Universal Login — which this tenant uses — dev keys break the following outright:

| Broken with dev keys | Why |
|---|---|
| **MFA** | On MFA success Auth0 POSTs to `https://YOUR_AUTH0_DOMAIN/mf`, but with dev keys the session is established on a tenant-agnostic endpoint, so `/mf` finds no session and errors. **MFA cannot be enabled for this connection until the keys are replaced.** |
| **SSO** | The dev-key Google app calls back to `https://login.auth0.com/login/callback` instead of this tenant's `/login/callback`, so **no SSO cookie is set on the tenant domain**. Every authentication re-runs the provider flow. |
| **Federated logout** | `/v2/logout?federated` signs out of Auth0 but not out of Google. |
| **`prompt=none` / `checkSession()`** | Unsupported on `/authorize` with dev keys. |
| **Redirect Actions** | A redirect Action resumes on `https://YOUR_AUTH0_DOMAIN/continue`, which cannot find the session established on the generic endpoint. |
| **Auth0 custom domains** | Dev keys cannot be used with a custom domain at all — so an `auth.visibleshelf.com`-style domain is blocked until this is fixed. |

Plus the softer ones: the consent screen shows **"Auth0"** rather than Visible Shelf, the quota
is shared with every other tenant using dev keys (so it can throttle or break through no fault
of ours), and Auth0 can rotate or disable them without notice.

**MFA is the one to weigh.** This tenant fronts `PLATFORM_ADMIN` / `SUPER_ADMIN`, and MFA is
simply unavailable on the Google connection until dev keys are replaced — so treat this as a
**prerequisite** for that hardening, not a tidiness item. See §7.

**Confirmed 2026-10-16:** both the production *and* staging login pages render this warning,
because Auth0 connections are tenant-scoped — the Google connection is shared across both
applications. **Fixing the connection fixes both at once.**

**Where the fix lives — not in the application.** The credentials are on the *connection*,
which is tenant-level. Path: **Authentication → Social → `google-oauth2`** (click the name,
not the toggle). From an application's **Connections** tab, the `google-oauth2` link goes to
the same page — but that tab only controls *which* connections the app may use.

On that connection's **Settings** tab the dev-keys state is explicit: a yellow banner reading
"This connection is using Auth0 development keys…", and **Client ID** / **Client Secret**
fields sitting empty with the placeholder *"Leave blank to use Auth0 dev keys"*. Filling those
two fields is the entire fix. The **Setup Guide** button in the header and the *"How to obtain
a Client ID?"* link under the field walk through the Google Cloud side and give the exact
callback URL to register — **copy it from there rather than typing it**.

The connection's **Applications** tab confirms the shared scope: both
`visible-shelf-production` and `visible-shelf-staging` are attached to this one connection.

**Fix:** create a Google OAuth 2.0 client in Google Cloud Console, register
`https://dev-jaiggvvi3zsttaoo.us.auth0.com/login/callback` as an Authorized redirect URI,
then put that client ID + secret into Auth0 → Authentication → Social → Google.

Note the callback changes with the switch, and that is the whole point: **dev keys** route
Google back to the tenant-agnostic `https://login.auth0.com/login/callback`; **your own keys**
route it to *this tenant's* `/login/callback`. That is why SSO starts working once the keys
are yours.

**One client, both environments.** The connection is tenant-scoped, so a single Google OAuth
client covers production and staging — see [§1](#what-is-shared-across-environments-and-what-is-not).
There is no staging-specific variant to maintain.

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

## 6. Code-level items and secret handling

| Item | Location | Risk |
|---|---|---|
| Identity cookies set `httpOnly: false` (`auth0_email`, `auth0_id`) with no explicit `secure`/`sameSite` | `apps/web/src/lib/auth0.ts` | Any XSS can read the user's email and Auth0 `sub`. Prefer an API route over a JS-readable cookie. |
| PII in production logs — `session.user.email`, `sub`, session keys logged on every login | `apps/web/src/lib/auth0.ts` (`onCallback`) | PII in log storage. |
| Email + role logged on every admin route check | `apps/web/src/proxy.ts` | Same. |
| `baseURL` inferred from request host (no explicit value) | `apps/web/src/lib/auth0.ts` | Every host that can serve login must be enumerated in Auth0's allowlist. Correct as designed, but the allowlist must be kept in step. |
| Auth0 config exists **only** in Vercel env vars — zero `AUTH0_*` in any `.env*` or `.vercel` | — | Cannot be reviewed in a PR or drift-checked. This doc is the compensating control. |
| `AUTH0_SECRET` must differ per environment | Vercel env vars | It is the session-cookie encryption key. If the two environments shared it, a session minted on one host could be replayed against the other. Rotating it **invalidates every existing session** — expected, and the reason to rotate if it is ever disclosed. `AUTH0_CLIENT_SECRET` is likewise a secret. See [Rotating `AUTH0_SECRET`](#rotating-auth0_secret) below. |
| `Allow Cross-Origin Authentication` is **on** | Auth0 app settings | Not needed for a server-side redirect flow (it exists for embedded Lock / custom HTML with third-party cookies). Off removes surface. |

### Rotating `AUTH0_SECRET`

`AUTH0_SECRET` is the key the SDK encrypts the session cookie with. `auth0.ts` passes a single
`secret` — there is no keyring — so rotation is a **hard cutover**: there is no window in which
old and new cookies both decrypt.

**1. Generate a new value, separately per environment.** 32 bytes, hex-encoded (64 characters):

```bash
openssl rand -hex 32
```

Never reuse one value across production and staging — distinct keys are what stop a session
minted on one host from being replayed against the other.

**2. Set it in Vercel.** Project → Settings → Environment Variables → `AUTH0_SECRET`, in the
scope that environment deploys from (Production for prod, the staging scope for staging).

**3. Redeploy.** Vercel does not retroactively inject a changed env var into a running
deployment; the value is only picked up by a new build. An env edit with no redeploy will look
like it did nothing.

**4. Expect a mass logout — and expect it to be visible.** Existing cookies fail to decrypt, the
SDK clears them, and every request is treated as unauthenticated. How loud that is depends on
whether the dev-keys problem in §3c has been fixed:

- **Today, with dev keys:** no SSO cookie is set on the tenant domain (§3c), so there is no
  Auth0-side session to resume from — every user re-runs the Google flow. Often silent when
  they still hold a Google session in the browser, but expect visible re-prompts.
- **Once §3c is fixed:** Auth0 holds a real session on the tenant domain and most users bounce
  `/auth/login` → Auth0 → back with no interaction at all.

Either way it self-resolves. Watch the logs briefly for cookie-decrypt noise.

**Roll staging first.** It exercises the full path — generate, set, redeploy, sign in — against
a small audience before production. Do it as its own change rather than bundled with a feature
deploy, so any fallout is attributable.

**It is one-way.** Restoring the previous secret would not bring the old sessions back — those
cookies are already gone — it would only invalidate the new ones. Don't flip back and forth.

**What rotation does *not* fix.** The `auth0_email` / `auth0_id` cookies are plaintext and are
not keyed by this secret (see the table above), and Auth0-side sessions are untouched. If a
disclosure is about those identity cookies rather than the session key, rotation is not the
whole answer.

**Verify:** sign in, navigate a few pages, and confirm the session persists across requests —
that proves the new key encrypts and decrypts consistently. `/settings/admin` unauthenticated
should redirect cleanly to `/auth/login?returnTo=…` rather than erroring.

---

## 7. Outstanding

**Suggested order.** Do **dev keys first** — it is a prerequisite for MFA (§3c) and it also makes
the `AUTH0_SECRET` rotation quiet, because SSO only works once the keys are yours. Then the
rotation, then the per-application tidy-ups.

1. **Dev keys** — unblocks MFA and SSO. One edit, both environments.
2. **Rotate `AUTH0_SECRET`** — two distinct values, staging first. Silent once (1) is done.
3. **`Application Login URI`** — two edits, two minutes.
4. **Node runtime banner** — one tenant-level check.
5. **Code items** (§6) — separate follow-up, not blocking.

---

- [ ] **Dev keys** (§3c) — **the highest-value item.** Until it is fixed: MFA is unavailable on
      the Google connection, SSO does not work, federated logout and `prompt=none` fail, and the
      tenant cannot adopt an Auth0 custom domain. One edit covers both environments.
- [ ] **Rotate `AUTH0_SECRET`** if it has been disclosed anywhere outside Vercel's env store
      — procedure in §6. Two distinct values, staging first. While dev keys remain in place,
      expect **visible re-prompts**; after §3c it becomes a silent bounce.
- [x] ~~Staging app rename~~ — done 2026-10-16. `Visible Shelf` → `visible-shelf-staging`, and
      production's `visible-shelf-production-admin-dashboard` → `visible-shelf-production`.
      Client IDs unchanged (verified).
- [ ] **Check the Node 12/16 runtime deprecation banner** on the tenant. Auth0 warns that
      tenants with a deprecated runtime configured in advanced settings now run on Node 22,
      which can break Custom Databases, Custom Social Connections, and legacy Rules/Hooks.
      Nothing in this repo is a custom database or social connection, so the exposure is
      Auth0 Actions/Rules — check whether any exist and exercise them.
- [ ] **`Application Login URI` on both apps** still points at the branch alias rather than
      a login route. Should be `https://visibleshelf.com/auth/login` and
      `https://visibleshelf.store/auth/login` — a branch alias is a non-canonical host and
      would bounce users to a `vercel.app` hostname in the flows that use this field.
- [x] ~~Delete `Default App`~~ — done 2026-10-16; `/authorize` with its client ID now
      returns `Unknown client`.
- [ ] **Review** Auth0 Attack Protection (brute-force, suspicious-IP) plus refresh-token
      rotation and session lifetime, since the flow requests `offline_access`.
- [ ] **MFA — blocked on the dev-keys fix.** MFA cannot work on the Google connection while it
      uses Auth0 dev keys (§3c). Since this tenant fronts `PLATFORM_ADMIN` / `SUPER_ADMIN`,
      replacing the keys is a prerequisite for enabling MFA, not a parallel task.
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
| 2026-10-16 | Renamed the applications to match their environments: `Visible Shelf` → `visible-shelf-staging`, `visible-shelf-production-admin-dashboard` → `visible-shelf-production`. Verified the rename left Client IDs untouched (`visibleshelf.com` → `Nv81…`, `visibleshelf.store` → `qa3ls…`). |
| 2026-10-16 | Confirmed the dev-keys state at its source: the `google-oauth2` connection's Settings tab shows the warning banner and empty Client ID/Secret with the "Leave blank to use Auth0 dev keys" placeholder, and its Applications tab shows both apps attached to the one connection. |
| 2026-10-16 | Added §1 "What is shared across environments, and what is not" — the tenant-vs-application-vs-env-var scope model, plus the rule that **one** Google OAuth client covers both environments (a second one would mean a second connection, maintained in two places). Added a suggested fix order to §7, with dev keys first because it is a prerequisite for MFA and it makes the secret rotation silent. |
| 2026-10-16 | Read Auth0's dev-keys documentation and recorded the real impact in §3c: with Universal Login, dev keys break **MFA**, SSO, federated logout, `prompt=none`/`checkSession()`, Redirect Actions, and Auth0 custom domains. Corrected the §6 `AUTH0_SECRET` rotation note — with dev keys there is no SSO cookie on the tenant domain, so that rotation produces visible re-prompts rather than a silent bounce. MFA is now tracked as **blocked on this fix** in §7. |
| 2026-10-16 | Deleted `Default App` (`zjVeIs…`); `/authorize` now returns `Unknown client`. Confirmed the dev-keys warning appears on **both** the production and staging login pages — the Google connection is tenant-scoped and shared, so one fix covers both. |
| 2026-10-16 | Found the dev-keys warning on the production login page (§3c). Not yet fixed. |
