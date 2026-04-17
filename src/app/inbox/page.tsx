"use client";
/**
 * Inbox view — raw captures awaiting clarification. The intended workflow:
 *   1. Dump stuff via voice or the reasoning panel ("I need to fix the X and Y and Z").
 *   2. Open inbox, ask the agent "process my inbox" — it walks each item.
 */
import { useActions } from "@/lib/queries";
import { ActionRow } from "@/components/action-row";
import { PageHeader } from "@/components/page-header";

export default function InboxPage() {
  const { data: inbox = [], isLoading } = useActions({ view: "inbox" });

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="Unprocessed captures. Ask the agent to help clarify."
      />
      <div className="mx-auto max-w-3xl px-6 py-6">
        {isLoading && (
          <div className="text-xs text-[var(--color-fg-dim)]">Loading…</div>
        )}
        {!isLoading && inbox.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--color-border)] px-6 py-10 text-center text-sm text-[var(--color-fg-muted)]">
            Inbox zero. Nice.
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {inbox.map((a) => (
            <ActionRow key={a.id} action={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
