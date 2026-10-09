# Ghost Growth Creative Operations

Next.js app for the Ghost Growth brief → production → review → delivery workflow. The dashboard can run in **preview mode** with browser saved sample jobs or **server mode** with Google sign-in and PostgreSQL.

## What works

- Pipeline, filtering, campaign/review/delivery views, job detail and type-specific brief fields.
- Manual brief creation, deterministic variants, assignment, due dates, review links and controlled status transitions.
- Server mode: Google sign-in limited to configured users, role and client checks, globally sequential database job numbers, audit events, outbox events and Postgres persistence.
- Client and user setup for admins, Motion inbound event capture, Make outbox polling and signed callback endpoints.
- Approved tracked asset manifests with enforced SCOPE_TYPE_descriptor_aspect_vNN naming and a delivery gate that requires every Drive item receipt plus a media buyer Slack DM receipt.

## Run preview

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. With `NEXT_PUBLIC_DATA_MODE` unset, this is a browser-only preview. Do not use it for real production records or delivery.

## Set up server mode

1. Provision PostgreSQL, preferably through the Prisma Postgres Vercel integration. Copy `.env.example` to `.env.local` and set `DATABASE_URL`.
2. Set `AUTH_SECRET`, Google OAuth client ID and secret, and `AUTH_ALLOWED_DOMAINS`. Configure the OAuth callback URL as `https://YOUR_DOMAIN/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local testing).
3. Run `npm run db:migrate`. Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_NAME`, then run `npm run db:bootstrap`. The email must match a Google account on the allowed domain.
4. Set `NEXT_PUBLIC_DATA_MODE=server`, restart, sign in, and use Settings to add team members and clients. Map QA users, the media buyer Slack user ID, and each client's Drive root folder.
5. Add the same variables to the Vercel project, apply migrations to its production database, and deploy with the Next.js framework preset.

Only `NEXT_PUBLIC_DATA_MODE` is client visible. Keep all secrets in server environment variables. The app must be rebuilt after switching data mode.

## Integration contract

The app owns records and rules; Make performs external orchestration through a signed relay. `GET /api/integrations/outbox` returns pending events to Make with `Authorization: Bearer INTEGRATION_TOKEN`. Make sends signed HMAC-SHA256 callbacks to `/api/webhooks/make` and `/api/delivery/:batchId/receipt` using `MAKE_WEBHOOK_SECRET`; the signature header is `x-make-signature` or `x-integration-signature`, respectively, with `sha256=<hex>`. The app deduplicates receipts by event ID.

For `delivery.ready`, Make or a dedicated worker retrieves each approved source asset, creates the ad set folder under the configured Google Drive root, uploads each item with the manifest filename, verifies the Drive file, and sends one `drive.item_verified` receipt per item. After the app emits `delivery.drive_verified`, Make sends a Slack DM to `mediaBuyerSlackId` with the Drive link and sends `slack.dm_confirmed`. Only then does the app set Delivered. Large transfers should run in a durable worker rather than a Vercel request.

Motion events currently enter a signed **import inbox** via `/api/webhooks/motion`. They do not create a live job until a strategist checks the client mapping and brief. If Motion does not support the specified signature format, send the event through a Make relay that signs the app payload. Figma and Frame.io review links work now; automatic export needs those service credentials and access to approved asset IDs.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The user superseded the original Post Production Protocol filenames with `SCOPE_TYPE_descriptor_aspect_vNN` on October 8. New manifests use the new convention. Legacy naming functions/tests remain only to document historical records.

## Operations expansion — October 8, 2026

- **Planning:** weekly/fortnightly client cycles, job and variant targets, format mix, internal approval/release owners and maker capacity. Actuals use confirmed delivery dates; workload uses estimated hours for open jobs due before the next seven-day boundary, including overdue jobs. Targets and capacities start unset.
- **Intake:** Motion plus normalized Tally, Slack and Notion requests, repeated offers/attachments, duplicate suggestions and dismissal history. A transaction claims each inbound event once before a strategist creates its job.
- **QA & blockers:** six pre-review checks, priority, effort estimate, blockers with owner/follow-up, revision reason/link/return date, and a separate external client approval URL. Revision transitions reset the checklist.
- **Attention:** open jobs with blockers, due dates reached, or overdue revision return dates.
- **Launches:** delivered variants can be recorded by platform/account as Not launched, Scheduled, Live, Paused or Needs retest. Scheduled and live states require their dates/links. Learning notes carry into a linked iteration brief. Launching never changes production status or marks a job Delivered.
- **Activity:** latest 100 scoped server audit entries. Preview explicitly has no shared audit history.
- Dark mode remains permanent. Production statuses are unchanged. See the later assurance release for the replacement filename convention.

