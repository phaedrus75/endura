"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

const API_URL = "https://web-production-34028.up.railway.app";
const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

/* Equirectangular projection — simple, lightweight */
const W = 960;
const H = 500;
function projectLng(lng: number) { return ((lng + 180) / 360) * W; }
function projectLat(lat: number) { return ((90 - lat) / 180) * H; }

function projectCoords(coords: number[]): string {
  return `${projectLng(coords[0])},${projectLat(coords[1])}`;
}

function ringToPath(ring: number[][]): string {
  return ring.map((pt, i) => `${i === 0 ? "M" : "L"}${projectCoords(pt)}`).join("") + "Z";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function geoToPath(geometry: any): string {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringToPath).join(" ");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((poly: number[][][]) => poly.map(ringToPath).join(" "))
      .join(" ");
  }
  return "";
}

interface WorldMapProps {
  countries: CountryData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoFeatures: any[];
}

function WorldMap({ countries, geoFeatures }: WorldMapProps) {
  const maxUsers = Math.max(...countries.map((c) => c.users), 1);

  const pins = useMemo(
    () =>
      countries
        .map((c) => {
          const coords = COUNTRY_COORDS[c.country];
          if (!coords) return null;
          const x = projectLng(coords[1]);
          const y = projectLat(coords[0]);
          const r = Math.max(5, Math.min(18, 5 + (c.users / maxUsers) * 13));
          return { ...c, x, y, r };
        })
        .filter(Boolean) as {
        country: string;
        users: number;
        x: number;
        y: number;
        r: number;
      }[],
    [countries, maxUsers]
  );

  const [hoveredPin, setHoveredPin] = useState<number | null>(null);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ background: "#f0f7f2" }}>
      {/* Country shapes */}
      {geoFeatures.map((feat, i) => (
        <path
          key={i}
          d={geoToPath(feat.geometry)}
          fill="#dceade"
          stroke="#c3d8c6"
          strokeWidth="0.5"
        />
      ))}

      {/* Pulsing glow + pin for each country */}
      {pins.map((p, i) => (
        <g
          key={i}
          onMouseEnter={() => setHoveredPin(i)}
          onMouseLeave={() => setHoveredPin(null)}
          style={{ cursor: "pointer" }}
        >
          {/* Outer glow */}
          <circle cx={p.x} cy={p.y} r={p.r + 5} fill="#4A7C59" opacity="0.12">
            <animate attributeName="r" values={`${p.r + 3};${p.r + 8};${p.r + 3}`} dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.12;0.06;0.12" dur="3s" repeatCount="indefinite" />
          </circle>
          {/* Main dot */}
          <circle
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="#4A7C59"
            opacity="0.85"
            stroke="#2d5a3a"
            strokeWidth="1.5"
          />
          {/* User count inside larger dots */}
          {p.r >= 8 && (
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fill="#fff"
              fontSize="10"
              fontWeight="700"
              style={{ pointerEvents: "none" }}
            >
              {p.users}
            </text>
          )}
          {/* Tooltip on hover */}
          {hoveredPin === i && (
            <g>
              <rect
                x={p.x - 50}
                y={p.y - p.r - 34}
                width="100"
                height="26"
                rx="6"
                fill="#1a2e22"
                opacity="0.92"
              />
              <polygon
                points={`${p.x - 5},${p.y - p.r - 8} ${p.x + 5},${p.y - p.r - 8} ${p.x},${p.y - p.r - 2}`}
                fill="#1a2e22"
                opacity="0.92"
              />
              <text
                x={p.x}
                y={p.y - p.r - 17}
                textAnchor="middle"
                fill="#fff"
                fontSize="11"
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                {p.country} — {p.users} user{p.users !== 1 ? "s" : ""}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function GlobalCommunity() {
  const [data, setData] = useState<GeoData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoFeatures, setGeoFeatures] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/public/geography`).then((r) => r.json()),
      fetch(TOPO_URL).then((r) => r.json()),
    ])
      .then(([geoData, topo]) => {
        setData(geoData);
        const countries = feature(
          topo as Topology,
          topo.objects.countries as GeometryCollection
        );
        setGeoFeatures(countries.features);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data || data.total_countries === 0 || !geoFeatures) return null;

  return (
    <section className="py-20 bg-cream">
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
        >
          <WorldMap countries={data.countries} geoFeatures={geoFeatures} />
        </motion.div>

        {/* Schools */}
        {data.schools.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h3 className="text-center text-sm font-semibold text-forest-dark/40 uppercase tracking-wider mb-6">
              Schools &amp; Colleges using Endura
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {data.schools.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-full text-sm font-medium text-forest-dark/70 shadow-sm border border-forest/5"
                >
                  <span className="text-forest-light">🏫</span>
                  {s.school}
                  {s.country && (
                    <span className="text-forest-dark/30 text-xs">· {s.country}</span>
                  )}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
