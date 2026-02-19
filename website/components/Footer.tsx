"use client";

import { motion } from "framer-motion";

const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Download", href: "#hero" },
  ],
  Foundation: [
    { label: "Our Mission", href: "#mission" },
    { label: "Conservation Partners", href: "#mission" },
    { label: "Get Involved", href: "mailto:hello@endura.eco" },
  ],
  Connect: [
    { label: "Instagram", href: "https://instagram.com/endura.eco" },
    { label: "TikTok", href: "https://tiktok.com/@endura.eco" },
    { label: "Contact Us", href: "mailto:hello@endura.eco" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-forest-dark text-white/60 pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <a href="#" className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🌿</span>
              <span className="text-xl font-bold text-white tracking-tight">
                endura
              </span>
            </a>
            <p className="text-sm leading-relaxed mb-6 max-w-xs">
              A youth-led initiative turning study time into conservation
              impact. Built by students, for students — and for the planet.
            </p>
            <div className="flex gap-4">
              {/* App Store Badges (placeholders) */}
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="#"
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
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="#"
                className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl px-4 py-2.5 flex items-center gap-2"
              >
                <span className="text-lg">▶️</span>
                <div>
                  <div className="text-[10px] text-white/40 leading-tight">
                    Get it on
                  </div>
                  <div className="text-xs font-semibold text-white leading-tight">
                    Google Play
                  </div>
                </div>
              </motion.a>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Endura Conservation Foundation.
            All rights reserved.
          </p>
          <p className="text-xs text-white/30 italic">
            &ldquo;Every study session saves a species.&rdquo;
          </p>
        </div>
      </div>
    </footer>
  );
}
