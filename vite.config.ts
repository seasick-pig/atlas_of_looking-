import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const url = env.VITE_SUPABASE_URL || "";
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  if (!!url !== !!key)
    throw new Error("Both Supabase URL and publishable key are required.");
  if (url) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/"
    )
      throw new Error(
        "Use the HTTPS project URL without credentials or paths.",
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
  }
  if (
    (mode === "cloud" ||
      env.VERCEL ||
      env.CF_PAGES ||
      env.WORKERS_CI_WORKER_NAME) &&
    !url
  )
    throw new Error("Configure Supabase before deploying the public website.");
  const demo = !url;
  return {
    plugins: [
      react(),
      {
        name: "atlas-demo-data",
        configureServer(server) {
          if (demo)
            server.middlewares.use("/demo-data.json", (_req, res) => {
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(readFileSync("data/archives.seed.json", "utf8"));
            });
        },
        generateBundle() {
          if (demo)
            this.emitFile({
              type: "asset",
              fileName: "demo-data.json",
              source: readFileSync("data/archives.seed.json", "utf8"),
            });
        },
      },
    ],
    build: { sourcemap: false },
  };
});
