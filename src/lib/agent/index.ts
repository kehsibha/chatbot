/**
 * Streaming agent loop.
 *
 * Yields a stream of events for the UI to consume:
 *   - thinking_delta   (chain-of-thought text, streamed token by token)
 *   - message_delta    (assistant-visible text, streamed)
 *   - tool_call        (name + input, fired when Claude decides to call a tool)
 *   - tool_result      (the result of executing that tool locally)
 *   - done             (final turn — no more tool calls)
 *   - error            (something went wrong)
 *
 * Uses a manual tool-use loop so we can stream every event to the frontend
 * as it happens. Persists each step to the `events` table for audit.
 */
import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { db, schema } from "@/lib/db";
import { SYSTEM_PROMPT, buildStateSnapshot } from "./prompts";
import { getToolByName, toolParamsForApi } from "./tools";

// The model. The user explicitly proposed claude-sonnet-4-6 for this app.
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;
const MAX_ITERATIONS = 10;

export type AgentEvent =
  | { type: "thinking_delta"; text: string }
  | { type: "thinking_stop" }
  | { type: "message_delta"; text: string }
  | { type: "message_stop" }
  | {
      type: "tool_call";
      id: string;
      name: string;
      input: unknown;
    }
  | {
      type: "tool_result";
      id: string;
      name: string;
      result: unknown;
      isError?: boolean;
    }
  | { type: "done"; runId: string }
  | { type: "error"; message: string };

type ContentBlock = Anthropic.Messages.ContentBlock;
type MessageParam = Anthropic.Messages.MessageParam;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }
  return new Anthropic({ apiKey });
}

function logEvent(
  type: schema.Event["type"],
  payload: unknown,
  runId: string,
  relatedId?: string,
) {
  db.insert(schema.events)
    .values({
      id: nanoid(),
      type,
      payload: payload as never,
      runId,
      relatedId: relatedId ?? null,
    })
    .run();
}

/**
 * Run one turn of the agent. Yields events to the caller as an async
 * generator. Caller is responsible for forwarding these to the UI (e.g.
 * as SSE events) and refetching state after tool_result events.
 */
export async function* runAgent(
  userMessage: string,
): AsyncGenerator<AgentEvent, void, unknown> {
  const runId = nanoid();
  const client = getClient();

  // Log the user message.
  logEvent("user_message", { text: userMessage }, runId);

  // Build conversation: system prompt stays fixed, first user turn carries
  // both the live state snapshot and the user's message.
  const messages: MessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: buildStateSnapshot() },
        { type: "text", text: `User: ${userMessage}` },
      ],
    },
  ];

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: toolParamsForApi(),
        messages,
        // Extended thinking — shows chain of thought in the reasoning panel.
        thinking: { type: "enabled", budget_tokens: 2000 },
      } as Anthropic.Messages.MessageStreamParams);

      // Stream deltas to the UI as they arrive.
      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          // Cast: the SDK version in use doesn't type `thinking_delta`, but
          // the runtime emits it when extended thinking is enabled.
          const delta = event.delta as {
            type: string;
            text?: string;
            thinking?: string;
          };
          if (delta.type === "thinking_delta" && delta.thinking) {
            yield { type: "thinking_delta", text: delta.thinking };
          } else if (delta.type === "text_delta" && delta.text) {
            yield { type: "message_delta", text: delta.text };
          }
          // input_json_delta for tools — we handle the full input once the
          // block completes below, so we don't emit partial tool JSON.
        }
      }

      const final = await stream.finalMessage();

      // Persist the assistant turn so we can replay or audit.
      logEvent(
        "agent_message",
        { content: final.content, stopReason: final.stop_reason },
        runId,
      );

      // Collect any tool_use blocks to execute.
      const toolUses = final.content.filter(
        (b): b is Extract<ContentBlock, { type: "tool_use" }> =>
          b.type === "tool_use",
      );

      // Append the assistant turn. Filter out thinking blocks with empty
      // content — the API requires every thinking block to have non-empty
      // `thinking` text, but the model sometimes returns empty ones.
      const cleanedContent = final.content.filter((block) => {
        const b = block as unknown as { type: string; thinking?: string };
        if (b.type === "thinking") {
          return !!b.thinking;
        }
        return true;
      });
      messages.push({ role: "assistant", content: cleanedContent });

      if (final.stop_reason !== "tool_use" || toolUses.length === 0) {
        yield { type: "done", runId };
        return;
      }

      // Execute each tool call locally, streaming results as we go.
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const use of toolUses) {
        yield {
          type: "tool_call",
          id: use.id,
          name: use.name,
          input: use.input,
        };
        logEvent(
          "tool_call",
          { name: use.name, input: use.input, toolUseId: use.id },
          runId,
        );

        const tool = getToolByName(use.name);
        if (!tool) {
          const errMsg = `Unknown tool: ${use.name}`;
          yield {
            type: "tool_result",
            id: use.id,
            name: use.name,
            result: errMsg,
            isError: true,
          };
          toolResults.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: errMsg,
            is_error: true,
          });
          continue;
        }

        try {
          const parsed = tool.zod.parse(use.input);
          const result = await tool.execute(parsed as never);
          yield {
            type: "tool_result",
            id: use.id,
            name: use.name,
            result,
          };
          logEvent(
            "tool_result",
            { name: use.name, result, toolUseId: use.id },
            runId,
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          yield {
            type: "tool_result",
            id: use.id,
            name: use.name,
            result: msg,
            isError: true,
          };
          logEvent(
            "tool_result",
            { name: use.name, error: msg, toolUseId: use.id },
            runId,
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: `Error: ${msg}`,
            is_error: true,
          });
        }
      }

      // Feed tool results back as the next user turn.
      messages.push({ role: "user", content: toolResults });
      // Loop continues — next iteration calls the model again.
    }

    // Hit iteration cap.
    yield {
      type: "error",
      message: `Agent exceeded max iterations (${MAX_ITERATIONS}).`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logEvent("system", { error: msg }, runId);
    yield { type: "error", message: msg };
  }
}
