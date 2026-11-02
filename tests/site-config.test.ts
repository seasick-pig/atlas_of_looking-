import { describe, it, expect } from "vitest";
import { resolveSiteConfig } from "../config/resolve-site";
import publicSite from "../config/public-site.json";

describe("site connection selection", () => {
  it("uses the supplied site's public configuration without Cloudflare variables", () => {
    expect(resolveSiteConfig({}, true)).toEqual({ ...publicSite, demo: false });
    expect(
      resolveSiteConfig(
        { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
        true,
      ).demo,
    ).toBe(false);
  });
  it("honors a complete paired override", () => {
    expect(
      resolveSiteConfig({
        VITE_SUPABASE_URL: "https://another-project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_override",
      }),
    ).toEqual({
      supabaseUrl: "https://another-project.supabase.co",
      supabasePublishableKey: "sb_publishable_override",
      demo: false,
    });
  });
  it("rejects partial overrides instead of silently pairing two projects", () => {
    expect(() =>
      resolveSiteConfig({
        VITE_SUPABASE_URL: "https://another-project.supabase.co",
      }),
    ).toThrow("Both");
    expect(() =>
      resolveSiteConfig({
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_override",
      }),
    ).toThrow("Both");
  });
  it("requires an explicit switch for a local demo", () => {
    expect(resolveSiteConfig({ VITE_ATLAS_DEMO: "true" })).toEqual({
      supabaseUrl: "",
      supabasePublishableKey: "",
      demo: true,
    });
    expect(resolveSiteConfig({ VITE_ATLAS_DEMO: "false" }).demo).toBe(false);
  });
  it("refuses demo mode in cloud deployments", () => {
    expect(() => resolveSiteConfig({ VITE_ATLAS_DEMO: "true" }, true)).toThrow(
      "Demo mode cannot",
    );
  });
  it("rejects secret keys before they can enter an artifact", () => {
    const token = `e30.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.test`;
    for (const key of ["sb_secret_do_not_ship", token])
      expect(() =>
        resolveSiteConfig({
          VITE_SUPABASE_URL: publicSite.supabaseUrl,
          VITE_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      ).toThrow("Never use");
  });
  it("rejects insecure or credential-bearing URLs", () => {
    for (const url of [
      "http://example.com",
      "https://user:password@example.com",
      "https://example.com/path",
      "https://example.com/?token=bad",
    ])
      expect(() =>
        resolveSiteConfig({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: publicSite.supabasePublishableKey,
        }),
      ).toThrow();
  });
});
