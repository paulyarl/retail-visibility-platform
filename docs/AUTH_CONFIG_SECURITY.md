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

**The Google Cloud project is shared — confirmed 2026-10-16.** It is the "Visible Shelf" project
(project number `407743626849`) and it already holds **two** OAuth clients:

> **Number corrected 2026-10-17.** This line previously read `487743626849` — a single-digit
> transposition. `407743626849` is confirmed three independent ways: the client-ID prefix
> (`407743626849-14md…`, and a client ID's prefix *is* its project number), `gcloud projects
> describe retail-visibility-platform --format='value(projectNumber)'` → `407743626849`
> (`lifecycle=ACTIVE`), and Google's own live error body, which names the billed consumer as
> `projects/407743626849` (`apps/api/fixtures/gbp/pending/01-accounts-quota.json`). The
> access-request form requires the exact number, so the transposition was not cosmetic.

| Client | Created | Type | Notes |
|---|---|---|---|
| `Visible Shelf - Business Profile` | 2025-11-03 | Web application | the ⚠️ (sensitive-scope `business.manage`) is cleared as of 2026-10-17 — the console's Project Checkup now reads *"Your app has been verified by Google"* |
| `Visible Shelf - Merchant Center` | 2025-10-22 | Web application | |

Because the **OAuth consent screen is per-project**, all clients in here share one screen —
including its branding and its publishing status.

**The screen is `In production`** — published 2026-10-16, and verified as of 2026-10-17 (Project
Checkup: *"Your app has been verified by Google"*). User type is `External`. It was previously
`Testing` with only 3 test users (`lupidanja@…`, `shelfvisible@…`, `yarlimoment@…`) and a 100-user
cap; neither applies now.

That has two consequences:

1. **Do not put the login client in this project.** In Testing, only listed test users can
   authorize — login would be restricted to those three accounts. A **separate Google Cloud
   project** for login is required: it needs only non-sensitive scopes (`openid`, `email`,
   `profile`), so it can be published to **In production** immediately with no cap and no
   verification, independent of this project's state.

   **Done 2026-10-16:** project `VisibleShelfLogin` (id `visibleshelflogin`) created, consent
   screen published to **In production**, user type `External`, client `Auth0 Login` (Web
   application) with the redirect URI below. Because the only scopes in play are non-sensitive,
   the user cap does **not** apply here.
2. **The same restriction gates Business Profile / Merchant Center onboarding — and it is
   currently biting.** Only those three accounts can authorize `business.manage`. Checked
   2026-10-16: `google_oauth_accounts_list` = **0** rows, `google_oauth_tokens_list` = **0**,
   `gbp_locations_list` = **0**, `google_merchant_links_list` = **0**. No merchant has ever
   connected, which is exactly why this has gone unnoticed — the first real merchant to click
   "Connect Google Business Profile" will be refused with an unverified/access-blocked error.

   **Partially unblocked 2026-10-16:** the project was **published to `In production`**, which lifts
   the Testing restriction — real merchants can now authorize, no longer limited to the three test
   users. Two things still stand, and they are easy to conflate:

   - **The Verification Center is authoritative, and it says nothing needs verifying.** Its Data
     access panel reads *"Verification is not required since your app is not requesting any
     sensitive or restricted scopes."* So the scopes in play are not classified as
     sensitive/restricted, and no "unverified app" screen should appear.
   - **Do not read the user cap counter as evidence.** The Audience page shows `3 users / 100 user
     cap`, which looks like a live limit — but Google's own text on that page says the counter is
     *displayed even for verified apps*, and the cap *"does not apply if you are requesting only
     approved sensitive or restricted scopes."* It is informational decoration, not proof of
     enforcement. This was mis-read once during the audit; the Verification Center is the signal.
   - **Branding verification is a separate check, and it is genuinely done** — *"Your branding has
     been verified and is being shown to users."* That approves the app name and logo.

   **Open question, cheap to settle:** have a merchant who is **not** a test user attempt a Google
   Business Profile connect and watch for an "unverified app" warning. Zero connections exist, so
   there is nothing to disturb. A clean connect closes this out.

   Google's wording on the Audience page is precise about the cap
   and worth keeping: *"The user cap limits the number of users that can grant permission to your
   app when requesting unapproved sensitive or restricted scopes… the user cap does not apply if
   you are requesting only approved sensitive or restricted scopes."* So the cap is scoped to
   requests that include an **unapproved** sensitive scope — which is why it binds here
   (`business.manage` unapproved) and would **not** bind a project asking only for `openid` /
   `email` / `profile`. The "unverified app" screen has the same trigger: the request includes a
   scope that hasn't been approved.

#### Gate B — GBP API project allowlisting (the gate that actually blocks the feature)

Everything above is **Gate A** — the OAuth consent screen. It is **passed**: the app is verified
and published to production, so merchants can authorize. It is *not* what returns
`503 api_not_approved`.

**Gate B is a separate allowlist on the Google Cloud project itself**, granted only by the
*Application for Basic API Access* form (`support.google.com/business/contact/api_default`, option
*Application for Basic API Access*). Until it lands, every Business Profile call returns
`429 RATE_LIMIT_EXCEEDED` with `quota_limit_value: '0'` — which can only happen *after* the token
was accepted (`401` would mean a bad token) and *after* the API was found enabled (`403
SERVICE_DISABLED` would mean it wasn't). `apps/api/src/routes/google-business-oauth.ts` maps that
shape to the user-facing `503 api_not_approved`.

**Status: APPROVED 2026-10-29, quota verified in console same-day.** Case ID
**`5-5364000041203`**, project `407743626849` — Google's approval email grants the default
**300 QPM** quota, landing ~a week ahead of the quoted 7–10 business-day window (~Nov 7–10).
Verified 2026-10-29 in console: `mybusinessaccountmanagement.googleapis.com` reads
**Requests per minute = 300**, and `mybusinessbusinessinformation.googleapis.com` reads
**Requests per minute = 300** plus per-day limits (Create Location 100/day,
SearchGoogleLocation 200/day, Update Location 10,000/day) — both Enabled, 0 usage. The
connect→list→link flow only needs these two, so `GET /api/google/business/locations` is the
smoke test: it should return locations instead of `503 api_not_approved`. One API still to
check in the Library: the legacy `mybusiness.googleapis.com` v4 surface
(reviews/posts/media/insights/verifications — the v1 "migration" only moved the
business-info slice; these were never replaced) is absent from console Library search but
appeared in `gcloud services list --available` — the documented approval tell — and was
**enabled via Cloud Shell `gcloud services enable mybusiness.googleapis.com` 2026-10-29**.
All three transport hosts are now enabled — connect→list→link (v1) and the Management Suite
surfaces (v4: posts/reviews/photos/hours guardian) are both unblocked.

History: first application **2026-10-17**, case `3-3112000041953` — rejected during review
(reported 2026-10-27) because the website URL on the request form did not match the URL in the
profile's website field. The reviewer's check is a literal comparison and the profile's website
field carries UTM params (`https://visibleshelf.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp`,
see `PLATFORM_GBP_GOOGLE_ADS_SPEC.md` §3.2). **Resubmission entered the full UTM'd URL
byte-identically on both sides**, verified the profile is 60+ days verified (Yes), and confirmed
no allowlisted project exists (No — that is the state being applied for); the resubmit cited the
prior case ID in the reason field. Do not file a quota-increase request — it auto-rejects, and
only one project per business can ever be granted access.

