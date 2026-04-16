import test from "node:test";
import assert from "node:assert/strict";
import { foldRecognitionResults } from "./fold-recognition-results";

function mockEvent(
  resultIndex: number,
  rows: Array<{ transcript: string; isFinal: boolean }>,
): SpeechRecognitionEvent {
  const list = rows.map((r) => ({
    isFinal: r.isFinal,
    length: 1,
    item: () => ({ transcript: r.transcript, confidence: 1 }),
    0: { transcript: r.transcript, confidence: 1 },
  }));
  return {
    resultIndex,
    results: {
      length: list.length,
      item: (i: number) => list[i],
      ...Object.fromEntries(list.map((row, i) => [i, row])),
    },
  } as unknown as SpeechRecognitionEvent;
}

test("only processes results from resultIndex onward", () => {
  const ev = mockEvent(0, [
    { transcript: "hello", isFinal: true },
    { transcript: " world", isFinal: false },
  ]);
  const a = foldRecognitionResults(ev);
  assert.deepEqual(a.finalParts, ["hello"]);
  assert.equal(a.interim, "world");

  const b = foldRecognitionResults(
    mockEvent(1, [
      { transcript: "hello", isFinal: true },
      { transcript: " world", isFinal: false },
    ]),
  );
  assert.deepEqual(b.finalParts, []);
  assert.equal(b.interim, "world");
});

test("second event with resultIndex 1 does not re-append hello", () => {
  const late = foldRecognitionResults(
    mockEvent(1, [
      { transcript: "hello", isFinal: true },
      { transcript: "there", isFinal: true },
    ]),
  );
  assert.deepEqual(late.finalParts, ["there"]);
  assert.equal(late.interim, "");
});
