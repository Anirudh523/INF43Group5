# FindMe Friends Test Plan

Last updated: 2026-06-01 15:26:16

## Part 1 - Strategic Test Plan

This document follows `HW4_ Testing.pdf` and the updated team test plan. The plan is intentionally broader than the tests we can fully automate in the current prototype.

### 1.1 Scope

In scope:

| Area | Why this matters |
| --- | --- |
| Registration, mocked email verification, and mocked ID upload/verification | Users should be created uniquely, verify email in the prototype flow, provide required demographic filter data, upload a document, and remain gated by the verification flow. |
| Login/authentication | Protects user data; wrong passwords and suspicious attempts are high-risk paths. |
| Location sharing and nearby discovery | Core app purpose; users need to see nearby public people without leaking private/blocked users. |
| User profiles and settings | Bio, visibility, demographic profile fields, filters, range, dark mode, and notification settings drive map/profile behavior. |
| Interest/age/gender/sexuality filters | Users should see people and activities matching their preferences. |
| Friend requests and accepted friends | Friends should be people explicitly invited and accepted, not every nearby/system user. |
| Direct messages and report/block | Safety-sensitive feature; blocked users should not continue chatting or appearing in discovery. |
| Group activities | Joining, leaving, capacity, member lists, and firm map coordinates are central prototype behaviors. |
| Mobile prototype logic | Current UI controls for activity filtering, friend display/blocking, chat send-state, and bio limits should have lightweight unit coverage. |

Out of scope:

| Area | Why excluded |
| --- | --- |
| O(1) nearby search | The prototype intentionally uses a simple in-memory scan; algorithmic optimization is future work. |
| Google Maps location accuracy | We call Google Maps/Places APIs but do not test Google's own location quality. |
| Real identity-verification accuracy | A third-party vendor would verify documents in production; this prototype tests only upload/gating behavior. |
| Push notifications to devices | Device notification delivery depends on OS permissions and is not implemented. |
| Scalability/load | Important later, but this HW4 snapshot prioritizes unit and integration minimums. |
| Browser/system compatibility matrix | Time constrained; local web/Expo behavior is the primary supported target. |
| Payment system | Not part of the current app scope. |
| SQL persistence | Current persistence is local JSON + in-memory maps; SQL tests should be added after migration. |

### 1.2 Quality Goals

- Users can register, submit a mock ID, and receive understandable errors for invalid uploads.
- Registration requires age, gender, and sexuality so discovery filters operate on real profile data.
- The signup flow includes a mocked email verification step before account creation.
- Login rejects wrong passwords and locks accounts after repeated suspicious failures.
- Protected endpoints reject requests without a valid bearer token.
- Location/discovery never shows private profiles or blocked users.
- Profile updates persist and moderation rejects external links/prohibited content.
- Activity creation stores real coordinates; activity lists show time, place, distance, capacity, and joined members.
- Activity capacity cannot be exceeded; sole-member leave deletes the activity.
- Friend requests must be sent, accepted, or declined before someone appears in the Friends tab.
- Chat messages persist during the running server process and report/block prevents further messaging.
- Settings store active age, gender, and sexuality filter selections for the current UI pattern.
- Frontend logic prevents sending empty/blocked-chat messages and enforces the 350-word bio limit.

### 1.3 Risks and Priorities

| Area | Why it is risky / costly | Priority |
| --- | --- | --- |
| Duplicate registration data | Duplicate usernames/emails corrupt identity and login assumptions. | H |
| ID verification bypass | Safety violation; unverified users should not be treated as trusted. | H |
| Wrong password handling | Authentication bugs expose private user data. | H |
| Private or blocked users appearing on map | Direct privacy/safety failure. | H |
| Activity status/capacity drift | Users may show up to full or stale events. | H |
| Profile/settings not persisting | Users lose privacy/filter preferences after session changes. | H |
| Friends tab showing non-friends | Breaks product semantics and privacy expectations around accepted connections. | H |
| Message/block ordering | Reported users might continue contacting someone. | M |
| Multi-toggle demographic filter state | UI logic can create impossible settings combinations. | M |
| Location updates delay | Annoying but partly dependent on external Maps/location APIs. | L |
| Map marker detail UI | Useful but lower risk than privacy/auth correctness. | L |

