"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLng, Place } from "@/lib/types";

type Props = {
  center: LatLng;
  /** Device accuracy in meters — drawn as a light blue circle around "you". */
  accuracy?: number | null;
  places: Place[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  variant?: "normal" | "er";
  className?: string;
};

const meIcon = L.divIcon({ className: "", html: '<div class="hh-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function pinIcon(n: number, active: boolean, er: boolean) {
  const size = active ? 40 : 32;
  return L.divIcon({
    className: "",
    html: `<div class="hh-pin${active ? " active" : ""}${er ? " er" : ""}">${n}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ center, places }: { center: LatLng; places: Place[] }) {
  const map = useMap();
  const key = places.map((p) => p.id).join("|");
  useEffect(() => {
    const pts: [number, number][] = [[center.lat, center.lng], ...places.slice(0, 12).map((p) => [p.location.lat, p.location.lng] as [number, number])];
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 15 });
    else map.setView([center.lat, center.lng], 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, center.lat, center.lng, map]);
  return null;
}

function PanTo({ places, activeId }: { places: Place[]; activeId?: string | null }) {
  const map = useMap();
  useEffect(() => {
    const p = places.find((x) => x.id === activeId);
    if (p) map.panTo([p.location.lat, p.location.lng], { animate: true });
  }, [activeId, places, map]);
  return null;
}

// Leaflet measures its container on mount; re-measure when the layout changes (list/map toggle, resize).
function Resizer() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function MapView({ center, accuracy, places, activeId, onSelect, variant = "normal", className }: Props) {
  const icons = useMemo(() => places.map((p, i) => pinIcon(i + 1, p.id === activeId, variant === "er")), [places, activeId, variant]);
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} className={className} scrollWheelZoom zoomControl attributionControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {accuracy != null && accuracy > 15 && (
        <Circle center={[center.lat, center.lng]} radius={accuracy} pathOptions={{ color: "#2563eb", weight: 1, fillColor: "#2563eb", fillOpacity: 0.08 }} interactive={false} />
      )}
      <Marker position={[center.lat, center.lng]} icon={meIcon} keyboard={false}>
        <Tooltip direction="top" offset={[0, -8]}>You are here</Tooltip>
      </Marker>
      {places.map((p, i) => (
        <Marker
          key={p.id}
          position={[p.location.lat, p.location.lng]}
          icon={icons[i]}
          zIndexOffset={p.id === activeId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
          title={p.name}
          alt={p.name}
        >
          <Tooltip direction="top" offset={[0, -16]}>
            {p.name}
          </Tooltip>
        </Marker>
      ))}
      <FitBounds center={center} places={places} />
      <PanTo places={places} activeId={activeId} />
      <Resizer />
    </MapContainer>
  );
}