### Upgrade

Run `npm run db:migrate` against the connected PostgreSQL database before enabling server mode with this release. Migration `20261008_operations` adds optional operations metadata, client plans, maker capacities, intake disposition and launch records; it preserves existing jobs and delivery records. The UI still runs without a database in preview mode. No live integrations or existing Notion records are enabled/imported by deploying this code.

### New endpoints

| Endpoint | Purpose | Access |
| --- | --- | --- |
| GET/POST/PATCH `/api/operations/plans` | Read plans/team, save client plan, save maker capacity | Admin/strategist |
| GET/PATCH `/api/operations/intake` | Queue/history, dismiss or mark duplicate with reason | Admin/strategist |
| PATCH `/api/jobs/:id/operations` | Save readiness, blocker, revision and evidence details | Admin/strategist, assigned maker, client QA; locked after approval |
| GET/POST `/api/operations/launches` | Read scoped launches; save platform/account launch record | Write: admin/strategist/assigned client media buyer |
| GET `/api/operations/activity` | Latest scoped audit entries | Signed-in users, role filtered |
| POST `/api/webhooks/intake/:provider` | Normalized inbound `tally`, `slack` or `notion` event | HMAC `x-make-signature` with `MAKE_WEBHOOK_SECRET` |

Normalized intake body (Make maps source fields; sign the exact JSON bytes with HMAC-SHA256):

```json
{
  "id": "stable-source-submission-id",
  "title": "Autumn creative request",
  "client": "Configured client name",
  "sourceUrl": "https://example.com/original-request",
  "brief": {"objective": "Explain the approved offer"},
  "offers": [{"name": "Offer one", "price": "$10", "url": "https://example.com/offer"}],
  "attachments": [{"name": "Approved reference", "url": "https://example.com/reference"}]
}
```

Keep source IDs stable across retries. Requests create inbox candidates, never approved or delivered jobs. Slack intake should be an explicitly selected request or workflow, not indiscriminate DM ingestion. Notion migration uses this same intake contract and retains the original page URL. Existing Uploaded/Live labels are not proof of delivery; verify Drive and Slack receipts before moving any imported job to Delivered.

Make should handle `job.blocked` (reason/owner/follow-up) and the enriched `review.changes_required` event (feedback URL, return date, assignee Slack ID), alongside existing events. Approval/release owner emails are routing information; they do not grant permissions or replace the configured client QA/media-buyer mappings. Deadline reminders require a separate scheduled Make scenario; saving a date alone does not send reminders.

### Remaining live setup

1. Connect PostgreSQL and apply both migrations; bootstrap the admin.
2. Configure Google sign-in for `ghostgrowth.io` and the actual deployment domain, then rebuild with `NEXT_PUBLIC_DATA_MODE=server`.
3. Add real team members, Slack IDs, client QA and media-buyer mappings, and Drive root folders in Settings.
4. Set agreed client targets/capacities and owners in Planning.
5. Connect Make's intake/outbox/delivery scenarios and Figma/Frame.io/Drive/Slack accounts; run one complete test job.
6. Confirm client rules and QA coverage, register current asset revisions, and test the replacement filename convention before live automated delivery.

Performance notes are manual in this release. Automatic ad-platform metrics, asset-rights expiry and a bulk historical Notion migration remain future work. The additional data routes have passed type/build checks; live database transactions and provider transfers must be acceptance-tested after credentials are configured.


## Assurance release — October 8, 2026

### Validated scope and operating limits

The user confirmed that **SCOPE_TYPE_descriptor_aspect_vNN replaces the final-delivery convention**, and **Senth confirms QA routing and the gap assessment**. All other reported gaps remain evidence to assess. The public preview includes generic demo reviewers; it does not publish private Slack content, inferred client assignments or historical workload counts.

The app has no active connection to figma-copy-qa, the Replit QA tool, an AI QA agent or ad-platform launch controls. Its text engine checks exact phrases against a supplied transcript; it does not inspect image/video pixels, run OCR or guarantee legal/platform compliance. Human reviewers must verify the full asset against current source policies. Draft GLP-1 checks are inactive examples, not verified policy rules. Required wording, disclaimer placement and publisher constraints must be confirmed per client.

### Working controls

