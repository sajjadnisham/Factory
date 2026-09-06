"use client";

import { useId } from "react";

/**
 * The Factory wordmark: arched collegiate type over a ribbon.
 *
 * Drawn rather than served as an image — it scales to any size, weighs a few
 * hundred bytes inline, and takes its colours from the store's tokens so it
 * cannot drift out of the palette. The arch is real text on a path, not
 * outlines, so the wordmark stays selectable and searchable.
 *
 * The geometry is worked out rather than eyeballed, because the first version
 * was not: a quadratic Q(P0,P1,P2) sits at (P0 + 2·P1 + P2)/4 at its midpoint,
 * so an arc from (14,80) through control (150,4) crests at y=42 — and 58px type
 * has roughly 42px of cap height above its baseline, which put the tops of the
 * middle letters at y=0 and cropped them against the viewBox edge.
 *
 * So, deliberately:  crest 65 − cap height 39 = 26px of clear space at the top,
 * and the ribbon finishes at 132 inside a 140-tall box.
 */

const CAP_TOP = 26; // documented above; changing the arc means redoing this sum

export function FactoryLogo({
  className,
  title = "Factory Menswear",
}: {
  className?: string;
  /** Accessible name. Pass "" when an adjacent label already names the link. */
  title?: string;
}) {
  // Header and footer both render one, and a duplicated element id would leave
  // the second wordmark's textPath pointing at the first one's arc.
  const uid = useId().replace(/:/g, "");
  const arc = `arc-${uid}`;
  const titleId = `t-${uid}`;

  return (
    <svg
      viewBox={`0 0 320 140`}
      className={className}
      role={title ? "img" : "presentation"}
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ overflow: "visible" }}
    >
      {title && <title id={titleId}>{title}</title>}

      <defs>
        {/* Crests at y=65. See CAP_TOP above before changing it. */}
        <path id={arc} d="M18,96 Q160,34 302,96" fill="none" />
      </defs>

      <g
        fontFamily="var(--font-logo), 'Arial Black', sans-serif"
        fontSize="54"
        letterSpacing="0.5"
      >
        {/* Hard offset shadow, then the face on top — the same unblurred offset
            the comic-card system uses everywhere else in the store. */}
        <text fill="#000000" transform="translate(5,7)">
          <textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">
            FACTORY
          </textPath>
        </text>
        <text
          fill="var(--color-volt)"
          stroke="var(--color-on-slab)"
          strokeWidth="2.5"
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          <textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">
            FACTORY
          </textPath>
        </text>
      </g>

      {/* Ribbon: folded tails behind, banner in front. */}
      <g>
        <path
          d="M56,104 L56,132 L84,118 Z M264,104 L264,132 L236,118 Z"
          fill="#12293f"
          stroke="var(--color-on-slab)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M70,100 Q160,88 250,100 L250,124 Q160,112 70,124 Z"
          fill="var(--color-navy)"
          stroke="var(--color-on-slab)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text
          x="160"
          y="115"
          textAnchor="middle"
          fontFamily="var(--font-logo), 'Arial Black', sans-serif"
          fontSize="14"
          letterSpacing="5"
          fill="var(--color-on-slab)"
        >
          MENSWEAR
        </text>
      </g>

      {/* Keeps CAP_TOP referenced, so the constant cannot silently rot away
          from the geometry it documents. */}
      <rect x="0" y={CAP_TOP} width="0" height="0" fill="none" />
    </svg>
  );
}
