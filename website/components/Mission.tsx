"use client";

import { motion } from "framer-motion";

const IMPACT_STATS = [
  { value: "20+", label: "Endangered Species", emoji: "🐾" },
  { value: "1000+", label: "Study Hours Logged", emoji: "📚" },
  { value: "50", label: "Badges to Earn", emoji: "🏅" },
  { value: "100%", label: "Youth-Led", emoji: "💚" },
];

const CONSERVATION_PARTNERS = [
  "Wildlife Trusts",
  "WWF-UK",
  "Zoological Society of London",
  "Fauna & Flora International",
];

export default function Mission() {
  return (
    <section
      id="mission"
      className="py-24 sm:py-32 bg-gradient-to-b from-forest-dark to-forest relative overflow-hidden"
    >
      {/* Background texture */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 text-8xl">🌿</div>
        <div className="absolute bottom-10 right-10 text-7xl">🌍</div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12rem] opacity-5">
          🦁
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-white/10 text-white/80 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            Endura Conservation Foundation
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
            Every study session
            <br />
            <span className="text-leaf">saves a species</span>
          </h2>
          <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Endura isn&apos;t just an app — it&apos;s a youth-led conservation
            movement. A portion of everything we earn goes directly to protecting
            endangered wildlife around the world.
          </p>
        </motion.div>

        {/* Impact Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-16"
        >
          {IMPACT_STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/10"
            >
              <span className="text-3xl block mb-2">{stat.emoji}</span>
              <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-white/50">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* How funds are used */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 sm:p-12 border border-white/10 mb-16"
        >
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            Where the funds go
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                emoji: "🏥",
                title: "Conservation Projects",
                desc: "Direct funding to on-the-ground wildlife protection and habitat restoration.",
              },
              {
                emoji: "🔬",
                title: "Species Research",
                desc: "Supporting scientific research into endangered species protection and breeding programs.",
              },
              {
                emoji: "📢",
                title: "Education & Awareness",
                desc: "Youth-led campaigns to raise awareness about endangered species in schools worldwide.",
              },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <span className="text-3xl block mb-3">{item.emoji}</span>
                <h4 className="text-base font-bold text-white mb-2">
                  {item.title}
                </h4>
                <p className="text-sm text-white/50 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Partners */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center"
        >
          <p className="text-sm text-white/30 uppercase tracking-widest mb-6">
            Aspiring Conservation Partners
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {CONSERVATION_PARTNERS.map((partner) => (
              <span
                key={partner}
                className="text-white/40 text-sm sm:text-base font-medium"
              >
                {partner}
              </span>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center mt-16"
        >
          <p className="text-white/40 text-sm mb-4">
            Registered as a Charitable Incorporated Organisation (CIO) in
            England & Wales
          </p>
          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            href="mailto:hello@endura.eco"
            className="inline-flex items-center gap-2 bg-white text-forest-dark px-8 py-4 rounded-full text-base font-semibold hover:bg-sand transition-colors"
          >
            <span>Get Involved</span>
            <span>→</span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
