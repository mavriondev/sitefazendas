import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Mapa da REGIÃO aproximada: círculo grande, sem marcador. O servidor já entrega o centro deslocado. */
export function MapaRegiao({ lat, lon, raioKm }: { lat: number; lon: number; raioKm: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const mapa = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true, zoomControl: true }).setView([lat, lon], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 10, minZoom: 6, attribution: "© OpenStreetMap" }).addTo(mapa);
    const c = L.circle([lat, lon], { radius: raioKm * 1000, color: "#2f5d3a", weight: 2, fillOpacity: 0.15 }).addTo(mapa);
    mapa.fitBounds(c.getBounds(), { padding: [10, 10] });
    return () => { mapa.remove(); };
  }, [lat, lon, raioKm]);
  return <div ref={ref} style={{ height: 280, borderRadius: 10, overflow: "hidden" }} role="img" aria-label="Mapa da região aproximada" />;
}
