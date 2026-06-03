# Find Leads Changes

## Current Safety Mode

- `scripts/test-find-leads.js` now runs offline by default using `fixtures/find-leads/phoenix-auto-detailers.json`.
- Offline mode does not call `/api/anthropic`, Anthropic web search, Twilio, Abstract, or external websites.
- Live Claude search now requires `ALLOW_CLAUDE_LIVE=1`.
- Live website/phone verification from the harness requires `LIVE_VERIFY=1`.
- `LEAD_QUALITY_ONLY=1` makes the harness skip Twilio/contact verification, judge contact by phone/email presence, soften source reachability, and report lead-quality accepts with `ALLOW_CLAUDE_LIVE=1 LIVE_VERIFY=1 LEAD_QUALITY_ONLY=1 BASE_URL=https://lead-qualifier-david-007ts-projects.vercel.app CITY='Phoenix, AZ' NICHE='auto detailers' COUNT=5 node scripts/test-find-leads.js`.
- `/api/anthropic` has an emergency kill switch: set `ANTHROPIC_DISABLED=1` to reject Anthropic calls server-side.
- `/api/anthropic` now logs and returns response headers for estimated token/search cost when Anthropic is enabled.
- Production currently has `ANTHROPIC_DISABLED=1` set in Vercel and deployment `dpl_95NecvSzh9s69aX4mpWdkQ98n7ck` confirmed `/api/anthropic` returns `anthropic_disabled`.

Safe command:

```sh
npm run test:find-leads:offline
```

Full offline regression suite:

```sh
npm run test:find-leads:offline:all
```

Live spend command, only when explicitly approved:

```sh
ALLOW_CLAUDE_LIVE=1 LIVE_VERIFY=1 BASE_URL=https://lead-qualifier-david-007ts-projects.vercel.app CITY='Phoenix, AZ' NICHE='auto detailers' COUNT=5 MIN_ACCEPTED=4 node scripts/test-find-leads.js
```

## Fix Map

- Source/proof URL verification lives in `api/website-check.js` and returns `sourceVerified`, `sourceStatus`, `sourcePhone`, and `sourceEmail`.
- Website checks now use browser-like headers, treat bot blocks/timeouts/TLS failures as `Unverified — could not confirm`, and avoid selling those rows.
- Guessed domains no longer create parked/broken proof. Parked/broken proof is only valid for provided URLs.
- Business page matching now needs stronger name/contact/locality evidence.
- Find Leads scoring rejects unreachable proof URLs, generic/social proof URLs, fake phones, unverified phone-only contacts, working websites, unverified website status, and outside-metro rows.
- Find Leads scoring rejects business names that look like the search query, such as `Mobile Detailing Phoenix`.
- Query-name rejection now covers general service patterns like `Nail Salon Los Angeles` and `HVAC Contractors Houston`, not only auto-detailing phrasing.
- Business-specific profile URLs like `yelp.com/biz/<slug>`, Facebook/Instagram handles, `google.com/maps/place/...`, `g.page/...`, and directory profile paths are now allowed as proof sources; search/listing URLs like `yelp.com/search` and `google.com/maps/search` still reject.
- Source matching now requires a distinctive business-name token or phone/locality evidence; generic category/location words like `mobile`, `detail`, `auto`, `az`, and city names cannot verify a source by themselves.
- The Phoenix metro list now includes El Mirage.
- The harness now asserts exact offline fixture expectations across Phoenix auto detailers, Los Angeles nail salons, and Houston HVAC contractors.

## Latest Offline Harness Output

`npm run test:find-leads:offline:all` currently passes all three fixture files. The Phoenix fixture output is:

```text
Accepted: 1/5

[PASS 1] A Zone Auto Glass Car Detailing & Front Door Services
Contact: (602) 492-8876 info@azoneautoglass.com
Address: El Mirage, AZ
Website: No website found
Source: https://citylocal101.com/12107-ceramic-coating-peoria-az

Rejected: 7

[FAIL 1] Phoenix Mobile Auto Detailing
Reasons: business name looks like the search query; missing verified phone or MX-valid email; proof source URL not reachable

[FAIL 2] Valley Mobile Details
Reasons: missing verified phone or MX-valid email

[FAIL 3] Mobile Detailing Phoenix
Reasons: business name looks like the search query; fabricated-looking phone; missing verified phone or MX-valid email; source URL is generic search results, not a business page; proof source URL not reachable

[FAIL 4] Sittin Pretty Auto Detailing
Reasons: fabricated-looking phone; missing verified phone or MX-valid email; working website found: https://sittinprettyautodetailing.com/; website status is not a verified webdev gap

[FAIL 5] Tucson Desert Detail
Reasons: outside requested metro Phoenix, AZ

[FAIL 6] Jiffy Lube Phoenix Detail Center
Reasons: business name looks like the search query; looks like a chain/franchise

[FAIL 7] Cloud Shield Detail
Reasons: website status is unverified; website status is not a verified webdev gap
```
