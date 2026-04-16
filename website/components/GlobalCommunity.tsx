"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const API_URL = "https://web-production-34028.up.railway.app";

interface CountryData {
  country: string;
  users: number;
}

interface SchoolData {
  school: string;
  city: string | null;
  country: string | null;
}

interface GeoData {
  total_countries: number;
  total_schools: number;
  countries: CountryData[];
  schools: SchoolData[];
}

const COUNTRY_COORDS: Record<string, [number, number]> = {
  Afghanistan:[33,65],Albania:[41,20],Algeria:[28,3],Argentina:[-34,-64],
  Armenia:[40,45],Australia:[-25,134],Austria:[47.3,13.3],Azerbaijan:[40.5,47.5],
  Bahrain:[26,50.5],Bangladesh:[24,90],Belarus:[53.5,28],Belgium:[50.8,4],
  Bolivia:[-17,-65],Brazil:[-10,-55],Bulgaria:[43,25],Cambodia:[12.5,105],
  Cameroon:[6,12],Canada:[56,-106],Chile:[-35.7,-71.5],China:[35,105],
  Colombia:[4,-72],"Costa Rica":[10,-84],Croatia:[45.2,15.5],Cuba:[22,-80],
  Cyprus:[35,33],Czechia:[49.8,15.5],Denmark:[56,10],Ecuador:[-1.8,-78.2],
  Egypt:[27,30],Estonia:[59,26],Ethiopia:[8,38],Finland:[64,26],
  France:[46.6,2.5],Georgia:[42,43.5],Germany:[51.2,10.4],Ghana:[7.9,-1.2],
  Greece:[39,22],Guatemala:[15.5,-90.2],Honduras:[14.1,-87.2],
  "Hong Kong":[22.3,114.2],Hungary:[47.2,19.5],Iceland:[65,-18],India:[21,78],
  Indonesia:[-5,120],Iran:[32,53],Iraq:[33,44],Ireland:[53.4,-8],
  Israel:[31.5,34.8],Italy:[42.8,12.8],Jamaica:[18.1,-77.3],Japan:[36,138],
  Jordan:[31,36.6],Kazakhstan:[48,68],Kenya:[-1,38],Kuwait:[29.3,47.5],
  Latvia:[57,25],Lebanon:[33.9,35.8],Lithuania:[55.9,23.9],
  Luxembourg:[49.8,6.1],Malaysia:[4.2,101.9],Mexico:[23,-102],Morocco:[32,-5],
  Nepal:[28.2,84.2],Netherlands:[52.1,5.3],"New Zealand":[-41,174],
  Nigeria:[10,8],Norway:[62,10],Oman:[21,57],Pakistan:[30,69],Panama:[9,-80],
  Paraguay:[-23,-58],Peru:[-10,-76],Philippines:[13,122],Poland:[52,20],
  Portugal:[39.4,-8],Qatar:[25.3,51.2],Romania:[46,25],Russia:[60,100],
  "Saudi Arabia":[24,45],Senegal:[14.5,-14.5],Serbia:[44.8,20.5],
  Singapore:[1.35,103.8],Slovakia:[48.7,19.7],Slovenia:[46.1,14.8],
  "South Africa":[-29,24],"South Korea":[36,128],Spain:[40,-4],
  "Sri Lanka":[7.9,80.8],Sweden:[62,15],Switzerland:[46.8,8.2],
  Taiwan:[23.7,121],Tanzania:[-6.4,34.9],Thailand:[15.9,101],Tunisia:[34,9],
  Turkey:[39.9,32.9],"Türkiye":[39.9,32.9],UAE:[24,54],
  "United Arab Emirates":[24,54],Uganda:[1.4,32.3],Ukraine:[49,32],
  "United Kingdom":[54,-2],UK:[54,-2],"United States":[38,-97],USA:[38,-97],
  Uruguay:[-33,-56],Venezuela:[7,-66],Vietnam:[16.2,107.8],
};