### 1.4 Strategy

Unit test: a focused test for one small piece of logic in isolation, such as store helpers, password hashing, or frontend filtering helpers.

Integration test: a test that exercises multiple components together, such as HTTP routes plus the local data store and auth/session behavior.

| Component | Test types | Framework | Why this fit |
| --- | --- | --- | --- |
| Node.js backend store/auth | Unit | Node built-in `node:test` + `assert` | No extra install required and directly tests current helper functions. |
| Express API | Integration | Node built-in `node:test`, `fetch`, in-process HTTP server | Exercises real request/response behavior, auth tokens, and local persistence state. |
| Mobile prototype logic | Unit | Node built-in `node:test` over JS utility helpers | Lightweight coverage for UI decisions without adding React Native test dependencies. |
| React Native screens | Planned component tests | React Native Testing Library + Jest | Still the best fit, but not installed in this prototype snapshot. |
| SQL database | Planned integration tests | Future test DB + Jest/Node tests | Current data layer is not SQL yet. |
| WebSocket chat | Not applicable currently | Future WebSocket client/server tests | Prototype chat currently uses HTTP GET/POST, not WebSockets. |
| Cross-cutting load | Planned system tests | Future k6 | Useful after the API stabilizes and O(N) nearby search becomes a real bottleneck. |

### 1.5 Environment and Assumptions

- Local environment: Windows PowerShell.
- Node runtime: available local Node; the earlier prototype runtime was Node `v24.15.0` per the project notes/test plan.
- Backend tests isolate data with `FINDME_DATA_FILE` temporary JSON files.
- External APIs are not called in automated tests. Google Maps/Places and ID verification are treated as mocked/external.
- Test data is generated fresh per run by `seedDemoData()` plus per-test setup.
- CI is not configured yet; commands below are local and copy-pasteable.
- No Git commit hash is available because this workspace is not a Git repository.

### 1.6 Team Roles

| Member | Owns which test categories / components |
| --- | --- |
| Anirudh Ravishankar | Test plan strategy, backend unit test planning, risk/prioritization analysis, and run command documentation. |
| Daniel Tan | Frontend logic test planning, coverage report snapshot, test results summary, and gap analysis. |
| Keya Negandhi | Requirements-to-test traceability, registration/profile/settings test cases, documentation review, and test plan editing. |
| Makani Melendrez | Discovery, activities, friends, and chat workflow test cases, manual QA notes, and documentation review. |
| Jungmin Han | Prototype implementation, backend API integration tests, backend unit tests, and final test execution/coverage updates. |

## Part 2 - Tests Implemented and Report

### 2.1 Required Minimums

Last updated: 2026-06-01 15:26:16  

| Category | Local timestamp | Required minimum | Current count |
| --- | --- | ---: | ---: |
| Unit tests | 2026-06-01 15:26:16 | 5 | 20 |
| Integration tests | 2026-06-01 15:26:16 | 3 | 15 |

### 2.3 Tests by Category

Last updated: 2026-06-01 15:26:16  

| Category | Local timestamp | Count | Examples |
| --- | --- | ---: | --- |
| Backend unit | 2026-06-01 15:26:16 | 12 | `haversineKm` returns zero for identical coordinates and a realistic UCI-area distance; `publicUserFields` exposes only safe public fields and excludes private account internals; `matchesFilters` rejects users outside age and sexuality filters and accepts matching gender filters; `hashPassword`/`verifyPassword` accepts the original password while rejecting wrong passwords and legacy plaintext mismatches. |
| Backend integration | 2026-06-01 15:26:16 | 15 | Registration rejects duplicate user IDs/emails and invalid demographics; mock ID verification rejects too-short uploads and approves plausible uploads; repeated wrong-password login attempts lock the account; nearby discovery hides private/blocked users; friend requests can be sent, accepted, declined, and then reflected in the Friends endpoint. |
| Frontend logic unit | 2026-06-01 15:26:16 | 8 | `wordCount` handles blank/multi-space bios and enforces the 350-word limit; activity filtering searches title/interest/location text; activity sorting puts known distances before unknown distances and applies minimum capacity; chat send-state rejects empty messages and blocked/error conversations while friend display sorting pushes blocked people lower. |

