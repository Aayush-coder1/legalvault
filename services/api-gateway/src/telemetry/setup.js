/**
 * api-gateway telemetry instance (service-specific wiring; the module itself is
 * the vendored copy in ./index.js — see packages/telemetry).
 *
 * Env: TELEMETRY_ENABLED (default true), TELEMETRY_TOKEN (optional shared
 * secret the gateway sends to read /telemetry/recent), TELEMETRY_BUFFER.
 */
const config = require("../config");
const { createTelemetry } = require("./index");

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const targets = {};
for (const [url, name] of [
  [config.authUrl, "auth-service"],
  [config.caseUrl, "case-service"],
  [config.fileUrl, "file-service"],
  [config.cryptoUrl, "crypto-proxy"],
]) {
  if (originOf(url)) targets[originOf(url)] = name;
}

module.exports = createTelemetry({ service: "api-gateway", targets });
