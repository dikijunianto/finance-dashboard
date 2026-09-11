import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import bcrypt from "bcryptjs";
const url = new URL(process.env.QA_DATABASE_URL);
assert(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    /^\/myfinance_qa(?:_[a-z0-9]+)?$/.test(url.pathname),
  "Only an isolated local QA database is allowed",
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3005",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url.href,
      AUTH_USERNAME: "qa-local",
      AUTH_PASSWORD_HASH: await bcrypt.hash("qa-local-password", 10),
      AUTH_SESSION_SECRET: "local-only-qa-session-secret-not-for-production",
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
