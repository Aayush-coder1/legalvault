/**
 * auth-service telemetry instance (service-specific wiring; the module itself is
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
// auth-service only calls MongoDB (tracked via driver command monitoring).

module.exports = createTelemetry({ service: "auth-service", targets });
