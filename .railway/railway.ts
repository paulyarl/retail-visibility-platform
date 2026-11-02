import { defineRailway, github, project, service } from "railway/iac";

// This repo owns the API service in each environment. Other repos export
// their own partial names (see docs.railway.com IaC multi-repo projects).
export const partial = "api";

export default defineRailway((ctx) => {
  const prod = ctx.isEnvironment("production");

  const api = service(prod ? "visible-shelf-api-prod" : "visible-shelf-api-staging", {
    source: github("paulyarl/retail-visibility-platform", { branch: prod ? "main" : "staging" }),
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "apps/api/Dockerfile",
      watchPatterns: ["/apps/api/**"],
    },
    start: "npm start",
    healthcheck: "/api/health",
    healthcheckTimeout: 300,
    replicas: { "us-west2": 1 },
    domains: [prod ? "api.visibleshelf.com" : "aps.visibleshelf.store"],
  });

  return project("tranquil-beauty", {
    // Variables stay unmanaged — Doppler is the source of truth, pushed via
    // `railway variable set`. IaC must never read or write them.
    variables: { managed: false },
    resources: [api],
  });
});
