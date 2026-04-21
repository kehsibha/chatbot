export type VoiceMdBlock =
  | { type: "p"; lines: string[] }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "pre"; code: string };

export function parseVoiceMarkdownBlocks(text: string): VoiceMdBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: VoiceMdBlock[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ type: "p", lines: [...para] });
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t === "") {
      flushPara();
      i++;
      continue;
    }

    if (t.startsWith("```")) {
      flushPara();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: "pre", code: codeLines.join("\n") });
      continue;
    }

    const hm = t.match(/^(#{1,3})\s+(.*)$/);
    if (hm) {
      flushPara();
      const n = hm[1].length;
      const level = (n >= 3 ? 3 : n) as 1 | 2 | 3;
      blocks.push({ type: "h", level, text: hm[2] });
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (lt === "") break;
        const bullet = lt.match(/^[-*]\s+(.*)$/);
        if (!bullet) break;
        items.push(bullet[1]);
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    para.push(line);
    i++;
  }
  flushPara();
  return blocks;
}
