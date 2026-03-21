import { createServer } from "http";
import app from "./app.js";
import { setupSocket } from "./socket/index.js";

const rawPort = process.env["PORT"] ?? "8080";
const host = process.env["HOST"] ?? "0.0.0.0";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
setupSocket(httpServer);

httpServer.listen(port, host, () => {
  console.log(`Server listening on ${host}:${port}`);
});
