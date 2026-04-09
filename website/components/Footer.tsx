"use client";

import { motion } from "framer-motion";
import Image from "next/image";

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 4L12 13 2 4" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
    </svg>
  );
}

const CONNECT_LINKS = [
  { label: "Instagram", href: "https://instagram.com/endura.eco", icon: InstagramIcon },
  { label: "Email", href: "mailto:hello@endura.eco", icon: MailIcon },
  { label: "Gmail", href: "https://mail.google.com/mail/?view=cm&to=hello@endura.eco", icon: GmailIcon },
];

export default function Footer() {
  return (
    <footer className="bg-forest text-white/60 pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 mb-12">
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
          <div>
            <h4 className="text-base font-semibold text-white mb-5 uppercase tracking-wider">
              Connect
            </h4>
            <ul className="space-y-4">
              {CONNECT_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-base text-white/60 hover:text-white transition-colors"
                  >
                    <link.icon />
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
