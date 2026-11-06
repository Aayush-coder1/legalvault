// auth-service telemetry wiring: middleware + Mongo command monitoring hook.
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

test.before(() => {
  process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:1/test";
  process.env.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || "test";
  process.env.JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY || "test";
});

test("auth-service telemetry instance is configured and attaches to a Mongo client", () => {
  const telemetry = require("../src/telemetry/setup");
  assert.equal(telemetry.service, "auth-service");
  assert.equal(typeof telemetry.middleware(), "function");
  const client = new EventEmitter();
  assert.equal(telemetry.attachMongo(client), true);
  client.emit("commandStarted", { commandName: "find", connectionId: 9, requestId: 1, command: { find: "users", filter: { email: "x@y.z" } } });
  client.emit("commandSucceeded", { commandName: "find", connectionId: 9, requestId: 1, duration: 4 });
  const [ev] = telemetry.buffer.since(0).events;
  assert.deepEqual([ev.source, ev.target, ev.route], ["auth-service", "mongodb", "find users"]);
  assert.ok(!JSON.stringify(ev).includes("x@y.z"));
});
