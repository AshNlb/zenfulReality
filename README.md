# Zenful Reality

An artist website for Ashley J. Phoenix: original paintings, free writing and a private publishing dashboard. React/Vite frontend; Express backend; SQLite and uploaded media stored together on a persistent volume. Google sign-in is restricted to one configured artist email. Stripe Checkout collects payment and EU shipping details.

## Local testing on your computer (Windows, macOS or Linux)

Install Node.js **24 LTS** from https://nodejs.org. Obtain this project's files, then open a terminal in the folder containing package.json:

```sh
npm ci
npm run local
```

Open `http://localhost:3100` in your own browser. This starts both servers bound to your computer's loopback interface. In the footer choose **Artist studio**, then **Enter local test studio**. Try uploading a painting, editing your bio, adding writing/chapters, selecting Published, and saving changes. Return to the public pages to see the result. Drafts stay private. Press Ctrl+C in the terminal to stop both servers.

This command does not read `.env`, disables Stripe and Google authentication even if keys are present in your shell, and uses a separate ignored `.local-test` folder for the database and uploads. It does not connect to Railway, Vercel or UltimateTaskManager. Test data persists between starts; remove `.local-test` only if you intentionally want to erase your local test content.

The gallery initially contains clearly labelled placeholders. Seed content is saved as drafts. Prices are DKK with optional approximate EUR display. Checkout is intentionally unavailable in this local preview. Payment-provider tests are a later, separate step using Stripe test mode.

Validation:

```sh
npm run build
npm test
```

Optional `.env` is only used with `npm run server`, not `npm run local`. Writing preserves plain-text paragraphs and supports separate chapters. Uploaded JPG/PNG/WebP files are limited to 10 MB.

## Deployment: separate from UltimateTaskManager

**Vercel:** create a new project from this repository, build command `npm run build`, output `dist`. Configure `API_ORIGIN` in build environment as the HTTPS Railway hostname, then use the documented generated Vercel configuration below. API/media must be forwarded through the same frontend origin for secure studio cookies. Keep your existing application's domain untouched; attach a separately purchased domain to this new project, and redirect its www/apex counterpart as desired.

**Railway:** create a separate service from this repository. Use Node 24; start `npm run server`; mount a persistent volume at `/data` and set `DATA_DIR=/data`, `NODE_ENV=production`, `SITE_URL=https://your-art-domain`. SQLite supports a single service replica only. Volume contents must be backed up; SQLite database and `/data/media` contain your content. Do not place them on ephemeral filesystem storage.

Generate a Vercel proxy config before deploying, replacing the hostname with your Railway service (no secrets):

```json
{"rewrites":[{"source":"/api/:path*","destination":"https://YOUR-RAILWAY-HOST/api/:path*"},{"source":"/media/:path*","destination":"https://YOUR-RAILWAY-HOST/media/:path*"}]}
```

Save as `vercel.json` in your deployment branch once the actual hostname is available. Public routes use hash navigation so no SPA catch-all is needed.

### Google artist sign-in

1. In Google Cloud create an OAuth client of type Web application, set up the consent screen, and add yourself as a test user while in testing.
2. Add the frontend origin (`http://localhost:3100` for development, and the HTTPS art domain for production) to Authorized JavaScript origins.
3. Set `GOOGLE_CLIENT_ID` on Railway and `ADMIN_EMAIL` to your Google email. No client secret is used for this ID-token flow.
4. Set `DEV_ADMIN=false`. Test that your account signs in and another account is rejected. Session cookies expire after eight hours and all sessions end on a server restart.

### Stripe account and testing

1. Create a Danish Stripe account and complete business/identity/bank-account verification in Stripe's secure dashboard.
2. Start in test mode. Put the test secret key in Railway's `STRIPE_SECRET_KEY`; never put it in frontend variables or source control.
3. Add a webhook endpoint at `https://YOUR-RAILWAY-HOST/api/stripe/webhook`, subscribe to `checkout.session.completed`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Enable successful-payment receipt emails in Stripe settings. Stripe receipts are payment confirmations, not a custom fulfilment email service. Manage shipments and communicate with buyers using the details in Stripe Dashboard. Dispatch/fulfilment automation is not included.
5. Set `SITE_URL` to the actual frontend URL. Checkout charges DKK, collects an email and EU shipping address, adds the editable flat shipping fee (initially 70 DKK), and reserves one original for 30 minutes. Signed paid webhooks mark it sold. EUR display uses the artist's manually editable approximate rate; payment remains DKK.
6. Test with Stripe test cards, including successful checkout, cancelled checkout, webhook delivery, repeated webhook delivery, and simultaneous purchase attempts. Only after these succeed should you replace test credentials with live credentials and configure the live webhook separately.

## Before launch

Add real paintings, portrait, biography, writing and Amazon link. Choose/register a domain; availability has not been checked. Add contact email, legal seller details, dispatch times, applicable EU returns/cancellation terms and privacy policy before enabling live sales. Current shipping page explicitly says these terms are pending. Footer and copyright page reserve copyright, subject to applicable legal exceptions; physical artwork purchase does not transfer reproduction rights. Readable text can still be saved by visitors.

Google sign-in and Stripe end-to-end checkout require your account configuration and were not validated with real providers. No deployment or purchase has been performed. Fonts are served from Google Fonts with system fallbacks; consider self-hosting them for launch. Homepage composition currently uses a labelled CSS artwork placeholder; replace it with real art in your collection.
