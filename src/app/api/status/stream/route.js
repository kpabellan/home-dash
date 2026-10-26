import { monitor } from "@/lib/monitor";

export const dynamic = "force-dynamic";

// Server-sent events: the current state on connect, then one "update" per
// finished check. The browser's EventSource reconnects on its own if the
// connection drops, and gets a fresh snapshot when it does.
export async function GET(request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const write = (text) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      const send = (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      send("snapshot", monitor.snapshot());
      const unsubscribe = monitor.subscribe((update) => send("update", update));
      // Comments keep proxies from closing an idle connection.
      const ping = setInterval(() => write(": ping\n\n"), 20000);
      cleanup = () => {
        unsubscribe();
        clearInterval(ping);
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops nginx-based proxies (like Nginx Proxy Manager) from buffering.
      "X-Accel-Buffering": "no",
    },
  });
}
