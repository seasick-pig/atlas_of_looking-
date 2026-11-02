import publicSite from "./public-site.json";

export type SiteConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  demo: boolean;
};

// This file runs during the build. The result is injected into the browser bundle,
// so the build and runtime always agree on the selected project and demo mode.
export function resolveSiteConfig(
  env: Record<string, string | undefined>,
  requireCloud = false,
): SiteConfig {
  const demo = env.VITE_ATLAS_DEMO === "true";
  if (demo) {
    if (requireCloud)
      throw new Error("Demo mode cannot be deployed as the public website.");
    return { supabaseUrl: "", supabasePublishableKey: "", demo: true };
  }

  const overrideUrl = (env.VITE_SUPABASE_URL || "").trim();
  const overrideKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!!overrideUrl !== !!overrideKey)
    throw new Error(
      "Both Supabase URL and publishable key are required when overriding the project.",
    );
  const url = overrideUrl || publicSite.supabaseUrl;
  const key = overrideKey || publicSite.supabasePublishableKey;
  if (!url || !key)
    throw new Error("Configure Supabase before deploying the public website.");

  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(
      "Use the HTTPS project URL without credentials, paths, query or fragment.",
    );
  if (!key.startsWith("sb_publishable_")) {
    let role = "";
    try {
      role = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      ).role;
    } catch {
      /* rejected below */
    }
    if (role !== "anon")
      throw new Error(
        "Only a publishable key or anon JWT is permitted in browser builds. Never use a secret/service_role key.",
      );
  }
  return { supabaseUrl: url, supabasePublishableKey: key, demo: false };
}
