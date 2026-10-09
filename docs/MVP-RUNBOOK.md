# Creative OS MVP — setup and recovery

## Release status

The application implements shared, role-scoped operations when server mode is enabled. A deployment without server mode is a browser-local preview, not a production team workspace. A successful Vercel build alone does not verify Google sign-in or provider delivery.

### MVP journey

1. Strategist converts a Motion/Tally/Slack/Notion intake or enters a manual brief. Duplicate intake conversion is blocked. Required template fields are validated in the API.
2. App assigns a global sequential number and deterministic variants. Strategist assigns the maker and a manual due date.
3. Maker produces the creative. Each immutable asset revision records its variant, current brief revision, source ID/link, transcript and generated filename.
4. Maker finishes the pre-review checklist. Internal Review sends a DM task to the confirmed available primary QA reviewer, otherwise the named backup. No available reviewer blocks the handoff.
5. QA records current source-linked client checks before Client Review. Visual checks remain human reviewed. Review feedback stays in Figma/Frame.io.
6. Changes Required returns the job to production and clears asset QA, the pre-review checklist and old approval evidence. Editing a brief creates a revision, preserves history in the audit trail and requires assets registered against that revision.
7. Strategist records external client approval. Approval and the delivery manifest are created together. All variants must be QA-reviewed and the client must have a Drive folder and media buyer Slack mapping. Missing configuration leaves the job in Client Review with an actionable error.
8. Make retrieves approved assets and places them in `client root / Job-N / vNN / SCOPE_TYPE_descriptor_aspect_vNN.ext`. The job folder prevents filenames colliding between jobs. Provider downloads need permission to the exact approved source version; if export is unavailable, supply an accessible final export and keep the source link.
9. The worker confirms each exact filename, nonzero file size and Drive file ID. When every item is verified, the app queues the media buyer DM. Only a matching recipient receipt completes Delivered.
10. The buyer records launch and exact-asset performance. Unknown conversions/revenue remain unknown. Learning can seed a linked iteration brief.

## Production setup

### 1. Database

The requested `@supabase/supabase-js` and `@supabase/ssr` packages are installed at compatible versions. They require Node 22 or later (Vercel uses Node 24). Installing them does not provision a Supabase project. The MVP continues to use server-side Prisma for transactional data and Google/NextAuth for sign-in. Supabase Postgres is compatible with that stack: https://supabase.com/docs/guides/database/prisma


Use a dedicated PostgreSQL database. For Supabase, prefer an isolated Creative OS project; do not put these tables in a shared public API schema without configuring its data API exposure/RLS. This app accesses PostgreSQL on the server using Prisma; browser users do not receive database credentials.

Set `DATABASE_URL` in Vercel production with SSL and suitable connection pooling. Use a direct/session connection for migrations if the provider's transaction pooler does not support migrations. Apply all migrations in filename order with `npm run db:migrate` from a trusted environment configured for that database. Do not run `db push` or reset a production database. Back up an existing database before upgrades.

Bootstrap the first admin with `BOOTSTRAP_ADMIN_EMAIL=senth@ghostgrowth.io`, `BOOTSTRAP_ADMIN_NAME=Senth`, then `npm run db:bootstrap`. The script is repeatable but intentionally grants the specified account ADMIN; restrict its execution.

### 2. Google sign-in

In your Google Cloud project, configure an OAuth web application for the Creative OS. Use your organization's consent configuration and authorized users as appropriate. Add the callback URL:

`https://ad-creative-pipeline-nine.vercel.app/api/auth/callback/google`

