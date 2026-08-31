import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";

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