Failed tests in this snapshot: none.

### 2.4 Where Tests Live and How To Run Them (Replace YOUR_DIRECTORY and YOUR_IP_ADDRESS)

Test files:

prototype/server/tests/store.test.js
prototype/server/tests/api.integration.test.js
prototype/mobile/tests/prototypeLogic.test.mjs

Run backend tests from `prototype/server`. On Windows PowerShell, use `npm.cmd`; on macOS/Linux, use `npm`.

```powershell
cd YOUR_DIRECTORY\prototype\server
npm.cmd install
npm.cmd test
npm.cmd run coverage:unit
npm.cmd run coverage:integration
node --experimental-test-coverage --test "tests/*.test.js"
```

Run frontend logic tests from `prototype/mobile`. The project uses Expo SDK 54 from local dependencies, so no global Expo install is required.

```powershell
cd YOUR_DIRECTORY\prototype\mobile
npm.cmd install
npm.cmd test
npm.cmd run coverage
npm.cmd run typecheck
```

Approximate runtimes:

| Category | Local timestamp | Runtime | Where it runs |
| --- | --- | --- | --- |
| Backend unit | 2026-06-01 15:26:16 | ~0.17 sec coverage run | Local Windows PowerShell |
| Backend integration | 2026-06-01 15:26:16 | ~1.4 sec full backend coverage run | Local Windows PowerShell |
| Frontend logic unit | 2026-06-01 15:26:16 | ~0.07 sec coverage run | Local Windows PowerShell |

### 2.4.1 How to run the actual prototype

Use two terminal windows. Start the API server first, then start the Expo app. Replace `YOUR_DIRECTORY`, `YOUR_IP_ADDRESS`, and `YOUR_GOOGLE_MAPS_API_KEY` with local values. On Windows PowerShell, use `npm.cmd`; on macOS/Linux, use `npm` and `export NAME="value"` for environment variables.

NOTE: To get the full functionality of the prototype that was achieved, your Google cloud API key should have these features enabled:
Geocoding API
Maps JavaScript API
Maps SDK for Android
Maps SDK for iOS
Maps Static API
Places API

If you are not able to acquire/use a free-trial version of the Google cloud API key, please contact:
jungmih1@uci.edu
for a temporary access to the API key that we used in testing. (our API key will not published on the Git repo)

Terminal 1: API server

```powershell
cd YOUR_DIRECTORY\prototype\server
npm.cmd install
npm.cmd start
```

Case 1: Run through Expo Go (Requires phone):

```powershell
cd YOUR_DIRECTORY\prototype\mobile
npm.cmd install
$env:EXPO_PUBLIC_API_URL="http://YOUR_IP_ADDRESS:3000"
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
npm.cmd start
```

Use the QR code printed in PowerShell to access the Expo Go project.

Case 2: Run through web browser:

```powershell
cd YOUR_DIRECTORY\prototype\mobile
npm.cmd install
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
npm.cmd run web -- --port 8083
```

Open `http://localhost:8083` in a browser.

### 2.4.2 macOS/Linux command equivalents

On macOS/Linux, use forward slashes in paths and `export` for environment variables instead of PowerShell's `$env:` syntax. The npm scripts are the same, but use `npm` instead of `npm.cmd`.

Run tests:

```bash
cd YOUR_DIRECTORY/prototype/server
npm install
npm test
npm run coverage:unit
npm run coverage:integration
node --experimental-test-coverage --test "tests/*.test.js"

cd ../mobile
npm install
npm test
npm run coverage
npm run typecheck
```

Run the prototype:

```bash
# Terminal 1: API server
cd YOUR_DIRECTORY/prototype/server
npm install
npm start
```

```bash
# Terminal 2: Expo Go on a phone
cd YOUR_DIRECTORY/prototype/mobile
npm install
export EXPO_PUBLIC_API_URL="http://YOUR_IP_ADDRESS:3000"
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
npm start
```

```bash
# Terminal 2: web browser
cd YOUR_DIRECTORY/prototype/mobile
npm install
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
npm run web -- --port 8083
```

