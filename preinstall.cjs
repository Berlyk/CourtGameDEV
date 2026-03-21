const fs = require("fs");
const path = require("path");

const lockfiles = ["package-lock.json", "yarn.lock"];

for (const filename of lockfiles) {
  const filePath = path.join(process.cwd(), filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
