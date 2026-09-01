import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing behind a session or in the admin area should ever be crawled.
      disallow: ["/admin", "/account", "/checkout", "/cart", "/order", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
