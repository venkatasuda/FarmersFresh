"use client";

import { useEffect, useRef } from "react";

/**
 * A small live map showing the rider's position, using Leaflet + free
 * OpenStreetMap tiles (no API key, no map dependency in the bundle — the
 * library loads from a CDN on demand). The marker moves as new coordinates
 * arrive from the track poll; we never plot a destination pin because customer
 * addresses aren't geocoded.
 */
type L = typeof import("leaflet");
declare global {
  interface Window {
    L?: unknown;
  }
}

function loadLeaflet(): Promise<L | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    if (window.L) return resolve(window.L as L);

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => resolve((window.L as L) ?? null);
    js.onerror = () => resolve(null);
    document.body.appendChild(js);
  });
}

export function RiderMap({ lat, lng }: { lat: number; lng: number }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      markerRef.current = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#16733e",
        fillColor: "#16733e",
        fillOpacity: 0.9,
        weight: 3,
      }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the marker as new positions arrive.
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.panTo([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div
      ref={elRef}
      className="h-56 w-full overflow-hidden rounded-xl border border-line"
      aria-label="Live rider location map"
    />
  );
}
