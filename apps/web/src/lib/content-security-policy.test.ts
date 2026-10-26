import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API_CSP, PAGE_CSP } from "./content-security-policy";

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));

describe("page CSP", () => {
  it("allows the GA4 gtag.js host in script-src", () => {
    // Regression: the tag rendered in the HTML but gtag.js was blocked by CSP,
    // so no page_view ever reached Google and Realtime stayed at 0 users.
    expect(directive(PAGE_CSP, "script-src")).toContain("https://www.googletagmanager.com");
  });

  it("allows GA4 collection endpoints in connect-src", () => {
    const connectSrc = directive(PAGE_CSP, "connect-src") ?? "";
    expect(connectSrc).toContain("https://www.google-analytics.com");
    expect(connectSrc).toContain("https://*.google-analytics.com");
  });

  it("allows every third-party script host GtagScript loads", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/GtagScript.tsx"),
      "utf8",
    );
    const hosts = [...source.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map(
      (m) => m[1],
    );
    expect(hosts.length).toBeGreaterThan(0);

    const scriptSrc = directive(PAGE_CSP, "script-src") ?? "";
    const connectSrc = directive(PAGE_CSP, "connect-src") ?? "";
    for (const host of hosts) {
      expect(
        scriptSrc.includes(`https://${host}`) || connectSrc.includes(`https://${host}`),
        `${host} is loaded by GtagScript but no CSP directive allows it`,
      ).toBe(true);
    }
  });

  it("keeps the hardened defaults", () => {
    expect(directive(PAGE_CSP, "object-src")).toContain("'none'");
    expect(directive(PAGE_CSP, "base-uri")).toContain("'self'");
  });

  it("leaves the /api routes locked down", () => {
    expect(API_CSP).not.toContain("googletagmanager");
    expect(directive(API_CSP, "script-src")).not.toContain("https:");
  });
});
