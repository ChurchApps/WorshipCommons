# WorshipCommons

The worshipcommons.org site — an open library of worship music. React 19 + Vite SPA (no Next.js, no MUI). Talks to WorshipCommonsApi (port 8098) and the core Api for login (no church selection — user JWT only).

```bash
yarn dev     # localhost:3104
yarn test    # Playwright (reseeds demo data via ../WorshipCommonsApi `yarn seed`)
yarn lint
```

## Deployment

Static build to S3 + CloudFront, same pattern as B1Admin:

```bash
yarn deploy-staging   # VITE_* env baked at build → s3 sync build/ → CloudFront invalidation
yarn deploy-prod
```

Deployed:
- prod: https://worshipcommons.org (+ www — distribution E363E9V6GH4TVJ, bucket worshipcommons-app)
- staging: https://staging.worshipcommons.org (distribution E3T6JKTGXHBUG6, bucket staging-worshipcommons-app)

DNS lives at Cloudflare (grey-cloud CNAMEs to CloudFront / API Gateway). SPA deep links work via the S3 website error document (index.html) — same as the other Vite apps. API stage URLs are baked in via `VITE_WC_API` / `VITE_CORE_API` in the predeploy scripts.
