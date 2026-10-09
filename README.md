# Ghost Growth Creative Operations

Next.js app for the Ghost Growth brief → production → review → delivery workflow. The dashboard can run in **preview mode** with browser saved sample jobs or **server mode** with Google sign-in and PostgreSQL.

## What works

- Pipeline, filtering, campaign/review/delivery views, job detail and type-specific brief fields.
- Manual brief creation, deterministic variants, assignment, due dates, review links and controlled status transitions.
- Server mode: Google sign-in limited to configured users, role and client checks, globally sequential database job numbers, audit events, outbox events and Postgres persistence.
- Client and user setup for admins, Motion inbound event capture, Make outbox polling and signed callback endpoints.
- Approved asset manifests with protocol naming and a delivery gate that requires every Drive item receipt plus a media buyer Slack DM receipt.

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

The protocol's bracketed upload patterns and examples disagree on duplicated `OPENENTRY`, `FUNNELSTAGE`, and one `SKS-` prefix. The naming module follows the explicit examples. Confirm those exceptions before enabling automated delivery. The provided screenshots were not available, so the visual design is an independent implementation.

## Operations expansion — October 8, 2026

- **Planning:** weekly/fortnightly client cycles, job and variant targets, format mix, internal approval/release owners and maker capacity. Actuals use confirmed delivery dates; workload uses estimated hours for open jobs due before the next seven-day boundary, including overdue jobs. Targets and capacities start unset.
- **Intake:** Motion plus normalized Tally, Slack and Notion requests, repeated offers/attachments, duplicate suggestions and dismissal history. A transaction claims each inbound event once before a strategist creates its job.
- **QA & blockers:** six pre-review checks, priority, effort estimate, blockers with owner/follow-up, revision reason/link/return date, and a separate external client approval URL. Revision transitions reset the checklist.
- **Attention:** open jobs with blockers, due dates reached, or overdue revision return dates.
- **Launches:** delivered variants can be recorded by platform/account as Not launched, Scheduled, Live, Paused or Needs retest. Scheduled and live states require their dates/links. Learning notes carry into a linked iteration brief. Launching never changes production status or marks a job Delivered.
- **Activity:** latest 100 scoped server audit entries. Preview explicitly has no shared audit history.
- Dark mode remains permanent. Production statuses and protocol filenames are unchanged.

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
6. Confirm the documented protocol naming exceptions before live automated delivery.

Performance notes are manual in this release. Automatic ad-platform metrics, asset-rights expiry and a bulk historical Notion migration remain future work. The additional data routes have passed type/build checks; live database transactions and provider transfers must be acceptance-tested after credentials are configured.
