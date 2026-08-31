"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/shop", label: "Shop", icon: "👕" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/cart", label: "Cart", icon: "🛒" },
  { href: "/account", label: "Account", icon: "👤" },
] as const;

/** Fixed mobile nav — the primary way around the store on a phone. */
export function BottomNav({ cartCount }: { cartCount: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-[2.5px] border-[var(--color-ink)] bg-[var(--color-white)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase ${
                  active ? "bg-[var(--color-volt)]" : ""
                }`}
              >
                <span aria-hidden className="relative text-base leading-none">
                  {item.icon}
                  {item.href === "/cart" && cartCount > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--color-ink)] bg-[var(--color-electric)] px-0.5 text-[9px] text-white">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
