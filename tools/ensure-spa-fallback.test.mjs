// node --test tools/ensure-spa-fallback.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spaFallbackMissing, withSpaFallback, SPA_ERROR_RESPONSES } from "./ensure-spa-fallback.mjs";

test("spa fallback is missing when CloudFront has no custom errors", () => {
  assert.equal(spaFallbackMissing({}), true);
  assert.equal(spaFallbackMissing({ CustomErrorResponses: { Quantity: 0, Items: [] } }), true);
});

test("spa fallback is missing if only 404 is mapped, or mapped to the wrong page", () => {
  assert.equal(spaFallbackMissing({
    CustomErrorResponses: { Quantity: 1, Items: [{ ErrorCode: 404, ResponsePagePath: "/index.html", ResponseCode: "200" }] }
  }), true);
  assert.equal(spaFallbackMissing({
    CustomErrorResponses: {
      Quantity: 2,
      Items: [
        { ErrorCode: 403, ResponsePagePath: "/error.html", ResponseCode: "200" },
        { ErrorCode: 404, ResponsePagePath: "/index.html", ResponseCode: "200" }
      ]
    }
  }), true);
});

test("spa fallback is present for both S3 REST 403 and website 404", () => {
  assert.equal(spaFallbackMissing({
    CustomErrorResponses: { Quantity: 2, Items: SPA_ERROR_RESPONSES }
  }), false);
});

test("withSpaFallback patches 403/404 without dropping other error pages", () => {
  const next = withSpaFallback({
    Enabled: true,
    CustomErrorResponses: {
      Quantity: 1,
      Items: [{ ErrorCode: 500, ResponsePagePath: "/500.html", ResponseCode: "500", ErrorCachingMinTTL: 10 }]
    }
  });
  assert.equal(next.CustomErrorResponses.Quantity, 3);
  assert.equal(spaFallbackMissing(next), false);
  assert.equal(next.CustomErrorResponses.Items.find(i => i.ErrorCode === 500).ResponsePagePath, "/500.html");
});
