# WorshipCommons

The worshipcommons.org site — an open library of worship music. React 19 + Vite SPA (no Next.js, no MUI). Talks to the core Api's `commons` module (under `/commons`, port 8084) and to the core Api for login.

```bash
yarn dev     # localhost:3104
yarn test    # Playwright (reseeds demo data via ../Api `yarn reset-commons`)
yarn lint
```

## Deployment

Static build to S3 + CloudFront, same pattern as B1Admin. GitHub Actions runs `yarn deploy-staging` on push to `main` (or `workflow_dispatch`); production is `workflow_dispatch` or a GitHub release.

```bash
yarn deploy-staging   # VITE_* env baked at build → s3 sync build/ → CloudFront invalidation
yarn deploy-prod
```

Deployed:
- prod: https://worshipcommons.org (+ www — distribution E363E9V6GH4TVJ, bucket worshipcommons-app)
- staging: https://staging.worshipcommons.org (distribution E3T6JKTGXHBUG6, bucket staging-worshipcommons-app)

DNS lives at Cloudflare (grey-cloud CNAMEs to CloudFront / API Gateway). SPA deep links work via the S3 website error document (index.html) — same as the other Vite apps. The core Api stage URL is baked in via `VITE_CORE_API` in the predeploy scripts; the commons module is reached under it at `/commons`.
