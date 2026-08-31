"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CatalogImage } from "@/lib/catalog";

/**
 * Swipeable product gallery.
 *
 * Touch swiping is native CSS scroll-snap rather than a JS gesture library —
 * it is smoother on a phone, works with momentum, and costs no bundle weight.
 * Mouse dragging is added on top because desktop has no swipe, and the
 * prev/next buttons cover keyboard and mouse users.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: CatalogImage[];
  productName: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const drag = useRef<{ startX: number; scrollLeft: number } | null>(null);

  // The scroll position is the source of truth for which slide is active, so
  // swiping, dragging and button presses all stay in sync automatically.
  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const slide = Math.round(track.scrollLeft / track.clientWidth);
    setIndex(Math.max(0, Math.min(images.length - 1, slide)));
  }, [images.length]);

  const scrollTo = useCallback((target: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(track.children.length - 1, target));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Touch is handled natively by scroll-snap; hijacking it would fight the
    // browser's momentum scrolling.
    if (event.pointerType === "touch") return;
    const track = trackRef.current;
    if (!track) return;
    drag.current = { startX: event.clientX, scrollLeft: track.scrollLeft };
    track.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!drag.current || !track) return;
    track.scrollLeft = drag.current.scrollLeft - (event.clientX - drag.current.startX);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!drag.current || !track) return;
    drag.current = null;
    track.releasePointerCapture(event.pointerId);
    // Snap to the nearest slide once the drag ends.
    scrollTo(Math.round(track.scrollLeft / track.clientWidth));
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center border-b-[2.5px] border-[var(--color-ink)] bg-[var(--color-paper)] text-sm uppercase text-[var(--color-steel)]">
        No image available
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="swipe-track aspect-[3/4] w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") scrollTo(index + 1);
          if (e.key === "ArrowLeft") scrollTo(index - 1);
        }}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${productName} images`}
        tabIndex={0}
      >
        {images.map((image, i) => (
          <div key={image.id} className="swipe-slide relative">
            <Image
              src={image.url}
              alt={`${productName} — view ${i + 1} of ${images.length}`}
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              className="select-none object-cover"
              priority={i === 0}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollTo(index - 1)}
            disabled={index === 0}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-[2.5px] border-[var(--color-ink)] bg-white/90 disabled:opacity-30 md:flex"
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            type="button"
            onClick={() => scrollTo(index + 1)}
            disabled={index === images.length - 1}
            aria-label="Next image"
            className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-[2.5px] border-[var(--color-ink)] bg-white/90 disabled:opacity-30 md:flex"
          >
            <span aria-hidden>›</span>
          </button>

          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Go to image ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full border-2 border-[var(--color-ink)] transition-all ${
                  i === index ? "w-6 bg-[var(--color-volt)]" : "w-2 bg-white"
                }`}
              />
            ))}
          </div>

          <span className="absolute right-2.5 top-2.5 rounded-full border-2 border-[var(--color-ink)] bg-white/90 px-2 py-0.5 text-[10px] font-bold">
            {index + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}
