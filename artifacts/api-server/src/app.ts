import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { HealthCheckResponse } from "@workspace/api-zod";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);
const healthResponse = HealthCheckResponse.parse({ status: "ok" });
app.get("/health", (_req, res) => {
  res.json(healthResponse);
});
app.get("/healthz", (_req, res) => {
  res.json(healthResponse);
});

/* ---------- FRONTEND ---------- */

const frontendPathCandidates = [
  // When server is started from repo root
  path.resolve(process.cwd(), "artifacts/court-game/dist"),
  // When server is started from artifacts/api-server
  path.resolve(process.cwd(), "../court-game/dist"),
];

const frontendPath =
  frontendPathCandidates.find((candidate) => existsSync(candidate)) ??
  frontendPathCandidates[0];

console.log(`[frontend] serving static files from: ${frontendPath}`);

app.use(
  express.static(frontendPath, {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      const normalizedPath = filePath.replace(/\\/g, "/");
      const relativePath = path.relative(frontendPath, filePath).replace(/\\/g, "/");
      const ext = path.extname(normalizedPath).toLowerCase();
      const isIndexHtml = relativePath === "index.html";
      const isHashedAsset =
        normalizedPath.includes("/assets/") &&
        [".js", ".css", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2"].includes(ext);

      if (isIndexHtml) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        return;
      }

      if (isHashedAsset) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return;
      }

      if ([".js", ".css", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2"].includes(ext)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  }),
);

app.get(/^(?!\/api).*/, (_, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(frontendPath, "index.html"));
});

export default app;
