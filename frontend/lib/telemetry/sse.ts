/**
 * Minimal Server-Sent Events parser for fetch() streams.
 *
 * We read the stream with fetch() instead of EventSource because
 * EventSource cannot send an Authorization header, and this app relies on
 * a Bearer fallback when the browser blocks cross-site cookies.
 *
 * Feed it decoded text chunks in any size; it calls `onEvent` once per
 * complete event. Comments (": ping") and unknown fields are ignored.
 * Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

export function createSseParser(onEvent: (msg: SseMessage) => void) {
  let buffer = "";
  let event = "";
  let data: string[] = [];
  let id: string | undefined;

  function dispatch() {
    if (data.length) {
      onEvent({ event: event || "message", data: data.join("\n"), id });
    }
    event = "";
    data = [];
  }

  function line(raw: string) {
    if (raw === "") return dispatch();
    if (raw.startsWith(":")) return; // comment / heartbeat
    const i = raw.indexOf(":");
    const field = i === -1 ? raw : raw.slice(0, i);
    let value = i === -1 ? "" : raw.slice(i + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") id = value;
    // "retry" and unknown fields: ignored (we manage reconnects ourselves)
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      // Normalise CRLF / CR line endings, keep any partial line in the buffer.
      buffer = buffer.replace(/\r\n?/g, "\n");
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const l = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        line(l);
      }
      // Guard against a server that never sends a newline.
      if (buffer.length > 5_000_000) buffer = "";
    },
    /** Flush a final event that was not followed by a blank line. */
    end() {
      if (buffer) {
        line(buffer);
        buffer = "";
      }
      dispatch();
    },
  };
}
