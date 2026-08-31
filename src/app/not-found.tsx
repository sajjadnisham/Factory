import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="display text-6xl">404</p>
      <h1 className="section-title mt-2">Page not found</h1>
      <p className="mt-2 text-sm text-[var(--color-graphite)]">
        That page has moved or never existed.
      </p>
      <div className="mt-6 grid gap-2">
        <Link href="/shop" className="btn btn-primary">Shop all</Link>
        <Link href="/" className="btn btn-ghost">Back home</Link>
      </div>
    </div>
  );
}
