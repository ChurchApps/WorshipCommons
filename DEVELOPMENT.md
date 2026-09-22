# Development

Local setup, tests, and deployment. Overview for GitHub visitors: [README.md](README.md).

The worshipcommons.org site — an open library of worship music. React 19 + Vite SPA (no Next.js, no MUI). Talks to the core Api's `commons` module (under `/commons`, port 8084) and to the core Api for login.

```bash
yarn dev     # localhost:3104
yarn demo    # reseed local commons DB + content from ../WorshipCommonsContent (core Api `yarn reset-commons`)
yarn test    # Playwright: runs the same reseed first, starts the core Api (:8084) and Vite (:3104) if not already up
yarn lint
```

Local stack: this site -> core Api (`ChurchApps/Api`, commons module, :8084) -> local MySQL. The core Api is found at
`../Api`, `../ChurchApps/Api` or `../../ChurchApps/Api`; set `CORE_API_DIR` for anything else. Login: `demo@b1.church` / `password`.
On Windows run from a correctly-cased path (`D:\Code\WC`, not `d:\code\wc`) or Playwright loads two copies of itself and reports "No tests found".

## Deployment

Static build to S3 + CloudFront, same pattern as B1Admin. GitHub Actions runs `yarn deploy-prod` on `workflow_dispatch` or a GitHub release.

```bash
yarn deploy-staging   # VITE_* env baked at build → s3 sync build/ → CloudFront invalidation
yarn deploy-prod
```

Deployed:
- prod: https://worshipcommons.org (+ www — distribution E363E9V6GH4TVJ, bucket worshipcommons-app)
- staging: https://staging.worshipcommons.org (distribution E3T6JKTGXHBUG6, bucket staging-worshipcommons-app)

DNS lives at Cloudflare (grey-cloud CNAMEs to CloudFront / API Gateway). `yarn deploy-*` prerenders `/songs`, `/songs/:id`, `/license`, `/terms`, `/upload`, `/new`, `/call-for-songs`, and `/report` as `build/<route>/index.html`, then `ensure-spa-fallback.mjs` keeps CloudFront 403/404 custom errors pointed at `/index.html` with HTTP 200 so deep links that are not in that build (`/songs/:id` published since the last deploy, `/login`, `/writers/:name`, `/songs` without a trailing slash when the origin is REST rather than the S3 website) still boot the SPA. The S3 website error document (index.html) is the same fallback without CloudFront. The core Api stage URL is baked in via `VITE_CORE_API` in the predeploy scripts; the commons module is reached under it at `/commons`.
