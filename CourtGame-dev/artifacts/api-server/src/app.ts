import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { HealthCheckResponse } from "@workspace/api-zod";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use(express.static(frontendPath));

app.get(/^(?!\/api).*/, (_, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

export default app;