function LeafletMap({ countries }: { countries: CountryData[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [25, 15],
        zoom: 2,
        minZoom: 2,
        maxZoom: 6,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { maxZoom: 18 }
      ).addTo(map);

      const maxUsers = Math.max(...countries.map((c) => c.users), 1);

      countries.forEach((c) => {
        const coords = COUNTRY_COORDS[c.country];
        if (!coords) return;

        const radius = Math.max(6, Math.min(24, 6 + (c.users / maxUsers) * 18));

        const pulseHtml = `
          <div style="position:relative;width:${radius * 2 + 16}px;height:${radius * 2 + 16}px">
            <div style="
              position:absolute;inset:0;
              border-radius:50%;
              background:rgba(74,124,89,0.15);
              animation:mapPulse 2.5s ease-in-out infinite;
            "></div>
            <div style="
              position:absolute;
              top:50%;left:50%;
              transform:translate(-50%,-50%);
              width:${radius * 2}px;height:${radius * 2}px;
              border-radius:50%;
              background:rgba(74,124,89,0.85);
              border:2px solid rgba(45,90,58,0.9);
              box-shadow:0 2px 8px rgba(74,124,89,0.4);
              display:flex;align-items:center;justify-content:center;
              color:#fff;font-weight:700;font-size:${radius >= 10 ? 11 : 0}px;
              font-family:Inter,system-ui,sans-serif;
            ">${radius >= 10 ? c.users : ""}</div>
          </div>
        `;

        const icon = L.divIcon({
          html: pulseHtml,
          className: "",
          iconSize: [radius * 2 + 16, radius * 2 + 16],
          iconAnchor: [radius + 8, radius + 8],
        });

        L.marker(coords as L.LatLngExpression, { icon })
          .addTo(map)
          .bindPopup(
            `<div style="text-align:center;font-family:Inter,system-ui,sans-serif;padding:4px 0">
              <div style="font-size:14px;font-weight:700;color:#2D4A32">${c.country}</div>
              <div style="font-size:22px;font-weight:800;color:#4A7C59;margin:2px 0">${c.users}</div>
              <div style="font-size:11px;color:#888">user${c.users !== 1 ? "s" : ""}</div>
            </div>`,
            { closeButton: false, className: "endura-popup" }
          );
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [countries]);

  return <div ref={mapRef} style={{ height: "100%", width: "100%" }} />;
}

const ACCENT_COLORS = [
  "#4A7C59", "#3d8b6e", "#2e7d6f", "#5b8c5a", "#6b9b7a",
  "#3a7054", "#528a65", "#447a5c", "#609678", "#4e8860",
];

function getInitials(name: string): string {
  return name
    .split(/[\s&,\-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function guessSchoolDomain(name: string): string | null {
  const lower = name.toLowerCase().trim();
  const known: Record<string, string> = {
    harvard: "harvard.edu",
    stanford: "stanford.edu",
    mit: "mit.edu",
    oxford: "ox.ac.uk",
    cambridge: "cam.ac.uk",
    yale: "yale.edu",
    princeton: "princeton.edu",
    columbia: "columbia.edu",
    uchicago: "uchicago.edu",
    berkeley: "berkeley.edu",
    imperial: "imperial.ac.uk",
    ucl: "ucl.ac.uk",
    lse: "lse.ac.uk",
    nyu: "nyu.edu",
    caltech: "caltech.edu",
    duke: "duke.edu",
    penn: "upenn.edu",
    cornell: "cornell.edu",
    brown: "brown.edu",
    dartmouth: "dartmouth.edu",
  };
  for (const [key, domain] of Object.entries(known)) {
    if (lower.includes(key)) return domain;
  }
  return null;
}

function SchoolChip({ school }: { school: SchoolData }) {
  const domain = guessSchoolDomain(school.school);
  const initials = getInitials(school.school);
  const color = getColor(school.school);

  return (
    <span className="inline-flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-xl text-sm font-medium text-forest-dark/70 shadow-sm border border-forest/5 flex-shrink-0">
      {domain ? (
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt=""
          width={28}
          height={28}
          className="rounded-md"
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            el.nextElementSibling?.removeAttribute("style");
          }}
        />
      ) : null}
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: color,
          color: "#fff",
          display: domain ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
          letterSpacing: "0.5px",
        }}
      >
        {initials}
      </span>
      {school.school}
    </span>
  );
}

function SchoolMarqueeWall({ schools }: { schools: SchoolData[] }) {
  const rows = [[] as SchoolData[], [] as SchoolData[], [] as SchoolData[]];
  schools.forEach((s, i) => rows[i % 3].push(s));

  const speeds = [35, 45, 38];
  const directions = ["normal", "reverse", "normal"];

  return (
    <div className="relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-cream to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-cream to-transparent z-10" />
      <div className="flex flex-col gap-3">
        {rows.map((row, ri) => (
          <div
            key={ri}
            className="flex gap-3 whitespace-nowrap"
            style={{
              animation: `marquee ${speeds[ri]}s linear infinite`,
              animationDirection: directions[ri],
            }}
          >
            {[...row, ...row].map((s, i) => (
              <SchoolChip key={`${ri}-${i}`} school={s} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GlobalCommunity() {
  const [data, setData] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/public/geography`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data || data.total_countries === 0) return null;

  return (
    <section className="py-20 bg-cream">
      {/* Leaflet CSS */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin="anonymous"
      />
      <style>{`
        @keyframes mapPulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.5); opacity: 0.05; }
        }
        .endura-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        }
        .endura-popup .leaflet-popup-tip {
          box-shadow: none;
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block bg-forest/10 text-forest-dark px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            Global Community
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-forest-dark tracking-tight mb-4">
            Students from <span className="text-forest-light">around the world</span>
          </h2>
          <p className="text-lg text-forest-dark/50 max-w-xl mx-auto">
            Endura users are studying and protecting wildlife across{" "}
            <strong className="text-forest-dark/70">{data.total_countries} countries</strong>.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex justify-center gap-8 sm:gap-16 mb-10"
        >
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-extrabold text-forest-dark">
              {data.total_countries}
            </div>
            <div className="text-sm text-forest-dark/50 mt-1">Countries</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-extrabold text-forest-dark">
              {data.total_schools}
            </div>
            <div className="text-sm text-forest-dark/50 mt-1">Schools &amp; Colleges</div>
          </div>
        </motion.div>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-2xl overflow-hidden shadow-lg shadow-forest/5 border border-forest/10 mb-12"
          style={{ height: 420 }}
        >
          <LeafletMap countries={data.countries} />
        </motion.div>

        {/* Schools — 3-row scrolling wall */}
        {data.schools.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h3 className="text-center text-sm font-semibold text-forest-dark/40 uppercase tracking-wider mb-5">
              Schools &amp; Colleges using Endura
            </h3>
            <SchoolMarqueeWall schools={data.schools} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
