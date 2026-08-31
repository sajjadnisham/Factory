const FLOW = [
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "processing", label: "Processing" },
  { id: "packed", label: "Packed" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
] as const;

export const ORDER_STATUSES = [...FLOW.map((s) => s.id), "cancelled"] as const;

export function statusLabel(status: string): string {
  if (status === "cancelled") return "Cancelled";
  return FLOW.find((s) => s.id === status)?.label ?? status;
}

/** Vertical timeline — reads well in a narrow phone column. */
export function OrderTimeline({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-lg border-2 border-[var(--color-danger)] bg-white p-3">
        <p className="text-sm font-bold uppercase text-[var(--color-danger)]">
          Order cancelled
        </p>
      </div>
    );
  }

  const currentIndex = FLOW.findIndex((s) => s.id === status);

  return (
    <ol className="grid gap-0">
      {FLOW.map((step, i) => {
        const done = i <= currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-ink)] text-[10px] font-bold ${
                  done ? "bg-[var(--color-volt)]" : "bg-white text-[var(--color-mist)]"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {i < FLOW.length - 1 && (
                <span
                  aria-hidden
                  className={`w-0.5 flex-1 ${
                    i < currentIndex ? "bg-[var(--color-ink)]" : "bg-[var(--color-mist)]"
                  }`}
                  style={{ minHeight: 20 }}
                />
              )}
            </div>
            <p
              className={`pb-3 text-sm ${
                active ? "font-black uppercase" : done ? "font-semibold" : "text-[var(--color-steel)]"
              }`}
            >
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
