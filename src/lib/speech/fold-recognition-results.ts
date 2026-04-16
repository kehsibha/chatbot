/**
 * Fold a speech recognition callback into new final token(s) and interim text.
 * Only considers results from `resultIndex` onward — the Web Speech API
 * re-dispatches `onresult` with the full `results` array each time, so
 * scanning from 0 duplicates every finalized phrase.
 */
export function foldRecognitionResults(
  event: SpeechRecognitionEvent,
): { finalParts: string[]; interim: string } {
  const finalParts: string[] = [];
  let interim = "";
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const text = result[0]?.transcript ?? "";
    if (result.isFinal) {
      const t = text.trim();
      if (t) finalParts.push(t);
    } else {
      interim += text;
    }
  }
  return { finalParts, interim: interim.trim() };
}
