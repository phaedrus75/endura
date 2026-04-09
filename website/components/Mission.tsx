"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const IMPACT_AREAS = [
  {
    title: "Habitat Protection",
    description: "Preserving critical ecosystems where endangered species live.",
  },
  {
    title: "Anti-Poaching",
    description: "Ranger patrols and tech protecting animals on the ground.",
  },
  {
    title: "Species Recovery",
    description: "Breeding programmes and research bringing species back.",
  },
];

export default function Mission() {
  return (
    <section
      id="mission"
      className="relative overflow-hidden"
    >
      {/* Photo mosaic band */}
      <div className="grid grid-cols-3 h-48 sm:h-64 lg:h-80">
        <div className="relative overflow-hidden">
          <Image
            src="/wildlife/savanna.jpg"
            alt="African savanna wildlife"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-forest-dark/30" />
        </div>
        <div className="relative overflow-hidden">
          <Image
            src="/wildlife/turtle.jpg"
            alt="Sea turtle in ocean"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-forest-dark/30" />
        </div>
        <div className="relative overflow-hidden">
          <Image
            src="/wildlife/orangutan.jpg"
            alt="Orangutan in natural habitat"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-forest-dark/30" />
        </div>
      </div>

      {/* Main content */}
      <div className="bg-forest-dark py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-14 lg:gap-20 items-center">
            {/* Left — donate screenshot (scaled up ~18%) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="flex-shrink-0 -mt-28 sm:-mt-36 lg:-mt-44 relative z-10"
            >
              <div className="w-[260px] sm:w-[305px] rounded-[2.25rem] border-[4px] border-white/20 overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
                <Image
                  src="/screenshots/donate.png"
                  alt="Endura WWF donation screen"
                  width={305}
                  height={661}
                  className="w-full h-auto object-cover"
                />
              </div>
            </motion.div>

            {/* Right — copy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex-1 text-center lg:text-left"
            >
              <span className="inline-flex items-center gap-2 bg-white/[0.06] text-white/60 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-white/[0.06]">
                Endura × WWF
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.15] mb-6">
                Study for yourself.
                <br />
                <span className="text-leaf">Donate for them.</span>
              </h2>

              <p className="text-base sm:text-lg text-white/50 leading-relaxed max-w-lg mx-auto lg:mx-0 mb-10">
                Endura has a built-in WWF integration. When you want to go
                beyond grades, you can donate directly to real conservation
                projects — right from the app. No pressure. Your choice,
                your impact.
              </p>

              {/* Impact areas */}
              <div className="space-y-4 mb-10">
                {IMPACT_AREAS.map((area, i) => (
                  <motion.div
                    key={area.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-leaf flex-shrink-0" />
                    <div className="text-left">
                      <span className="text-sm font-semibold text-white">
                        {area.title}
                      </span>
                      <span className="text-sm text-white/35 ml-1.5">
                        — {area.description}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start">
                <motion.a
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  href="https://apps.apple.com/app/endura-study-timer/id6759482612"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 bg-white text-forest-dark px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-sand transition-colors shadow-lg shadow-black/20"
                >
                  Download Endura
                  <span>→</span>
                </motion.a>
                <a
                  href="https://www.worldwildlife.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/40 hover:text-white/60 transition-colors underline underline-offset-4"
                >
                  Learn about WWF
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
