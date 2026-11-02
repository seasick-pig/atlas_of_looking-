import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolveSiteConfig } from "./config/resolve-site";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const site = resolveSiteConfig(
    env,
    !!(
      mode === "cloud" ||
      env.VERCEL ||
      env.CF_PAGES ||
      env.WORKERS_CI_WORKER_NAME
    ),
  );
  const demo = site.demo;
  return {
    define: { __ATLAS_SITE_CONFIG__: JSON.stringify(site) },
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
