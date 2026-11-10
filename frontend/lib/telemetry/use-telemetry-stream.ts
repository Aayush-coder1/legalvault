"use client";

import * as React from "react";
import { authedFetch } from "@/lib/api/client";
import { createSseParser } from "./sse";
import type { EdgeEvent, NodeId, StreamStatus, TelemetryStats, TrafficBatch } from "./types";

/**
 * The gateway URL. Literal process.env key on purpose: Next.js only inlines
 * literal NEXT_PUBLIC_* lookups into the browser bundle.
 * Local: run the gateway (npm run dev:gateway, port 4000) — it reads every
 * service's telemetry even when the app itself talks to services directly.
 */
export const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4000").replace(/\/$/, "");
export const TELEMETRY_STREAM_URL = `${GATEWAY_URL}/api/v1/telemetry/stream`;

const LOG_SIZE = 60;
const HISTORY_POINTS = 40;
/** Events older than this (server clock) are logged but not animated. */
const ANIMATE_MAX_AGE_MS = 6000;

export type TrafficListener = (events: EdgeEvent[]) => void;

/** Fetch signature used to open the telemetry SSE stream (always a string URL). */
export type StreamFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface TelemetryStreamState {
  status: StreamStatus;
  error: string;
  stats: TelemetryStats | null;
  /** Newest first. */
  log: EdgeEvent[];
  /** rps history per node for sparklines (oldest first). */
  history: Partial<Record<NodeId, number[]>>;
  lastEventAt: number | null;
  /** Register a listener for fresh traffic (particle animation). */
  onTraffic: (fn: TrafficListener) => () => void;
  reconnect: () => void;
}

/**
 * Live telemetry stream from the gateway.
 *
 * @param fetchImpl  fetch function used to open the SSE stream. Defaults to
 *                   `authedFetch` (logged-in dashboard). Pass plain `fetch` for
 *                   the public /simulator page, which must work without login.
 */
export function useTelemetryStream(enabled = true, fetchImpl: StreamFetch = authedFetch): TelemetryStreamState {
  const [status, setStatus] = React.useState<StreamStatus>("connecting");
  const [error, setError] = React.useState("");
  const [stats, setStats] = React.useState<TelemetryStats | null>(null);
  const [log, setLog] = React.useState<EdgeEvent[]>([]);
  const [history, setHistory] = React.useState<Partial<Record<NodeId, number[]>>>({});
  const [lastEventAt, setLastEventAt] = React.useState<number | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const listeners = React.useRef(new Set<TrafficListener>());

  const onTraffic = React.useCallback((fn: TrafficListener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const reconnect = React.useCallback(() => setAttempt((a) => a + 1), []);

  React.useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let stopped = false;

    const pushLog = (events: EdgeEvent[]) => {
      if (!events.length) return;
      setLog((prev) => [...events.slice().reverse(), ...prev].slice(0, LOG_SIZE));
      setLastEventAt(Date.now());
    };

    const handle = (event: string, data: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        return;
      }
      if (event === "hello") {
        const recent = (parsed as { recent?: EdgeEvent[] }).recent || [];
        setLog(recent.slice().reverse().slice(0, LOG_SIZE));
      } else if (event === "traffic") {
        const batch = parsed as TrafficBatch;
        const events = Array.isArray(batch.traffic) ? batch.traffic : [];
        pushLog(events);
        const fresh = events.filter((e) => batch.serverNow - e.ts <= ANIMATE_MAX_AGE_MS);
        if (fresh.length) {
          for (const fn of listeners.current) {
            try {
              fn(fresh);
            } catch {
              /* a broken listener must not stop the stream */
            }
          }
        }
      } else if (event === "stats") {
        const s = parsed as TelemetryStats;
        setStats(s);
        setHistory((prev) => {
          const next: Partial<Record<NodeId, number[]>> = { ...prev };
          for (const [id, n] of Object.entries(s.nodes || {})) {
            const arr = (prev[id as NodeId] || []).concat(n.rps);
            next[id as NodeId] = arr.slice(-HISTORY_POINTS);
          }
          return next;
        });
      }
    };

    const scheduleRetry = () => {
      if (stopped) return;
      failures++;
      // 1s, 2s, 4s ... capped at 15s, with jitter so tabs don't stampede.
      const delay = Math.min(15000, 1000 * 2 ** Math.min(failures - 1, 4)) + Math.random() * 500;
      setStatus("reconnecting");
      retryTimer = setTimeout(run, delay);
    };

    async function run() {
      if (stopped) return;
      setStatus((s) => (s === "live" ? "reconnecting" : s === "reconnecting" ? s : "connecting"));
      try {
        const res = await fetchImpl(TELEMETRY_STREAM_URL, {
          headers: { Accept: "text/event-stream" },
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (res.status === 401) {
          setStatus("unauthorized");
          setError("Your session expired — log in again to see live telemetry.");
          return; // no retry loop on auth failure
        }
        if (!res.ok || !res.body) {
          let msg = `Telemetry stream unavailable (HTTP ${res.status})`;
          try {
            const j = await res.json();
            if (j?.error?.message) msg = j.error.message;
          } catch {
            /* not JSON */
          }
          setError(msg);
          return scheduleRetry();
        }
        failures = 0;
        setError("");
        setStatus("live");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const parser = createSseParser((m) => handle(m.event, m.data));
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.end();
        if (!stopped) {
          setError("Stream closed by the gateway — reconnecting…");
          scheduleRetry();
        }
      } catch (e) {
        if (stopped || ctrl.signal.aborted) return;
        setError(
          e instanceof Error && e.message
            ? `Cannot reach the gateway at ${GATEWAY_URL} (${e.message}). Is it running?`
            : `Cannot reach the gateway at ${GATEWAY_URL}`,
        );
        scheduleRetry();
      }
    }

    run();
    return () => {
      stopped = true;
      ctrl.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled, attempt]);

  return { status, error, stats, log, history, lastEventAt, onTraffic, reconnect };
}

/**
 * Same live telemetry stream, but without auth — for the public /simulator page.
 * Uses plain `fetch` (no cookies / Bearer token), so it works without login.
 * Requires the gateway to serve the stream unauthenticated
 * (TELEMETRY_REQUIRE_AUTH=false).
 */
export function usePublicTelemetryStream(enabled = true): TelemetryStreamState {
  return useTelemetryStream(enabled, fetch);
}
