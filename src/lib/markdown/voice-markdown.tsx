"use client";

import * as React from "react";
import type { VoiceMdBlock } from "./voice-markdown-parse";
import { parseVoiceMarkdownBlocks } from "./voice-markdown-parse";

/** Inline: **bold**, `code`, [text](url) */
function formatInline(raw: string): React.ReactNode {
  const parts = raw.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (m) {
      return (
        <a
          key={i}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-[var(--color-accent)] underline-offset-2"
        >
          {m[1]}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function renderBlock(b: VoiceMdBlock, idx: number): React.ReactNode {
  if (b.type === "p") {
    return (
      <p key={idx}>
        {b.lines.map((ln, j) => (
          <React.Fragment key={j}>
            {j > 0 ? <br /> : null}
            {formatInline(ln)}
          </React.Fragment>
        ))}
      </p>
    );
  }
  if (b.type === "h") {
    const cls =
      b.level === 1
        ? "text-base font-semibold mt-2 mb-1"
        : b.level === 2
          ? "text-[0.95rem] font-semibold mt-1.5 mb-0.5"
          : "text-[0.9rem] font-medium mt-1 mb-0.5";
    const inner = formatInline(b.text);
    if (b.level === 1)
      return (
        <h1 key={idx} className={cls}>
          {inner}
        </h1>
      );
    if (b.level === 2)
      return (
        <h2 key={idx} className={cls}>
          {inner}
        </h2>
      );
    return (
      <h3 key={idx} className={cls}>
        {inner}
      </h3>
    );
  }
  if (b.type === "ul") {
    return (
      <ul key={idx} className="my-1 list-disc pl-4">
        {b.items.map((it, j) => (
          <li key={j}>{formatInline(it)}</li>
        ))}
      </ul>
    );
  }
  if (b.type === "pre") {
    return (
      <pre key={idx}>
        <code>{b.code}</code>
      </pre>
    );
  }
  return null;
}

export function VoiceMarkdown({ text }: { text: string }) {
  if (!text.trim()) return null;
  const blocks = parseVoiceMarkdownBlocks(text);
  return <>{blocks.map((b, idx) => renderBlock(b, idx))}</>;
}
