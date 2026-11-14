# Dorytos Frontend

Next.js App Router storefront for the separate Express backend. Next.js is the React framework used by this application; the UI is built with React components.

## Stack

- Next.js 16.4.6 and React / React DOM 19.3.1 (current package.json minimum versions; package-lock.json pins the installed dependency tree)
- TypeScript, Tailwind CSS 4, shadcn/ui, and Lucide icons
- TanStack Query for shared server state, React Hook Form, Zod, and Fetch
- ESLint and Playwright for checks

## Local setup

Use Node.js 24.x to match the backend and deployment runtime. Keep the two projects in separate folders:

```text
Code/
  Ecommerce/   # Express API, localhost:3000
  Frontend/    # This Next.js app, localhost:3001
```

1. Start the configured backend with `npm start` in its folder.
2. In this folder, install locked dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` if the local file does not already exist, and configure it as below.
4. Run `npm run dev` and open http://localhost:3001.

PowerShell users can use `npm.cmd` if script execution policy prevents running `npm`.

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000
BEARER_KEY="Bearer "
```

`API_BASE_URL` is the optional server-only backend URL override. Server handlers prefer it over `NEXT_PUBLIC_API_BASE_URL`. Set both to the deployed backend HTTPS base URL on Vercel, without appending an endpoint such as /auth. The development fallback is localhost; do not rely on it in production.

`BEARER_KEY` must match the backend prefix exactly, including a trailing space if configured. It is server-only. Never place JWT signing secrets, database credentials, Cloudinary secrets, or Stripe secrets in any `NEXT_PUBLIC_*` value.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with automatic updates, port 3001 |
| `npm run build` | Create a production build |
| `npm start` | Serve the existing production build on port 3001 |
| `npm run typecheck` | Check TypeScript |
| `npm run lint` | Run ESLint |

When using `npm start`, source edits appear only after rebuilding and restarting. Use `npm run dev` while editing. If port 3001 is already occupied, stop the existing frontend process before starting another, or choose a different port with `npx next dev --port 3002`.

## Implemented pages

| Page | Behavior |
| --- | --- |
| `/` | Category navigation, search, Dorytos welcome banner, category sections, and brands |
| `/search?q=...` | Search results, filters, sorting, and pagination |
| `/brands/[brandId]` | Brand-filtered product results |
| `/products/[productId]/[variantId]` | Variant detail, gallery, available options, specifications, ratings, and cart quantity input |
| `/login`, `/signup`, `/signup/seller` | Sign in and separate customer/seller registration |
| `/forgot-password` | Code-based password recovery |
| `/account`, `/settings` | Profile, Egyptian delivery addresses, and customer orders |
| `/wishlist` | Signed-in customer's saved products, with an empty state |
| `/cart` | Customer cart, quantity controls, totals, and checkout link |
| `/checkout`, `/checkout/return` | Cash/card checkout, payment recovery, and payment reconciliation |
| `/seller` | Seller catalog and coupon management |
| `/seller/orders` | Seller/admin fulfillment controls |

Each homepage category shows up to seven large subcategory image tiles and a separate rail of up to ten highest-discount products. Tiles do not filter that rail. Subcategory destinations and VIEW ALL navigation are deferred. Homepage requests omit page/count parameters. Search and brand result pages request filtered counts; those counts include matching variant entries according to backend catalog behavior.

Product options are collected across a product's variants, including arbitrary options such as color, size, or RAM. Choosing an available option navigates to its variant. Galleries and specifications come from the backend response. Nemo and Dory controls sit alongside the product rails.

## Sessions, cart, and wishlist

Authenticated requests go through Next.js server route handlers. The backend token stays in the HTTP-only `dorytos_session` cookie; browser code does not need to manage a raw token. Sign-out updates the shared session and clears private cached data so account and header controls agree.

Cart and wishlist data belong to the signed-in customer on the backend. Guests must sign in. Seller/admin accounts receive a customer-account prompt or hidden customer controls instead of access to cart, wishlist, or customer orders.

- Product-card plus/minus controls reflect the shared cart state. Cart quantity changes update the UI optimistically, send the absolute quantity in the background, and restore the confirmed quantity on rejection.
- The product-detail quantity input represents an amount to add: POST /cart increments the existing quantity. PATCH /cart sets an absolute quantity. Stock limits still come from backend validation.
- Wishlist actions use the customer's wishlist endpoint; the wishlist page also opens when empty.

