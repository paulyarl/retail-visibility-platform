# RVP Synthetics — Mirror & Precheck

This doc outlines simple HTTP checks (PowerShell/Bash) and k6 examples for hourly runs.

## Mirror (GBP Category)

PowerShell
```
$BASE="http://localhost:4000"
$TENANT="<tenant>"
Invoke-RestMethod -Uri "$BASE/tenant/$TENANT/gbp/category/mirror" -Method POST -ErrorAction Stop | Out-Null
```

Bash
```
BASE="http://localhost:4000" TENANT="<tenant>"
curl -s -X POST "$BASE/tenant/$TENANT/gbp/category/mirror" -f >/dev/null
```

## Mirror (GBP Hours)

PowerShell
```
Invoke-RestMethod -Uri "$BASE/tenant/$TENANT/gbp/hours/status" -Method GET -ErrorAction Stop | Out-Null
```

Bash
```
curl -s "$BASE/tenant/$TENANT/gbp/hours/status" -f >/dev/null
```

## Precheck (Feed Alignment)

PowerShell
```
Invoke-RestMethod -Uri "$BASE/api/$TENANT/feed/precheck" -Method POST -ErrorAction Stop | Out-Null
```

Bash
```
curl -s -X POST "$BASE/api/$TENANT/feed/precheck" -f >/dev/null
```

## k6 Example (mirror + precheck)

Create k6/mirror_precheck.js:
```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.05']
  }
};

const BASE = __ENV.BASE || 'http://localhost:4000';
const TENANT = __ENV.TENANT || '00000000-0000-0000-0000-000000000000';

export default function () {
  let r1 = http.post(`${BASE}/tenant/${TENANT}/gbp/category/mirror`);
  check(r1, { 'mirror 202/200': (r) => [200,202].includes(r.status) });

  let r2 = http.get(`${BASE}/tenant/${TENANT}/gbp/hours/status`);
  check(r2, { 'status 200': (r) => r.status === 200 });

  let r3 = http.post(`${BASE}/api/${TENANT}/feed/precheck`);
  check(r3, { 'precheck 200': (r) => r.status === 200 });

  sleep(1);
}
```

Run hourly via scheduler/CI:
```
k6 run -e BASE=http://localhost:4000 -e TENANT=<tenant> k6/mirror_precheck.js
```
