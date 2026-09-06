"use client";

import { useId } from "react";

/**
 * The Factory MV roundel: a stamped garment-label badge.
 *
 * Drawn rather than served as an image, for the same reasons as the wordmark —
 * it scales to any size, weighs nothing, and takes its colours from the store's
 * tokens. Both arcs are real text on a path, so the badge is selectable and
 * carries its own accessible name.
 *
 * Geometry, worked out rather than eyeballed (the wordmark's first version was
 * cropped because it was not): the disc is r=190 on a 400 box. The upper arc
 * sits at r=150 and sweeps left-to-right over the top, so its letters stand
 * upright. The lower arc sits at r=152 and sweeps the other way underneath —
 * a bottom arc drawn in the same direction as the top one renders its text
 * upside down, which is the classic way to get this wrong.
 */
export function FactoryBadge({
  className,
  title = "Factory MV — quality garments, built for everyday men",
}: {
  className?: string;
  /** Accessible name. Pass "" where an adjacent label already names it. */
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const top = `bt-${uid}`;
  const bottom = `bb-${uid}`;
  const arch = `ba-${uid}`;
  const titleId = `bl-${uid}`;

  const cream = "var(--color-on-slab)";
  const disc = "#141414";

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role={title ? "img" : "presentation"}
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title id={titleId}>{title}</title>}

      <defs>
        {/* Upper arc: left to right over the top, so letters stand upright. */}
        <path id={top} d="M 50,200 A 150,150 0 0 1 350,200" fill="none" />
        {/* Lower arc: the opposite sweep, or the text hangs inverted. */}
        <path id={bottom} d="M 48,200 A 152,152 0 0 0 352,200" fill="none" />
        {/*
          The wordmark's own arch, shallower than the badge's.
          Long enough for the whole word: textPath renders only the glyphs that
          fit on the path and silently drops the rest, so an arc shorter than
          the text loses letters from both ends — this one was ~285 units for a
          word needing far more, and FACTORY came out as ACTOR.
        */}
        <path id={arch} d="M 52,238 Q 200,180 348,238" fill="none" />
      </defs>

      {/* Disc and its double keyline. */}
      <circle cx="200" cy="200" r="190" fill={disc} />
      <circle cx="200" cy="200" r="181" fill="none" stroke={cream} strokeWidth="5" />
      <circle cx="200" cy="200" r="168" fill="none" stroke={cream} strokeWidth="2" />

      <text
        fill={cream}
        fontFamily="var(--font-logo), 'Arial Black', sans-serif"
        fontSize="20"
        letterSpacing="6.5"
      >
        <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">
          QUALITY GARMENTS
        </textPath>
      </text>

      <text
        fill={cream}
        fontFamily="var(--font-logo), 'Arial Black', sans-serif"
        fontSize="17"
        letterSpacing="4"
      >
        <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">
          BUILT FOR EVERYDAY MEN
        </textPath>
      </text>

      {/* Sewing machine, reduced to the silhouette that reads at 120px: the
          arm and head over a bed, with the balance wheel behind. */}
      <g fill={cream}>
        {/* bed */}
        <rect x="146" y="130" width="108" height="10" rx="3" />
        {/* column, arm and head */}
        <rect x="148" y="88" width="16" height="42" rx="3" />
        <rect x="148" y="80" width="92" height="14" rx="4" />
        <rect x="226" y="88" width="14" height="26" rx="3" />
        <rect x="222" y="110" width="22" height="9" rx="3" />
        {/* needle bar, so the head reads as a head */}
        <rect x="231" y="119" width="4" height="11" />
        {/* balance wheel, knocked out of the column */}
        <circle cx="156" cy="106" r="11" fill={disc} stroke={cream} strokeWidth="4" />
      </g>

      {/* EST. 1960, flanking the machine on rules. */}
      <g fill={cream} fontFamily="var(--font-logo), 'Arial Black', sans-serif" fontSize="15">
        <text x="115" y="120" textAnchor="middle" letterSpacing="1.5">EST.</text>
        <text x="287" y="120" textAnchor="middle" letterSpacing="1.5">1960</text>
        {/* Clear of the words: EST. spans roughly 97-133 and 1960 roughly
            265-309, so the rules start outside both. */}
        <rect x="74" y="113" width="17" height="3" />
        <rect x="315" y="113" width="17" height="3" />
      </g>

      {/* FACTORY — the same varsity treatment as the wordmark. */}
      <g fontFamily="var(--font-logo), 'Arial Black', sans-serif" fontSize="47" letterSpacing="0.5">
        <text fill="#000000" transform="translate(4,6)">
          <textPath href={`#${arch}`} startOffset="50%" textAnchor="middle">
            FACTORY
          </textPath>
        </text>
        <text
          fill="var(--color-volt)"
          stroke={cream}
          strokeWidth="3"
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          <textPath href={`#${arch}`} startOffset="50%" textAnchor="middle">
            FACTORY
          </textPath>
        </text>
      </g>

      {/* MV, with a rule either side. */}
      <g>
        <text
          x="200"
          y="298"
          textAnchor="middle"
          fontFamily="var(--font-logo), 'Arial Black', sans-serif"
          fontSize="52"
          letterSpacing="2"
          fill="var(--color-navy)"
          stroke={cream}
          strokeWidth="2.5"
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          MV
        </text>
        <g fill={cream}>
          <rect x="96" y="272" width="42" height="3" />
          <rect x="96" y="281" width="42" height="3" />
          <rect x="262" y="272" width="42" height="3" />
          <rect x="262" y="281" width="42" height="3" />
        </g>
      </g>
    </svg>
  );
}
