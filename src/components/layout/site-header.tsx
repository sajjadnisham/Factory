"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  storeName: string;
  categories: { slug: string; name: string; count: number }[];
  cartCount: number;
  promoMessage: string;
}

export function SiteHeader({ storeName, categories, cartCount, promoMessage }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const router = useRouter();

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = term.trim();
    if (query.length === 0) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b-[2.5px] border-[var(--color-ink)] bg-[var(--color-white)]">
      {promoMessage && (
        <div className="bg-[var(--color-ink)] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-volt)]">
          {promoMessage}
        </div>
      )}

      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg border-[2.5px] border-[var(--color-ink)] bg-[var(--color-white)] md:hidden"
        >
          <span aria-hidden className="text-lg leading-none">
            {menuOpen ? "✕" : "☰"}
          </span>
        </button>

        <Link href="/" className="display text-lg tracking-tight md:text-2xl">
          {storeName}
        </Link>

        <nav className="ml-6 hidden gap-5 md:flex">
          <Link href="/shop" className="text-sm font-semibold uppercase hover:text-[var(--color-electric)]">
            Shop
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/shop/${category.slug}`}
              className="text-sm font-semibold uppercase hover:text-[var(--color-electric)]"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search"
            aria-expanded={searchOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg border-[2.5px] border-[var(--color-ink)] bg-[var(--color-white)]"
          >
            <span aria-hidden>🔍</span>
          </button>

          <Link
            href="/cart"
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border-[2.5px] border-[var(--color-ink)] bg-[var(--color-volt)]"
          >
            <span aria-hidden>🛒</span>
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-electric)] px-1 text-[10px] font-bold text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          <Link
            href="/account"
            aria-label="Account"
            className="hidden h-10 w-10 items-center justify-center rounded-lg border-[2.5px] border-[var(--color-ink)] bg-[var(--color-white)] md:flex"
          >
            <span aria-hidden>👤</span>
          </Link>
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submitSearch} className="border-t-2 border-[var(--color-ink)] p-3">
          <div className="mx-auto flex max-w-6xl gap-2">
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the field is
              // revealed by an explicit tap on the search button, so focusing it
              // is the expected outcome of that action.
              autoFocus
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search tees, pants, colours, SKU…"
              className="field"
              aria-label="Search products"
            />
            <button type="submit" className="btn btn-dark px-4">
              Go
            </button>
          </div>
        </form>
      )}

      {menuOpen && (
        <nav className="border-t-2 border-[var(--color-ink)] bg-[var(--color-white)] p-3 md:hidden">
          <ul className="grid gap-1.5">
            {[
              { href: "/shop", label: "All products" },
              ...categories.map((c) => ({
                href: `/shop/${c.slug}`,
                label: `${c.name} (${c.count})`,
              })),
              { href: "/account", label: "My account" },
              { href: "/account/orders", label: "My orders" },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg border-2 border-[var(--color-ink)] px-3 py-2.5 font-semibold uppercase"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
