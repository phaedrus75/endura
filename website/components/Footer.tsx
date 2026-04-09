"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const CONNECT_LINKS = [
  { label: "Instagram", href: "https://instagram.com/endura.eco" },
  { label: "Contact Us", href: "mailto:hello@endura.eco" },
];

export default function Footer() {
  return (
    <footer className="bg-forest-dark text-white/60 pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          {/* Brand */}
          <div>
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <Image
                src="/endura-logo.png"
                alt="Endura logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-white tracking-tight">
                endura
              </span>
            </a>
            <p className="text-sm leading-relaxed mb-6 max-w-xs">
              A youth-led initiative turning study time into conservation
              impact. Built by students, for students — and for the planet.
            </p>
            <div className="flex gap-4">
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="https://apps.apple.com/app/endura-study-timer/id6759482612"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl px-4 py-2.5 flex items-center gap-2"
              >
                <span className="text-lg">🍎</span>
                <div>
                  <div className="text-[10px] text-white/40 leading-tight">
                    Download on the
                  </div>
                  <div className="text-xs font-semibold text-white leading-tight">
                    App Store
                  </div>
                </div>
              </motion.a>
              <div className="bg-white/10 rounded-xl px-4 py-2.5 flex items-center gap-2 opacity-60">
                <span className="text-lg">▶️</span>
                <div>
                  <div className="text-[10px] text-white/40 leading-tight">
                    Coming soon on
                  </div>
                  <div className="text-xs font-semibold text-white leading-tight">
                    Google Play
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Connect */}
          <div className="flex flex-col items-start lg:items-end">
            <h4 className="text-base font-semibold text-white mb-5 uppercase tracking-wider">
              Connect
            </h4>
            <ul className="space-y-4">
              {CONNECT_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-base hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Endura. All rights reserved.
          </p>
          <p className="text-xs text-white/30 italic">
            &ldquo;Every study session saves a species.&rdquo;
          </p>
        </div>
      </div>
    </footer>
  );
}
