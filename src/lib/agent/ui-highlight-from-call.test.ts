import test from "node:test";
import assert from "node:assert/strict";
import { computeTouchHighlightKeysFromToolCall } from "./ui-highlight-from-call";

test("navigate_ui inbox", () => {
  const k = computeTouchHighlightKeysFromToolCall("navigate_ui", {
    path: "inbox",
  });
  assert.ok(k.includes("region:inbox"));
});

test("read_state project", () => {
  const k = computeTouchHighlightKeysFromToolCall("read_state", {
    scope: "project",
    projectId: "abc",
  });
  assert.ok(k.includes("project:abc"));
});
