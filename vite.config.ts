import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

// Windows fs is case-insensitive, so GET /license would otherwise serve the
// repo-root LICENSE file instead of the SPA. Production S3 is case-sensitive
// and the file is not in build/, but local deep links need the same route.
function spaOverRootFiles(): Plugin {
  const steal = (server: ViteDevServer) => {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url || "").split("?")[0];
      if (/^\/license\/?$/i.test(path)) req.url = "/index.html";
      next();
    });
  };
  return {
    name: "spa-over-root-files",
    configureServer: steal,
    configurePreviewServer: steal
  };
}

export default defineConfig({
  plugins: [react(), spaOverRootFiles()],
  server: { port: 3104 },
  build: { outDir: "build" }
});
