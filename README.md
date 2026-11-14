# Frontend

Separate Next.js App Router storefront for the Express backend in ../Ecommerce.
The homepage, signup, login, and code-based password recovery are implemented.

## Stack
Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide,
TanStack Query, React Hook Form, Zod, and the native Fetch API.

## Local development
1. Run npm install (PowerShell users can use npm.cmd).
2. Copy .env.example to .env.local if it does not exist.
3. Start the backend in ../Ecommerce with npm start (port 3000).
4. Run npm run dev here and open http://localhost:3001.

## Commands
- npm run dev: development server on port 3001
- npm run build: production build
- npm start: production server on port 3001
- npm run lint: ESLint
- npm run typecheck: TypeScript checks

## Structure
- src/app: pages, layouts, and global styles
- src/components/ui: shadcn components
- src/components/providers.tsx: isolated TanStack Query provider
- src/lib/api.ts: typed fetch helper and API errors
- src/lib/utils.ts: styling utilities
- components.json: shadcn CLI configuration

Use apiFetch<ResponseType>("/product") for public API calls.
For authenticated calls, pass { token } explicitly. The backend must use
BEARER_KEY="Bearer ". Do not add secrets to NEXT_PUBLIC variables.
apiFetch accepts JSON bodies, FormData uploads, and AbortSignal.

React Hook Form, Zod, and @hookform/resolvers are installed for future forms.
No fake product data or checkout is included. Auth forms call the existing Express signup/login endpoints through Next.js route handlers.

## Vercel
Push this folder to its own Git repository and import it as a separate Vercel
project. Use the detected Next.js preset and leave the root directory as ".".
Set NEXT_PUBLIC_API_BASE_URL to the deployed Express backend HTTPS URL in the
appropriate Vercel environments, then deploy. Changing this value requires a
rebuild. Never use localhost as the production API URL.

The backend must allow the frontend origin through CORS, including the
Authorization and Content-Type headers. It currently uses cors() globally.
Its database, JWT, email, payment, and Cloudinary secrets stay on the backend.
Both frontend and backend must be running for actual API flows.

The setup has not deployed either project or tested a live database connection.


## Setup validation
- ESLint, TypeScript, and the production build pass.
- Production server returns HTTP 200 with the expected homepage content.
- The API helper was checked with mocked JSON requests, bearer headers,
  backend errors, empty responses, path validation, and FormData uploads.
- npm audit --omit=dev reports zero vulnerabilities at setup time.
- The full audit reports nine high-severity development-tooling advisories
  in the lint/shadcn dependency chains. Recheck updates before deployment;
  do not blindly apply npm audit fix --force, which proposes major downgrades.
- shadcn is a development dependency, also needed for its build-time CSS.
  Install development dependencies during builds (Vercel does this by default).
- The UI uses system fonts until the store typography is chosen.
## Dorytos authentication
- /signup: name, email, optional phone, password, and confirmation.
- /login: email and password. New accounts must confirm their email first.
- /api/auth/signup and /api/auth/login forward validated requests to Express.
- Login keeps the backend JWT in an HTTP-only, SameSite=Lax session cookie;
  Secure is enabled in production. The JWT is never returned to browser JS.
- /api/auth/logout clears the cookie. Express remains responsible for checking
  token validity and expiration on future protected API calls.
- Optional server environment API_BASE_URL overrides NEXT_PUBLIC_API_BASE_URL
  for auth requests. Configure it to the deployed backend on Vercel.
- Confirmation emails still link to the existing backend confirmation endpoint;
  after confirming, return to /login. Email delivery requires backend mail setup.
- The login success screen is the current endpoint of the flow. Protected account
  pages and storefront session UI are future steps.
- Logo source: the supplied dorytos-logo.svg, copied to public without changes.

## Auth tests
- node tests/auth.integration.mjs: mock backend integration checks; no real accounts.
- npx playwright test: desktop/mobile form checks using installed Microsoft Edge.
- Browser tests mock signup/login responses; actual database and email delivery
  have not been exercised. Test screenshots are in ignored test-results/.
## Password recovery with an email code
Use Forgot password? on /login, or open /forgot-password.
1. Enter the account email to request a 4-digit code.
2. Enter the code and matching new passwords.
3. Return to login after the password has been updated.
Resend code requests a replacement code; Change email returns to the first step.