Open `http://localhost:8083` for web. For Expo Go, scan the QR code. If testing on a physical phone, `YOUR_IP_ADDRESS` must be the computer's LAN IP address, not `localhost`.

### 2.5 Coverage Achieved

Last updated: 2026-06-01 15:26:16  

| Test type | Local timestamp | Tool | Coverage |
| --- | --- | --- | --- |
| Backend unit | 2026-06-01 15:26:16 | `npm.cmd run coverage:unit` | All files: 85.25% line, 47.14% branch, 61.54% function. `auth.js`: 94.87% line; `store.js`: 84.28% line. |
| Backend integration | 2026-06-01 15:26:16 | `npm.cmd run coverage:integration` | Custom V8 summary: 70.14% line, 90.91% function across `app.js`, `auth.js`, `store.js`. |
| Backend combined | 2026-06-01 15:26:16 | `node --experimental-test-coverage --test "tests/*.test.js"` | All files: 87.99% line, 54.68% branch, 90.79% function. |
| Frontend logic unit | 2026-06-01 15:26:16 | `npm.cmd run coverage` | `prototypeLogic.mjs`: 89.74% line, 90.00% branch, 100.00% function. |

Coverage HTML snapshot: `coverage/index.html`.

Not covered yet:

- Full React Native component rendering, because Jest/React Native Testing Library is not installed.
- Real ID vendor document accuracy, because verification is intentionally mocked.
- SQL/database migration behavior, because the app still uses local JSON/in-memory maps.
- Load/concurrency behavior, including the known O(N) nearby scan and possible simultaneous activity join race.

### 2.6 Plan-vs-Implementation Gap

The prototype is feature-complete for the current course/demo scope. The remaining gaps are mostly automation depth or production hardening gaps, not missing end-user prototype flows.

| Plan area | Current prototype status | Remaining gap / next step |
| --- | --- | --- |
| SQL persistence | Not implemented by design: the prototype uses local JSON-backed Maps with temp-file isolation in tests. | If production SQL is required, migrate the Maps into tables such as `users`, `friend_requests`, `activities`, `messages`, and `reports`, then add SQL integration tests. |
| External services | Mocked or manually configured: mock email verification is local UI state, mock ID verification is backend-tested, and Google Maps/Places calls are configured with API keys but not used in automated tests. | Use mocked service adapters for deterministic automated tests; production would need real email delivery, an ID-verification vendor, and locked-down Google API keys. |
| Real-time chat / push notifications | Not part of the current prototype: chat uses tested HTTP endpoints. Push notifications are not implemented. | Add WebSocket/push tests if those production features are implemented. |
| Load/concurrency/system testing | Not shipped. | Add k6/load tests and transactional activity-capacity/friend-request race tests after moving beyond local JSON persistence. |

## Part 3 - Reflection

The tests caught several bugs/issues that were easy to miss while simply clicking through our prototype. First, the old integration tests were stale: they assumed tokenless protected endpoints, even though the prototype was now updated to use bearer tokens. Rewriting them forced the test environment to log in like the real app and confirmed that location, profile, settings, activities, friend requests, and chat all reject unauthenticated access. 

The latest tests also helped realize completion-level behavior. Registration now rejects missing/invalid demographic fields so that age/gender/sexuality filters have real data, and the Friends tab now depends on accepted friend requests rather than listing every user. The activity tests verify two important map/activity fixes: created activities must store firm coordinates, and sole-member leave should delete the activity. 

The hardest area to test was the frontend, because the current Expo project does not include Jest or React Native Testing Library. I added deterministic frontend logic tests instead, but that’s still not a full replacement for rendering screens, confirming visuals, and pressing buttons. 

The next tests I would add are component tests for Friends, Discover, Activities, and Register: they should verify that friend request buttons change state, incoming requests can be accepted/declined, blocked-chat banners dismiss, Google location selection sets coordinates, mock email verification gates account creation, and mock ID upload moves through pending/approved states. 

Codex (Claude code was locked behind a paywall) helped translate the homework/test-plan requirements into concrete and labeled test categories and coverage documentation. The main limitation is that it relied on backend coverage. The frontend might still need proper React Native test tools for ideal results.
