/**
 * Streaming agent endpoint. Accepts a user message, runs the agent loop,
 * and streams events back as Server-Sent Events (SSE).
 *
 * Request:  POST /api/agent  { "message": "..." }
 * Response: text/event-stream with `data: {json}\n\n` chunks, one per event.
 *
 * The frontend consumes this via a fetch + reader loop (not EventSource,
 * since we need POST with a JSON body).
 */
import { NextRequest } from "next/server";
import { runAgent, type AgentEvent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
  };
  const message = body.message?.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };
      try {
        for await (const event of runAgent(message)) {
          send(event);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
      } finally {
        controller.enqueue(encoder.encode(`event: end\ndata: {}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