The frontend POST /api/auth/passcode forwards PATCH /auth/passcode with { email }.
POST /api/auth/resetcode forwards PATCH /auth/resetcode with
{ email, otp, password, cPassword }. OTP stays a string to preserve leading zeroes.
Successful reset clears the frontend session cookie. Backend logic is unchanged.
The existing backend currently does not enforce code expiry or attempt limits;
those remain backend hardening work before public production use.

API integration and browser recovery tests use mocks and do not send email or
modify real accounts. Actual email delivery must be tested with backend mail configured.
## Dorytos homepage
- / uses the real category list for navigation and Shop by category.
- Each category has one product carousel limited to 10 cards, filtered by subcategory.
- Counts are distinct available products (not variant cards). Search applies to
  the product API and counts. Existing visibility rules exclude deleted products
  and inactive/out-of-stock variants.
- Nemo and Dory are vertically centered on the left/right of each product row.
  They scroll through the same 10 cards without requesting another page. Mobile
  users can also swipe. Filtering resets the scroll position.
- /api/catalog/categories reads all category pages; /api/catalog/products forwards
  allowed filters through the server API_BASE_URL configuration.
- The backend /product response now includes pagination and subcategoryCounts.
  Deploy the backend update alongside this frontend before testing on Vercel.
- Product images/prices/discounts come from the database. Missing images show a
  fallback. No demonstration products or invented offers are shipped.
- Saved finds are device-local, not an account-synced wishlist. Product cards open
  a quick view. Account links to login; Cairo is display-only and cart is visibly
  disabled pending the cart/checkout step.
- The supplied arrow assets are copied unchanged into public/.

Homepage verification: frontend lint and production build pass; browser tests
cover category/subcategory selection, counts, previous/next pages, search, saved
items, quick view, empty/error states, and mobile overflow. Read-only checks
against the real backend confirmed counts across all pages (Electronics: 1 product;
mobilE: 30 products / 34 variant cards). No database records were changed.
The new backend catalog-counts test passes. The existing aggregation suite has a
pre-existing projection assertion failure: the $project stage is commented out
in the baseline source. This homepage change does not alter that behavior.
### Category and brand browsing
Homepage sections query categoryId directly, sort by highest variant discount, and fetch at most 10 available variant cards without a page parameter or count aggregation. Each category shows up to seven large subcategory image tiles with names. Tiles do not filter products; their detail pages are deferred. A disabled VIEW ALL button appears only when more than seven exist, pending its future page. Selecting a category or submitting search requests count=true; totalItems includes each matching available variant. Brands appear underneath category sections and link to /brands/[brandId], with 24 results per page, exact variant totals, search and sorting. The backend must include GET /brand and optional count metadata on GET /product. Existing products need their correct categoryId populated to appear in category sections; no database migration is run automatically.

### Checkout and Stripe payments

Open `/checkout` from the cart. Customers choose a saved Egyptian address and
Cash or Card. Card details are collected on Stripe's hosted page; this frontend
needs no Stripe secret key or card form.

The server-side proxy uses only the backend checkout2 endpoints:

- `POST /order/checkout2` with `Idempotency-Key`.
- `POST /order/checkout2/:orderId/payment` with `{}`.
- `POST /order/checkout2/:orderId/reconcile` with `{}` or `{ "cancel": true }`.

The active request key and original payload are saved per customer in browser
session storage before creation. Retry the same checkout after an interrupted
request; do not replace the key just because a request timed out. Closing the
tab can remove session storage. Save the order ID shown after creation for
recovery through `/checkout/return?orderId=...` in that case.

Backend callbacks for local development:

```
STRIPE_SUCCESS_URL=http://localhost:3001/checkout/return?result=success
STRIPE_CANCEL_URL=http://localhost:3001/checkout/return?result=cancel
```

For Vercel, replace that origin with your frontend's deployed HTTPS origin in
the **backend** environment. The backend appends the order ID. Frontend return
pages always verify status through the backend; URL success/cancel flags do not
set order status.

Keep `STRIPE_SECRET_KEY` and `CHECKOUT2_WEBHOOK_SECRET` (or existing
`endpointSecret`) on the backend. Point signed Stripe webhooks to the deployed
backend `/order/webhook`, not the frontend. On Vercel configure the existing
server-only `API_BASE_URL` and `BEARER_KEY` to match the deployed backend.
New checkouts use EGP. Existing saved provider sessions retain their currency.
MongoDB transactions and webhook delivery must be available. Live Stripe
charges and webhook dashboard configuration are not performed by the UI tests.

Verification:

```
node --test tests/checkout-attempt.test.mjs
npm run typecheck
npm run lint
npm run build
```