If a custom domain becomes canonical, add its callback as well. Put the client ID and secret directly into Vercel as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`; never commit them or paste them into chat. Set a random `AUTH_SECRET`. Set `AUTH_ALLOWED_DOMAINS=ghostgrowth.io` and register allowed staff in Settings. Both a verified Google email and a pre-registered user are required. Add additional staff domains explicitly if contractors use other addresses.

Only after the database, migrations, bootstrap and OAuth configuration are ready, set `NEXT_PUBLIC_DATA_MODE=server` and redeploy. Preview deployments should use isolated test credentials and a test database; do not copy production secrets into arbitrary branch deployments.

### 3. Client and team configuration

In Settings add or update team members with roles and Slack user IDs. Configure each client's code, Drive root folder ID and media buyer. Existing client delivery mappings can be edited. In Quality & rules, Senth confirms distinct primary and backup QA reviewers; configure source-linked client rules and confirm only applicable active checks. Draft GLP-1 examples are not approved policies. Record onboarding verification per user.

### 4. Make worker contract (version 2)

Use encrypted `INTEGRATION_TOKEN` for authorization and `MAKE_WEBHOOK_SECRET` for receipt signatures. They must match the production app. Use a Make data store to reconcile each event ID and provider result before repeating a side effect. Keep secrets in protected connections/variables, never in a public scenario export or source repository.

- Claim: `POST /api/integrations/outbox`, header `Authorization: Bearer <INTEGRATION_TOKEN>`. A claim lasts five minutes and includes `id`, `leaseToken`, `idempotencyKey`, type and payload. Process fewer than five minutes of work per claim; after expiration reclaim and reconcile prior results before continuing. Unknown event types must fail visibly, not be marked delivered.
- Notifications: use `assigneeSlackId`, `qaSlackIds`, or the event's intended owner. Open a DM before sending. Save the Slack message receipt under the event ID. Do not route on display names or status labels.
- `delivery.ready`: payload includes immutable delivery item IDs, tracked asset IDs, source URLs/IDs, exact final names, job folder, version folders, client Drive root and pinned media buyer Slack ID. Use provider APIs to retrieve assets. Reject arbitrary/private-network URLs; use authorized provider download URLs. Reconcile Drive files by delivery item ID (for example Drive appProperties), not filename alone. Confirm permissions, folder, filename and nonzero size from Drive metadata before reporting success.
- POST each file receipt to `/api/delivery/:batchId/receipt`, header `x-integration-signature: sha256=<HMAC-SHA256 of exact raw JSON body>`.

```json
{"id":"stable-provider-event-id","type":"drive.item_verified","itemId":"manifest-item-id","driveFileId":"verified-file-id","finalName":"GG_STATIC_job1-a_1x1_v01.png","bytes":1024,"driveFolderId":"job-folder-id","checksum":"provider-checksum-if-available"}
```

`driveFolderId` is the common job folder; the files may be in its version subfolders. Verify their ancestry under the configured client root in the worker. The app trusts signed provider evidence; it does not independently call Drive.

- `delivery.drive_verified`: send the supplied Drive URL in a DM to **mediaBuyerSlackId**. Return:

```json
{"id":"stable-slack-event-id","type":"slack.dm_confirmed","receiptId":"channel:timestamp","recipientSlackId":"actual-slack-user-id"}
```

- For transfer failures, return `{ "id":"unique-failure-id", "type":"delivery.failed", "message":"Actionable provider error" }` to the delivery receipt endpoint.
- Acknowledge claimed work at `POST /api/webhooks/make`, header `x-make-signature`, HMAC over exact raw JSON. Success: `{ "id":"unique-ack-id", "type":"notification.sent", "outboxEventId":"event-id", "leaseToken":"claim-token", "receiptId":"provider-receipt-or-manifest-confirmation" }`. Failure: use `notification.failed` and an actionable `message`.
- An acknowledgement marks only the outbox task complete. Delivery is completed exclusively by verified file and intended-recipient receipts. Never acknowledge an upload event successfully before all uploads and receipt calls succeed.
- `job.approved`, `job.created`, `job.transition`, `review.changes_required`, `job.blocked`, `job.assigned`, `review.internal.ready`, `review.client.ready` and `job.delivered` are notification/audit events. Configure explicit handling and recipients. `job.approved` is not a second upload trigger; `delivery.ready` starts transfer.
- Failed events stop automatic claiming after ten attempts. Settings → Workspace readiness shows failures and allows retry with the original event ID. Delivery → Retry delivery can recover transfer/handoff failures even if an earlier worker acknowledgement was sent. Existing verified files and receipts are retained.

### 5. Intake and performance

Normalize Tally/Slack/Notion submissions into the documented intake schema and sign `POST /api/webhooks/intake/:provider` using `x-make-signature`. Preserve offers, attachments and source URLs. Intake imports do not directly approve jobs. Motion has its separate signed ingress (`MOTION_WEBHOOK_SECRET`).

Relay normalized Motion/Runneth snapshots to `/api/webhooks/performance`. Required identity: exact asset ID, provider, stable external result ID, account, ad ID and reporting period. Include source URL and conversion definition. Use `null` for unavailable measures. Identical retries are accepted; changed data under the same external ID is rejected. Corrections need a new snapshot ID and an explanatory learning note.

### 6. Cutover and acceptance

Keep existing Notion notification and Tally intake scenarios running until a separately configured Creative OS test passes. Choose one source of notifications per job during cutover. Do not enable two notification paths for the same status transition. Import historical data separately; the MVP does not automatically migrate Notion history.

Run one approved test creative through real Figma/Frame.io retrieval, Drive upload and the assigned test media buyer DM. Confirm that the real files open, have the exact names, and the correct buyer received the DM. This real-provider acceptance is mandatory before claiming the production pipeline works.

## Verification and boundaries

`npm test` runs domain and receipt validation tests. `npm run typecheck` and `npm run build` verify the release. `npm run test:acceptance` exercises actual authenticated API routes against an isolated local PostgreSQL database named `ghost_mvp_test`; the suite refuses remote/production database URLs. Start the app on port 3100 with matching test secrets and `NEXT_PUBLIC_DATA_MODE=server`, migrate the test database, then run the suite. It generates short-lived signed test sessions locally; no authentication bypass is shipped in the application.

The database suite covers intake deduplication, required brief fields, role checks, QA fallback, brief revision invalidation, client approval, automatic manifests, concurrent file receipts, recipient validation, retry recovery, launch records and performance idempotency. Provider receipts are simulated; no external files or messages are created by the test.

AI suggestions are optional future work. OCR, automated visual compliance, external QA agents and direct ad-platform publishing are not in this MVP. Figma/Frame.io export limitations remain provider-specific. QA routing totals inferred from Slack remain unconfirmed until Senth records the mappings.
