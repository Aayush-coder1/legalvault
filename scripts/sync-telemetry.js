#!/usr/bin/env node
/**
 * Copy the canonical telemetry module (packages/telemetry/index.js) into
 * every service as src/telemetry/index.js.
 *
 * Why copies: on Render each service builds from its own folder
 * (rootDir: services/<name>) and the Dockerfiles copy only `src/`, so a
 * require() reaching outside the service folder would crash in production.
 *
 *   node scripts/sync-telemetry.js          # write copies
 *   node scripts/sync-telemetry.js --check  # exit 1 if any copy is stale
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const SERVICES = ["api-gateway", "auth-service", "case-service", "file-service", "crypto-proxy"];
const BANNER =
  "// AUTO-GENERATED COPY — do not edit here.\n" +
  "// Source of truth: packages/telemetry/index.js  (sync: node scripts/sync-telemetry.js)\n";

const canonical = fs.readFileSync(path.join(root, "packages", "telemetry", "index.js"), "utf8");
const expected = BANNER + canonical;
const check = process.argv.includes("--check");
let stale = 0;

for (const svc of SERVICES) {
  const dir = path.join(root, "services", svc, "src", "telemetry");
  const file = path.join(dir, "index.js");
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (current === expected) {
    console.log(`ok       services/${svc}/src/telemetry/index.js`);
    continue;
  }
  if (check) {
    stale++;
    console.error(`STALE    services/${svc}/src/telemetry/index.js`);
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, expected);
  console.log(`written  services/${svc}/src/telemetry/index.js`);
}

if (stale) {
  console.error(`\n${stale} stale copy(ies). Run: node scripts/sync-telemetry.js`);
  process.exit(1);
}
