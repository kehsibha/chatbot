import test from "node:test";
import assert from "node:assert/strict";
import { parseVoiceMarkdownBlocks } from "./voice-markdown-parse";

test("headings and list", () => {
  const b = parseVoiceMarkdownBlocks("# Title\n\n- a\n- b\n");
  assert.equal(b[0].type, "h");
  if (b[0].type === "h") assert.equal(b[0].text, "Title");
  assert.equal(b[1].type, "ul");
  if (b[1].type === "ul") assert.deepEqual(b[1].items, ["a", "b"]);
});

test("fenced code", () => {
  const b = parseVoiceMarkdownBlocks("```\nline1\n```\n");
  assert.equal(b[0].type, "pre");
  if (b[0].type === "pre") assert.equal(b[0].code, "line1");
});
