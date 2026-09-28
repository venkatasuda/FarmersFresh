"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads straight from the browser to Supabase Storage.
 *
 * Deliberately NOT routed through a Server Action: Server Actions have a
 * request body limit (1 MB by default) and a phone photo is several times
 * that. Going direct also means the file never occupies a Node process.
 *
 * The bucket's own policies do the guarding — public read, owner-only write,
 * 5 MB cap, image MIME types only. A hostile caller with the anon key still
 * cannot write here.
 */
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

    if (!file.type.startsWith("image/")) {
      setError("That's not an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Too large — keep photos under 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // Random name, not the original: two staff uploading "IMG_1234.jpg"
      // would otherwise overwrite each other's photo.
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "31536000", upsert: false });

      if (upErr) {
        setError(upErr.message);
        return;
      }

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      onChange(data.publicUrl);
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