**Checking status** (there is no tracker on the form itself):

- Cloud Console → IAM & Admin → Quotas → filter `mybusinessaccountmanagement.googleapis.com`:
  `0` QPM = not approved, `300` QPM = approved. Direct link:
  `https://console.cloud.google.com/iam-admin/quotas?project=407743626849`.
- Programmatically:
  `GET https://cloudquotas.googleapis.com/v1/projects/407743626849/locations/global/services/mybusinessaccountmanagement.googleapis.com/quotaInfos`
  — needs `cloudquotas.googleapis.com` enabled on the project plus an `x-goog-user-project:
  407743626849` header (without it the call 403s on Cloud Shell's own default quota project). An
  unallocated / empty `quotaBuckets` entry is the same fact as `0`.
- The legacy `mybusiness.googleapis.com` API only becomes *visible* to an approved project, so its
  absence from `gcloud services list --available` is a second tell.

**Eligibility is the real long pole**, ahead of the ~7–10 day review: a verified GBP active 60+
days, owned by the applicant *or* a client they manage, with a website representing that business
on the profile, submitted from an email that is an owner/manager on that GBP, with the website
domain matching the email domain.

Full mechanics — the transport seam, fixture profiles, and the two-gate framing — live in
`AGENTS.md` under "GBP transport seam".

### 3c. Dev keys on the login connection — **RESOLVED 2026-10-16**

> **Fixed.** The `google-oauth2` connection now carries our own Google OAuth client from the
> dedicated `VisibleShelfLogin` project, and Auth0's dev-keys warning is **gone from both login
> pages** (verified externally: neither `visibleshelf.com/auth/login` nor
> `visibleshelf.store/auth/login` renders it, and `Continue with Google` still resolves on both).
> This unblocks MFA, SSO, federated logout, `prompt=none`, Redirect Actions, and Auth0 custom
> domains — all of which dev keys had broken (§"Why this is not cosmetic").
>
> Still to confirm by hand: an actual Google sign-in, and whether `users.auth0_id` moved for the
> three Google-linked accounts.

Historically, the production login page rendered Auth0's own warning:

> **Alerts — Dev Keys:** One or more of your connections are currently using Auth0
> development keys and should not be used in production.

and offers `Continue with Google` (`connection=google-oauth2`). So the login Google
connection runs on **Auth0's shared development keys**.

Canonical reference: [Test Social Connections with Auth0 Developer Keys](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/devkeys)
(the older `/docs/connections/social/devkeys` path that Auth0 renders in the banner redirects
there). There is also a step-by-step walkthrough for this exact migration:
[Google social connection → production keys](https://developer.auth0.com/resources/labs/authentication/google-social-connection-to-login#set-up-google-production-keys).

#### Google Cloud: do **not** add the Auth0 domain to "Authorized domains"

Google Cloud Console → Google Auth Platform → **Branding** has an **Authorized domains** list, and
its help text reads: *"When a domain is used on the consent screen or in an OAuth client's
configuration, it must be pre-registered here."* **That text is broader than the enforcement.**

- Authorized domains is for domains **we control** — Google requires you to be able to verify
  ownership of anything added, so Auth0's tenant domain could not be added even if wanted.
- What it actually gates: the **consent screen's own links** (application home page, privacy
  policy, terms of service) and JavaScript origins.
- The **redirect URI** is validated separately, per-client, against that client's own *Authorized
  redirect URIs* field — which is where `https://dev-jaiggvvi3zsttaoo.us.auth0.com/login/callback`
  goes. It does not belong in Authorized domains.

So `visibleshelf.com` / `visibleshelf.store` are the correct entries, and the login client's
redirect URI lives on the client. If Google ever disagreed it would reject the client save
immediately and by name — not silently later.

Confirmed at the source: the **Create OAuth client ID** screen says *"The domains of the URIs you
add below will be automatically added to your OAuth consent screen as authorized domains."*
Google adds the redirect URI's domain itself — which is why leaving this list alone is correct
rather than merely safe.

#### Leave "Use this client for an AI-powered agent" unchecked

The Create-client screen carries this checkbox. Per [Google's Manage OAuth Clients doc](https://support.google.com/cloud/answer/15549257#agentic-client)
it is a **self-declaration**, not a capability: *"Tagging an OAuth client does not grant additional
scopes or privileges to access user data."* It identifies the client as representing AI agents
acting on users' behalf.

Google's stated best practice is one client ID per workflow — a **standard** client for
human-driven interactive sessions, an **agentic** client used exclusively for AI agents,
automation, and MCP integrations. This client exists solely for a human login redirect brokered by
Auth0, so it is a standard client and must not carry the tag. The tag drives monitoring and admin
policy ("granular access and security policies to AI agents without impacting human user access"),
so mis-declaring a login client is a real problem even though no access changes.

**Also:** Google states the client secret *"will only be shown after you create the client"* and
*"will not be visible or accessible again."* Capture the Client ID and Secret — or download the
JSON — before leaving the creation screen, and put the secret straight into the Auth0 connection.

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

**One client, both environments — but a new Google Cloud project.** The connection is
tenant-scoped, so a single Google OAuth client covers production and staging; there is no
staging-specific variant to maintain (see [§1](#what-is-shared-across-environments-and-what-is-not)).
It must **not** live in the existing "Visible Shelf" project, because that project's consent
screen is in `Testing` and login would inherit the 3-test-user restriction — see §3b.

Two things that will bite if missed:

1. **Publish the OAuth consent screen to "In production", not "Testing".** While it is in
   Testing, only explicitly added test users can sign in — every other user is refused.
   The scopes in play here (`openid`, `email`, `profile`) are non-sensitive, so publishing
   needs no Google review.
2. **Existing Google-linked users do *not* need a re-link — verified.** The concern going in was
   that Google's `sub` (which becomes the Auth0 user ID `google-oauth2|<sub>`) is scoped to the
   OAuth client, so a new client ID would change it, Auth0 would see a *new* user, and the app
   would have to fall back to email matching.

   **It did not happen.** Tested 2026-10-16 with `yarlmoment@gmail.com` — a live
   `google-oauth2|…` account — signing in through the app on the new client:

   | | before | after |
   |---|---|---|
   | row | `uid-li9gr` | `uid-li9gr` (same) |
   | `auth0_id` | `google-oauth2\|101197082777619041667` | unchanged |
   | total `users` | 11 | 11 (no duplicate) |

   The `sub` held not just across a new client ID but across an entirely different Google Cloud
   project (Auth0's dev app → `VisibleShelfLogin`). So the identifier is stable per Google
   account, not per client — as Google's own wording implies ("unique among all Google
   accounts").

   The email fallback in `/api/auth/sync-user` (match `auth0_id` first, then email) remains the
   safety net if that ever changes, and it is why roles survive regardless: they live in the DB
   (`users.role`), not Auth0 `app_metadata`. Note the handler writes
   `auth0_id: user.auth0_id || auth0Id`, so a hypothetical future change would leave a *stale*
   `auth0_id` rather than updating it.

   Worth checking anyway if any Auth0 Actions read `app_metadata` — a genuinely new Auth0 user
   would not carry the old `app_metadata`.

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

- [x] ~~Dev keys (§3c)~~ — **done 2026-10-16.** The connection now uses our own Google OAuth
      client from the `VisibleShelfLogin` project; the warning is gone from both login pages
      (verified). MFA, SSO, federated logout, `prompt=none`, Redirect Actions, and Auth0 custom
      domains are all unblocked.
- [x] ~~Confirm a real Google sign-in works~~ — **done 2026-10-16.** Full app login succeeded with
      `yarlmoment@gmail.com`; the same `users` row was reused and `auth0_id` was **unchanged**
      (no re-link needed, no duplicate). See §3c.
- [ ] **Rotate `AUTH0_SECRET`** if it has been disclosed anywhere outside Vercel's env store
      — procedure in §6. Two distinct values, staging first. While dev keys remain in place,
      expect **visible re-prompts**; after §3c it becomes a silent bounce.
- [x] ~~Staging app rename~~ — done 2026-10-16. `Visible Shelf` → `visible-shelf-staging`, and
      production's `visible-shelf-production-admin-dashboard` → `visible-shelf-production`.
      Client IDs unchanged (verified).
- [x] ~~GBP / Merchant onboarding blocked by a `Testing` consent screen~~ — **published
      2026-10-16.** `In production` lifts the Testing restriction, so real merchants can authorize
      again. Verified: zero connections had ever been made (`google_oauth_accounts_list` = 0), so
      nothing was broken by it, only prevented.
- [ ] **Confirm GBP connect works for a non-test-user merchant** (§3b). The Verification Center
      says no scope verification is required, so the publish should have unblocked this outright —
      but the only way to be sure is a real connect from outside the test-user list. Watch for an
      "unverified app" warning.
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
- [ ] **Enable MFA — now unblocked.** MFA could not work on the Google connection while it used
      Auth0 dev keys (§3c); that is fixed, so this is now a normal hardening task. The tenant
      fronts `PLATFORM_ADMIN` / `SUPER_ADMIN`, so it is worth doing.
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
| 2026-10-16 | Corrected the GBP assessment. The Verification Center's Data access panel states *"Verification is not required since your app is not requesting any sensitive or restricted scopes"* — so publishing should have unblocked GBP onboarding outright, and no "unverified app" screen is expected. The `3 / 100` user-cap counter was initially mis-read as proof the cap was enforced; Google's own text on that page says the counter displays even for verified apps. Remaining unknown: a real non-test-user connect. |
| 2026-10-16 | Published the **`Visible Shelf`** project (the GBP/Merchant one) to `In production`, lifting the Testing restriction that had blocked real merchants from authorizing `business.manage`. Branding also verified. *(Initially recorded here that the `3 / 100` user cap still applied and that scope verification was the next step — **corrected in the entry above**, which was written after reading the Verification Center.)* |
| 2026-10-16 | **End-to-end login verified** after the dev-keys switch: signed in via the app with `yarlmoment@gmail.com` and confirmed in the DB that the same `users` row (`uid-li9gr`) was reused with an **unchanged** `auth0_id`, and no duplicate was created (11 users before and after). The anticipated Google `sub` change did not occur — the identifier is stable per Google account, not per OAuth client. §3c corrected accordingly. |
| 2026-10-16 | **Dev keys fixed.** Created a dedicated Google OAuth client in the new `VisibleShelfLogin` project (redirect URI `https://dev-jaiggvvi3zsttaoo.us.auth0.com/login/callback`, no sensitive scopes, consent screen published to In production), and saved the credentials into the tenant-scoped `google-oauth2` connection. Verified externally: the dev-keys warning is gone from **both** login pages and `Continue with Google` still resolves. The first client created had its secret exposed in a screenshot; it was deleted and recreated before being wired up, so nothing needed rotating. |
| 2026-10-16 | Created the login Google Cloud project `VisibleShelfLogin` (`visibleshelflogin`) with its own consent screen, published to **In production**. Recorded the exact redirect URI to register (`https://dev-jaiggvvi3zsttaoo.us.auth0.com/login/callback`, quoted from Auth0's dev-keys doc) and the two facts that resolve earlier open questions: Google auto-adds a redirect URI's domain to Authorized domains, and the 100-user cap only binds requests containing an *unapproved* sensitive scope — so it does not apply to this login project. |
| 2026-10-16 | Found the "Visible Shelf" Google Cloud project's consent screen is in **`Testing`** with 3 test users, shared by the Business Profile and Merchant Center clients. Two consequences recorded: the login client must go in a **separate project** (it would otherwise be limited to those 3 accounts), and GBP/Merchant onboarding is **latently blocked** for real merchants — confirmed zero rows in `google_oauth_accounts_list`, `google_oauth_tokens_list`, `gbp_locations_list`, and `google_merchant_links_list`. |
| 2026-10-16 | Added §1 "What is shared across environments, and what is not" — the tenant-vs-application-vs-env-var scope model, plus the rule that **one** Google OAuth client covers both environments (a second one would mean a second connection, maintained in two places). Added a suggested fix order to §7, with dev keys first because it is a prerequisite for MFA and it makes the secret rotation silent. |
| 2026-10-16 | Read Auth0's dev-keys documentation and recorded the real impact in §3c: with Universal Login, dev keys break **MFA**, SSO, federated logout, `prompt=none`/`checkSession()`, Redirect Actions, and Auth0 custom domains. Corrected the §6 `AUTH0_SECRET` rotation note — with dev keys there is no SSO cookie on the tenant domain, so that rotation produces visible re-prompts rather than a silent bounce. MFA is now tracked as **blocked on this fix** in §7. |
| 2026-10-16 | Deleted `Default App` (`zjVeIs…`); `/authorize` now returns `Unknown client`. Confirmed the dev-keys warning appears on **both** the production and staging login pages — the Google connection is tenant-scoped and shared, so one fix covers both. |
| 2026-10-16 | Found the dev-keys warning on the production login page (§3c). Not yet fixed. |
