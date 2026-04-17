import test from "node:test";
import assert from "node:assert/strict";
import { computeTouchHighlightKeys } from "./ui-highlight";

test("navigate_ui today", () => {
  const k = computeTouchHighlightKeys(
    "navigate_ui",
    {},
    { navigated: true, path: "today", projectId: null },
  );
  assert.ok(k.includes("region:today"));
  assert.ok(k.includes("route:/today"));
});

test("navigate_ui project", () => {
  const k = computeTouchHighlightKeys(
    "navigate_ui",
    {},
    { navigated: true, path: "project", projectId: "p1" },
  );
  assert.ok(k.includes("project:p1"));
  assert.ok(k.includes("route:/projects/p1"));
});

test("capture_thought", () => {
  const k = computeTouchHighlightKeys(
    "capture_thought",
    {},
    { id: "a1", title: "x", status: "inbox" },
  );
  assert.ok(k.includes("region:inbox"));
  assert.ok(k.includes("action:a1"));
});

test("errors yield no keys", () => {
  assert.deepEqual(
    computeTouchHighlightKeys("capture_thought", {}, {}, true),
    [],
  );
});

test("mutating tools also tag reasoning region", () => {
  const k = computeTouchHighlightKeys(
    "capture_thought",
    {},
    { id: "a1", title: "x", status: "inbox" },
  );
  assert.ok(k.includes("region:reasoning"));
});

test("read_state does not tag reasoning", () => {
  const k = computeTouchHighlightKeys(
    "read_state",
    { scope: "inbox" },
    { inbox: [] },
  );
  assert.equal(k.includes("region:reasoning"), false);
});
