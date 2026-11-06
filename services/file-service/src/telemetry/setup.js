/**
 * file-service telemetry instance (service-specific wiring; the module itself is
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
if (originOf(config.cryptoUrl)) targets[originOf(config.cryptoUrl)] = "crypto-proxy";
if (originOf(config.jwksUrl)) targets[originOf(config.jwksUrl)] = "auth-service";

module.exports = createTelemetry({ service: "file-service", targets });
