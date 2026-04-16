import test from "node:test";
import assert from "node:assert/strict";
import {
  executeNavigateUI,
  hrefFromNavigateUIResult,
} from "./navigation";

test("executeNavigateUI maps paths", () => {
  assert.equal(executeNavigateUI({ path: "projects" }).path, "projects");
  assert.equal(executeNavigateUI({ path: "projects" }).projectId, null);
});

test("executeNavigateUI requires projectId for project path", () => {
  assert.throws(() => executeNavigateUI({ path: "project" }), /projectId/);
});

test("hrefFromNavigateUIResult", () => {
  assert.equal(
    hrefFromNavigateUIResult(executeNavigateUI({ path: "inbox" })),
    "/inbox",
  );
  assert.equal(
    hrefFromNavigateUIResult(
      executeNavigateUI({ path: "project", projectId: "abc123" }),
    ),
    "/projects/abc123",
  );
  assert.equal(hrefFromNavigateUIResult({ foo: 1 }), null);
});
