"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/** Photos are decoded and re-encoded by the authenticated server upload route. */
export function ImageUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("That's not an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Too large — keep photos under 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/product-images", { method: "POST", body: file });
      if (!response.ok) { setError("Photo upload failed. Check the image and try again."); return; }
      const data = await response.json();
      onChange(data.url);
    } catch {
      setError("Photo upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium text-ink">Photo</span>

      <div className="mt-1.5 flex items-start gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-line bg-brand-50">
          {value ? (
            <Image src={value} alt="" fill className="object-cover" sizes="96px" />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-ink-soft">
              None
            </span>
          )}
        </div>

        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
            >
              {busy ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
            </button>

            {value ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-lg px-3 py-2 text-sm text-ink-soft hover:text-red-600"
              >
                Remove
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-ink-soft">
            Your own photo of the actual product. Square works best. Under 5 MB.
          </p>

          {error ? (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
