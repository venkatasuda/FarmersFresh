"use client";

/**
 * "Print / Save as PDF" — triggers the browser's print dialog, from which the
 * customer can print or choose "Save as PDF". No PDF library to ship; the
 * receipt page is styled to print cleanly (see print:* utilities). Hidden from
 * the printout itself.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
