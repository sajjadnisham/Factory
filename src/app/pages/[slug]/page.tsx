import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSettings, type StoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Legal and support pages.
 *
 * The copy below is a placeholder skeleton for the store owner's lawyer or
 * accountant to complete — it is explicitly labelled as such rather than
 * presented as verified legal text, and it invents no business facts.
 */

interface PageDef {
  title: string;
  description: string;
  body: (settings: StoreSettings) => { heading: string; paragraphs: string[] }[];
}

const PAGES: Record<string, PageDef> = {
  privacy: {
    title: "Privacy policy",
    description: "How we handle your personal information.",
    body: (s) => [
      {
        heading: "What we collect",
        paragraphs: [
          `To deliver your order, ${s.storeName} collects your name, mobile number and delivery address. Your mobile number is also how you sign in — we verify it with a one-time code instead of a password.`,
          "We store your order history so you can see past purchases, and your most recent delivery address so you do not have to type it again.",
        ],
      },
      {
        heading: "What we do not do",
        paragraphs: [
          "We do not sell your information. We do not store card details on our servers — online card payments are handled by the payment provider.",
          "One-time codes are stored only as a hash, are never written to our logs in readable form, and expire within minutes.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          "You can update your saved name and address at any time from your account page.",
          "To request deletion of your account and its order history, contact the store using the details on the Contact page. [Placeholder: confirm your retention period with your accountant, as tax rules may require keeping order records.]",
        ],
      },
    ],
  },
  terms: {
    title: "Terms & conditions",
    description: "The terms you agree to when ordering.",
    body: (s) => [
      {
        heading: "Orders",
        paragraphs: [
          `Placing an order on ${s.storeName} is an offer to buy. Your order is confirmed once we accept it and payment is received or arranged.`,
          "Prices are shown in Maldivian Rufiyaa (MVR) and include any applicable taxes unless stated otherwise. [Placeholder: confirm your GST position.]",
        ],
      },
      {
        heading: "Stock and pricing",
        paragraphs: [
          "We hold stock for you when your order is placed. If an item sells out before your order completes, we will contact you to arrange a replacement or refund.",
          "We correct pricing errors when we find them, and will always contact you before charging a different amount.",
        ],
      },
      {
        heading: "Placeholder notice",
        paragraphs: [
          "This page is a starting skeleton, not legal advice, and has not been reviewed by a lawyer. Replace it with terms drafted for your business before you go live.",
        ],
      },
    ],
  },
  returns: {
    title: "Return & refund policy",
    description: "How returns and refunds work.",
    body: () => [
      {
        heading: "Returns",
        paragraphs: [
          "[Placeholder: state your return window, e.g. 7 days from delivery.] Items must be unworn, unwashed and in their original condition with tags attached.",
          "Contact the store first so we can arrange collection or exchange.",
        ],
      },
      {
        heading: "Refunds",
        paragraphs: [
          "[Placeholder: state how refunds are issued — bank transfer, store credit — and how long they take.]",
          "Delivery charges are [placeholder: refundable / non-refundable] except where an item arrived faulty or incorrect.",
        ],
      },
      {
        heading: "Faulty items",
        paragraphs: [
          "If something arrives damaged or is not what you ordered, tell us with a photo and we will make it right at our cost.",
        ],
      },
    ],
  },
  shipping: {
    title: "Delivery policy",
    description: "Where we deliver and what it costs.",
    body: (s) => [
      {
        heading: "Where we deliver",
        paragraphs: [
          s.deliveryAreas.length > 0
            ? `We currently deliver to: ${s.deliveryAreas.join(", ")}.`
            : "[Placeholder: list your delivery areas in the admin settings.]",
          s.deliveryEstimate || "[Placeholder: add a delivery estimate.]",
        ],
      },
      {
        heading: "Delivery charges",
        paragraphs: [
          s.deliveryFeeMinor > 0
            ? `Delivery is MVR ${(s.deliveryFeeMinor / 100).toLocaleString("en-US")} per order${
                s.freeDeliveryThresholdMinor > 0
                  ? `, free on orders over MVR ${(s.freeDeliveryThresholdMinor / 100).toLocaleString("en-US")}.`
                  : "."
              }`
            : "Delivery is currently free.",
        ],
      },
      {
        heading: "Tracking",
        paragraphs: [
          "Every order has a status you can follow from your account page, from confirmed through to delivered.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact us",
    description: "How to reach the store.",
    body: (s) => {
      const details: string[] = [];
      if (s.contactPhone) details.push(`Phone: ${s.contactPhone}`);
      if (s.whatsapp) details.push(`WhatsApp: ${s.whatsapp}`);
      if (s.contactEmail) details.push(`Email: ${s.contactEmail}`);
      if (s.businessAddress) details.push(s.businessAddress);

      return [
        {
          heading: "Get in touch",
          paragraphs:
            details.length > 0
              ? details
              : [
                  "Contact details have not been configured yet. Add them in the admin settings and they will appear here.",
                ],
        },
        {
          heading: "Order questions",
          paragraphs: [
            "Have your order number ready — it is on your order page and starts with #.",
          ],
        },
      ];
    },
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) return { title: "Not found" };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/pages/${slug}` },
  };
}

export default async function StaticPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  const settings = await getSettings();
  const sections = page.body(settings);

  return (
    <article className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="section-title text-2xl">{page.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-steel)]">{page.description}</p>

      {sections.map((section) => (
        <section key={section.heading} className="mt-5">
          <h2 className="text-base">{section.heading}</h2>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-[var(--color-graphite)]">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <p className="mt-8 rounded-lg border-2 border-[var(--color-mist)] bg-white p-3 text-xs text-[var(--color-steel)]">
        Placeholder content. Replace the bracketed sections with your own policy
        text before launch — this has not been legally reviewed.
      </p>
    </article>
  );
}