The account page shows name, email, and phone. Name/phone can be edited; email is displayed read-only. Customers can save and manage Egyptian addresses and their default address. Delivered order items expose review creation with a rating and comment. Review editing is not currently exposed by the storefront.

Seller tools include categories, subcategories, products, variants, and coupons. Variant images can be uploaded or selected individually from the same product, with at most four additional images. Coupon eligibility/exclusions use searchable multiple-selection controls. Fulfillment uses only status transitions allowed by the backend. Sellers can manage exclusively their own-product orders; mixed-seller orders require admin access.

## Checkout2 integration

The frontend uses the active backend controller in `Src/Modules/Order/Controller/checkout2.js`:

1. Save a checkout attempt and idempotency key before calling POST /order/checkout2. Send the key as `Idempotency-Key`. A retry keeps the same key and request body.
2. Cash checkout places the order directly. For a card order, POST to /order/checkout2/:orderId/payment to create or recover its Stripe session.
3. Redirect to the returned Stripe Checkout URL. New sessions charge EGP; the backend calculates the amount.
4. On /checkout/return, ask /order/checkout2/:orderId/reconcile for verified status. A URL claiming success is not proof of payment.

Recovery keeps the existing attempt after uncertain responses rather than creating another order. Explicit unpaid cancellation uses reconciliation with `{"cancel":true}`; merely opening the cancellation return URL does not cancel the order. Saved attempts use browser session storage for recovery, not as the payment authority.

Set the following on the **backend**, replacing localhost with the frontend HTTPS domain after deployment:

```dotenv
STRIPE_SUCCESS_URL=http://localhost:3001/checkout/return?result=success
STRIPE_CANCEL_URL=http://localhost:3001/checkout/return?result=cancel
```

The backend appends orderId to both return URLs. Existing attempts keep saved Stripe parameters, so changed callbacks apply to new attempts. The backend also needs `STRIPE_SECRET_KEY` and the case-sensitive webhook signing variable `endpointSecret`. Configure Stripe events against the **backend** HTTPS /order/webhook endpoint, not this frontend. Subscribe to checkout.session.completed, checkout.session.expired, and checkout.session.async_payment_succeeded. Checkout requires transaction-capable MongoDB.

## GitHub and Vercel

1. Commit this project's source, public assets, configuration, package.json, and package-lock.json. Keep .env.local, node_modules, .next, and secrets excluded; .env.example contains examples only.
2. Import the frontend repository into a separate Vercel project. Select the Next.js preset. Use the repository root for a standalone frontend repo, or select Frontend if it is nested inside a larger repo.
3. Use Node.js 24.x and the default Next.js output configuration. Build with `npm run build`; install development dependencies during the build because CSS/tooling dependencies are needed.
4. Set API_BASE_URL, NEXT_PUBLIC_API_BASE_URL, and BEARER_KEY for the intended Vercel environments. Use the deployed backend HTTPS URL, not localhost.
5. Deploy, then set the backend's Stripe return URLs to the stable frontend domain and the Stripe webhook to the backend domain. Test with a new checkout attempt.

This application needs Next.js server route handlers for authentication and protected API calls; deploy it with the Next.js preset rather than static export. Environment changes require a new deployment. Vercel manages the server runtime; you do not run the local npm start process there.

No GitHub push, Vercel deployment, or live payment is performed by updating this README. Preview deployments need their own deliberate backend/callback configuration if used for payment testing.

## Structure and verification

- `src/app`: pages, layouts, styles, and /api server route handlers
- `src/components`: storefront, account, seller, authentication, and shared UI
- `src/lib`: API helpers, types, session/cart/checkout utilities
- `public`: logo, fish navigation icons, and other static assets
- `tests`: targeted unit and Playwright browser checks

Run typecheck, lint, and build after relevant changes. Browser tests use mocked services for isolated flows; they do not prove that live email, MongoDB transactions, or Stripe payments succeed. Run `npm audit` against the current dependencies instead of relying on historical audit counts, and review proposed upgrades before applying them.
