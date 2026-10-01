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
