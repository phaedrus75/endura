"use client";

import { motion } from "framer-motion";

const PILLARS = [
  {
    number: "01",
    title: "Habitat Protection",
    description:
      "Fund the preservation of critical ecosystems — from rainforests to coral reefs — where endangered species depend on every acre.",
  },
  {
    number: "02",
    title: "Anti-Poaching",
    description:
      "Support ranger patrols, surveillance tech, and community programmes that stand between endangered animals and extinction.",
  },
  {
    number: "03",
    title: "Species Recovery",
    description:
      "Back breeding programmes, wildlife corridors, and scientific research that bring species back from the brink.",
  },
];

export default function Mission() {
  return (
    <section
      id="mission"
      className="py-28 sm:py-36 bg-forest-dark relative overflow-hidden"
    >
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-forest-light/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-leaf/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Headline block */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 bg-white/[0.06] text-white/60 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-white/[0.06]">
            Endura × WWF
          </span>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
            Other apps give you streaks.
            <br />
            <span className="text-leaf">Endura gives you a reason.</span>
          </h2>

          <p className="mt-8 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            Every eco-credit you earn flows directly to WWF conservation
            projects. No middlemen. No vague promises. Your study hours
            fund real action for real animals.
          </p>
        </motion.div>

        {/* Impact pillars */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden mb-20"
        >
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              className="bg-forest-dark p-8 sm:p-10 group"
            >
              <span className="text-xs font-mono text-leaf/40 tracking-widest block mb-5">
                {pillar.number}
              </span>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
                {pillar.title}
              </h3>
              <p className="text-sm sm:text-base text-white/40 leading-relaxed">
                {pillar.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* WWF partnership callout */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="text-center space-y-8"
        >
          <div className="inline-flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-full px-6 py-3">
            <div className="w-2 h-2 rounded-full bg-leaf animate-pulse" />
            <span className="text-sm text-white/50">
              Direct integration — 100% of donations reach WWF projects
            </span>
          </div>

          <div>
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href="https://apps.apple.com/app/endura"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-white text-forest-dark px-8 py-4 rounded-full text-base font-semibold hover:bg-sand transition-colors shadow-lg shadow-black/20"
            >
              Start Studying, Start Saving
              <span className="text-lg">→</span>
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
