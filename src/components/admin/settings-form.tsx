"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateSettingsAction } from "@/app/actions/admin-actions";
import { toMajor, toMinor } from "@/lib/money";
import type { StoreSettings } from "@/lib/settings";

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    storeName: settings.storeName,
    tagline: settings.tagline,
    logoText: settings.logoText,
    // Money is entered in rufiyaa and converted to laari on save.
    deliveryFee: String(toMajor(settings.deliveryFeeMinor)),
    freeDeliveryThreshold: String(toMajor(settings.freeDeliveryThresholdMinor)),
    deliveryAreas: settings.deliveryAreas.join(", "),
    deliveryEstimate: settings.deliveryEstimate,
    deliveryHeadline: settings.deliveryHeadline,
    contactPhone: settings.contactPhone,
    contactEmail: settings.contactEmail,
    whatsapp: settings.whatsapp,
    businessAddress: settings.businessAddress,
    instagram: settings.instagram,
    facebook: settings.facebook,
    heroHeadline: settings.heroHeadline,
    heroSubline: settings.heroSubline,
    heroCtaLabel: settings.heroCtaLabel,
    promoMessage: settings.promoMessage,
    brandMessage: settings.brandMessage,
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateSettingsAction({
        storeName: form.storeName,
        tagline: form.tagline,
        logoText: form.logoText,
        deliveryFeeMinor: toMinor(Number(form.deliveryFee) || 0),
        freeDeliveryThresholdMinor: toMinor(Number(form.freeDeliveryThreshold) || 0),
        deliveryAreas: form.deliveryAreas
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        deliveryEstimate: form.deliveryEstimate,
        deliveryHeadline: form.deliveryHeadline,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        whatsapp: form.whatsapp,
        businessAddress: form.businessAddress,
        instagram: form.instagram,
        facebook: form.facebook,
        heroHeadline: form.heroHeadline,
        heroSubline: form.heroSubline,
        heroCtaLabel: form.heroCtaLabel,
        promoMessage: form.promoMessage,
        brandMessage: form.brandMessage,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Settings saved.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      {error && (
        <p role="alert" className="rounded border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded border-2 border-[var(--color-success)] bg-white p-2.5 text-sm">
          {message}
        </p>
      )}

      <Group title="Brand">
        <Field label="Store name" value={form.storeName} onChange={(v) => set("storeName", v)} />
        <Field label="Logo text" value={form.logoText} onChange={(v) => set("logoText", v)} />
        <Field label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} />
        <Field label="Brand message" value={form.brandMessage} onChange={(v) => set("brandMessage", v)} textarea />
      </Group>

      <Group title="Homepage">
        <Field label="Hero headline" value={form.heroHeadline} onChange={(v) => set("heroHeadline", v)} />
        <Field label="Hero subline" value={form.heroSubline} onChange={(v) => set("heroSubline", v)} />
        <Field label="Hero button label" value={form.heroCtaLabel} onChange={(v) => set("heroCtaLabel", v)} />
        <Field label="Promo bar message" value={form.promoMessage} onChange={(v) => set("promoMessage", v)} />
      </Group>

      <Group title="Delivery">
        <Field label="Delivery fee (MVR)" value={form.deliveryFee} onChange={(v) => set("deliveryFee", v)} numeric />
        <Field
          label="Free delivery over (MVR, 0 to disable)"
          value={form.freeDeliveryThreshold}
          onChange={(v) => set("freeDeliveryThreshold", v)}
          numeric
        />
        <Field
          label="Delivery areas (comma separated)"
          value={form.deliveryAreas}
          onChange={(v) => set("deliveryAreas", v)}
        />
        <Field label="Delivery estimate" value={form.deliveryEstimate} onChange={(v) => set("deliveryEstimate", v)} />
        <Field label="Delivery headline (homepage)" value={form.deliveryHeadline} onChange={(v) => set("deliveryHeadline", v)} />
      </Group>

      <Group title="Contact">
        <Field label="Phone" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} />
        <Field label="Email" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} />
        <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
        <Field label="Business address" value={form.businessAddress} onChange={(v) => set("businessAddress", v)} />
        <Field label="Instagram" value={form.instagram} onChange={(v) => set("instagram", v)} />
        <Field label="Facebook" value={form.facebook} onChange={(v) => set("facebook", v)} />
      </Group>

      <button type="button" onClick={save} disabled={pending} className="btn btn-primary">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="comic-card p-4">
      <h2 className="section-title mb-3 text-base">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  numeric?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className={textarea ? "md:col-span-2" : ""}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {textarea ? (
        <textarea
          id={id}
          className="field"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="field"
          value={value}
          inputMode={numeric ? "decimal" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