- **Quality & rules → Client rules:** source-linked client guideline and brief-template references, versioned required/forbidden phrases and human checks. Confirmation needs a guideline source and at least one active check. New jobs snapshot the current policy; release checks use the current version.
- **QA coverage:** named primary and backup, availability, primary/backup route counts, open reviews and a concentration flag. New Internal Review handoffs select an available primary, otherwise the explicit backup; they block when neither is usable. Senth must confirm route changes. Existing queued handoffs are not retroactively rerouted.
- **Gap validation:** Reported, Confirmed, Covered or Not applicable, with owner, evidence and notes. Only Senth may confirm an assessment in server mode. Nothing is marked confirmed from memory alone.
- **Onboarding:** account/role, client access, Slack mapping, notification test, rules/naming training and an end-to-end test job. This records verification; it does not grant external access or send invites.
- **Assets & results:** immutable increasing variant versions, exact brief URL and revision, source asset ID/link, full copy/transcript and revision reason. QA results include reviewer, date, source evidence and client rule version.
- **Release gate:** approval, delivery manifest creation, and recording Scheduled/Live launches require current QA for the latest tracked revisions. Pausing remains possible when rules change. This gates the Creative OS record; it cannot prevent a media buyer from publishing directly in an ad platform.
- **Naming:** uppercase scope/type, lowercase hyphenated descriptor, `9x16`-style aspect, two-or-more-digit version and allowed extension. Example: `GG_VIDEO_job500-a_9x16_v01.mp4`. Scope and descriptor are configurable. Default descriptors include the job number and variant to avoid collisions. The manifest selects tracked assets and does not accept manual filename overrides. Completed legacy manifests remain unchanged.
- **Performance:** per-asset, per-account/ad snapshots with date window, source URL, currency, conversion definition/attribution context and learning. Missing values are `null`, never silently zero. No aggregate is calculated across overlapping snapshots. Learning can create a linked iteration brief.
- **Integration stability:** stable state keys, versioned event envelopes, optional five-minute outbox claims, idempotency keys and lease-aware receipts. Make must still deduplicate external side effects; an app lease alone does not guarantee exactly-once Slack delivery.

### Upgrade and endpoints

Apply `20261009_assurance` after earlier migrations, then deploy. Keep existing `AssetVersion` rows: new metadata is additive. Legacy assets need the new traceability/QA records before a new manifest can be generated; this release does not backfill historical files. `ROUTING_APPROVER_EMAIL` defaults to `senth@ghostgrowth.io`. Team roles and sign-in remain enforced separately.

| Endpoint | Contract |
| --- | --- |
| GET/POST `/api/assurance/clients` | Scoped read; strategist/admin saves source-linked client rules with `expectedVersion`. Senth confirms routing. |
| GET/PATCH `/api/assurance/team` | Strategist/admin team availability and onboarding verification. |
| GET/POST `/api/assurance/gaps` | Strategist/admin assessment records; Senth validates conclusions. |
| GET/POST/PATCH `/api/jobs/:id/assets` | Read scoped revisions; maker/strategist registers; client QA/strategist records QA with evidence. |
| GET/POST `/api/assurance/metrics` | Scoped asset results; strategist/client media buyer writes source-backed snapshots. |
| POST `/api/webhooks/performance` | Make-signed normalized Motion/Runneth snapshot; explicit tracked asset mapping required. |
| GET `/api/integrations/status-map` | Bearer-token authenticated stable status keys and current labels. Map keys to Notion option IDs, not names. |
| POST `/api/integrations/outbox` | Claim up to 25 events for five minutes; returns `schemaVersion`, `leaseToken`, `idempotencyKey`. |
| POST `/api/webhooks/make` | Signed success/failure receipt. Claimed work requires the matching unexpired lease token; success requires `receiptId`. |
| POST `/api/delivery/:batchId/manifest` | `{ "assetIds": ["tracked-asset-id"] }`, exactly one current QA-reviewed revision per variant. |

The `delivery.ready` event's `items` now include the actual delivery item `id`, `assetVersionId`, generated `finalName`, `sourceUrl`, source asset ID, brief revision/reference and `versionFolder` (`v01`, etc.). **Update the Make manifest mapping before enabling new deliveries.** Historical manifests already queued retain their existing event payload.

Normalized performance payload:

```json
{
  "assetId": "exact-tracked-asset-id",
  "externalId": "stable-report-row-id",
  "provider": "motion",
  "account": "ad-account-id",
  "adId": "platform-ad-id",
  "sourceUrl": "https://example.com/report",
  "periodStart": "2026-10-01",
  "periodEnd": "2026-10-08",
  "currency": "USD",
  "spend": 100,
  "impressions": 10000,
  "clicks": 150,
  "conversions": null,
  "revenue": null,
  "conversionDefinition": "Purchases, 7-day click; unavailable in source",
  "learning": "Collect conversion data before deciding on the next iteration."
}
```

Provider plus external ID is immutable and idempotent. Use a new external ID for a corrected snapshot, and explain the correction in learning notes. The webhook does not fetch Motion or Runneth itself; configure an authorized Make export/relay. No automatic Notion state import can approve or deliver a job.
