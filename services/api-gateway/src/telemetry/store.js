/**
 * Persistent telemetry store for the api-gateway.
 *
 * Stores EdgeEvents in MongoDB (separate `telemetry_events` collection) so
 * request-flow history survives service restarts. Writes are best-effort and
 * async: a Mongo outage never slows or fails a real request.
 *
 * Documents carry a TTL index so old telemetry auto-expires (default 7 days).
 */
const mongoose = require("mongoose");

const TelemetryEventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true },
    ts: { type: Number, required: true, index: true },
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    method: { type: String },
    route: { type: String },
    status: { type: Number, index: true },
    ms: { type: Number },
    bytes: { type: Number },
    err: { type: String },
    source: { type: String, default: "gateway" },
  },
  { collection: "telemetry_events", timestamps: { createdAt: true, updatedAt: false } },
);

TelemetryEventSchema.index({ from: 1, to: 1, ts: -1 });
TelemetryEventSchema.index({ status: 1, ts: -1 });
TelemetryEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // 7-day TTL

let model = null;
let connected = false;

async function connect(mongoUri) {
  if (connected) return model;
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    maxPoolSize: 10,
    appName: "legalvault-gateway-telemetry",
  });
  model = mongoose.model("TelemetryEvent", TelemetryEventSchema);
  connected = true;
  console.log("api-gateway: telemetry mongo connected");
  return model;
}

async function close() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  model = null;
}

async function insertMany(events) {
  if (!model || !events.length) return;
  const docs = events.map((e) => ({
    id: e.id,
    ts: e.ts,
    from: e.from,
    to: e.to,
    method: e.method,
    route: e.route,
    status: e.status,
    ms: e.ms,
    bytes: e.bytes,
    err: e.err,
  }));
  try {
    await model.insertMany(docs, { ordered: false });
  } catch (e) {
    console.error("telemetry mongo insert failed:", e.message);
  }
}

async function find(query = {}, options = {}) {
  if (!model) return [];
  const { limit = 100, sort = { ts: -1 } } = options;
  return model.find(query).sort(sort).limit(Number(limit)).lean();
}

function isConnected() {
  return connected;
}

module.exports = { connect, close, insertMany, find, isConnected };
