"use client";

import { useId } from "react";

/**
 * The Factory wordmark: arched collegiate type over a ribbon.
 *
 * Drawn rather than served as an image. A raster logo would need a public
 * directory the container does not have, a second network request on every
 * page, and a separate file per density; this scales to any size, weighs a few
 * hundred bytes inline, and takes its colours from the same tokens as the rest
 * of the store, so it cannot drift out of the palette.
 *
 * The arch is real text on a path, not outlines, so the wordmark stays
 * selectable and searchable and the accessible name comes from the type itself.
 */
export function FactoryLogo({
  className,
  title = "Factory Menswear",
}: {
  className?: string;
  /** Accessible name. Set it to "" when an adjacent label already names the link. */
  title?: string;
}) {
  // Two of these can render on one page (header and footer), and a duplicated
  // element id would leave the second wordmark's textPath pointing at the
  // first one's arc.
  const uid = useId().replace(/:/g, "");
  const arc = `arc-${uid}`;
  const titleId = `t-${uid}`;

  return (
    <svg
      viewBox="0 0 300 108"
      className={className}
      role={title ? "img" : "presentation"}
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title id={titleId}>{title}</title>}

      <defs>
        {/* The baseline the wordmark sits on. Its rise sets how hard the arch
            curves — the ribbon below is drawn to the same span. */}
        <path id={arc} d="M14,80 Q150,4 286,80" fill="none" />
      </defs>

      <g
        fontFamily="var(--font-display), 'Arial Black', sans-serif"
        fontSize="58"
        letterSpacing="1"
      >
        {/* Offset shadow first, then the face on top: the same hard, unblurred
            offset the comic-card system uses everywhere else. */}
        <text fill="#000000" transform="translate(5,6)">
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
          d="M52,88 L52,106 L74,97 Z M248,88 L248,106 L226,97 Z"
          fill="var(--color-navy)"
          stroke="var(--color-on-slab)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M62,84 Q150,72 238,84 L238,102 Q150,90 62,102 Z"
          fill="var(--color-navy)"
          stroke="var(--color-on-slab)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text
          x="150"
          y="96"
          textAnchor="middle"
          fontFamily="var(--font-display), 'Arial Black', sans-serif"
          fontSize="13"
          letterSpacing="4"
          fill="var(--color-on-slab)"
        >
          MENSWEAR
        </text>
      </g>
    </svg>
  );
}
