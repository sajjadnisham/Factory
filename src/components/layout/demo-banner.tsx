import { isDemoMode } from "@/lib/demo";

/**
 * Permanent notice that this deployment is a demo whose phone verification is
 * bypassed. It is deliberately loud and not dismissible — anyone landing on the
 * site should know before they type a real phone number into it.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div
      role="note"
      className="border-b-[2.5px] border-[var(--color-ink)] bg-[var(--color-electric)] px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-white"
    >
      Demo store · verification codes are shown on screen · not a real shop, do
      not enter real details
    </div>
  );
}
