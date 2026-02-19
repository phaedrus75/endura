"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-sage-light/40 via-cream to-cream"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-6xl opacity-20 animate-float">
          🌿
        </div>
        <div className="absolute top-40 right-16 text-5xl opacity-15 animate-float-delay">
          🦋
        </div>
        <div className="absolute bottom-32 left-20 text-4xl opacity-20 animate-float-delay-2">
          🌱
        </div>
        <div className="absolute bottom-20 right-10 text-5xl opacity-15 animate-float">
          🐾
        </div>
        <div className="absolute top-1/3 right-1/4 text-3xl opacity-10 animate-float-delay">
          🍀
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        {/* Text Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex-1 text-center lg:text-left"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-forest/10 text-forest-dark px-4 py-2 rounded-full text-sm font-medium mb-6"
          >
            <span>🌍</span>
            <span>Youth-led conservation through education</span>
          </motion.div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-forest-dark leading-tight tracking-tight">
            Study smarter.
            <br />
            <span className="text-forest-light">Save species.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-forest-dark/60 max-w-lg mx-auto lg:mx-0 leading-relaxed">
            A gamified study app that turns your focus time into real
            conservation impact. Hatch endangered animals, build sanctuaries,
            and protect wildlife — one session at a time.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              href="#mission"
              className="bg-forest text-white px-8 py-4 rounded-full text-base font-semibold shadow-lg shadow-forest/25 hover:bg-forest-dark transition-colors"
            >
              Join the Waitlist
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              href="#how-it-works"
              className="border-2 border-forest/20 text-forest-dark px-8 py-4 rounded-full text-base font-semibold hover:border-forest/40 transition-colors"
            >
              See How It Works
            </motion.a>
          </div>

          <div className="mt-10 flex items-center gap-6 justify-center lg:justify-start text-sm text-forest-dark/50">
            <span className="flex items-center gap-1.5">
              <span className="text-leaf">●</span> Free to use
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-leaf">●</span> 20+ endangered species
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-leaf">●</span> Real impact
            </span>
          </div>
        </motion.div>

        {/* App Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          className="flex-1 flex justify-center"
        >
          <div className="relative">
            {/* Phone frame */}
            <div className="w-[280px] h-[580px] sm:w-[300px] sm:h-[620px] bg-gradient-to-b from-sage-light to-sage rounded-[3rem] shadow-2xl shadow-forest/20 border-[6px] border-white/80 overflow-hidden relative">
              {/* Status bar */}
              <div className="h-12 bg-forest-dark/5 flex items-center justify-center">
                <div className="w-24 h-5 bg-forest-dark/10 rounded-full" />
              </div>

              {/* App content mockup */}
              <div className="p-5 flex flex-col items-center gap-4">
                <div className="text-4xl mt-2">🥚</div>
                <div className="w-32 h-32 bg-white/60 rounded-full flex items-center justify-center">
                  <div className="text-6xl animate-float">🐣</div>
                </div>
                <div className="text-center mt-2">
                  <p className="text-sm font-bold text-forest-dark">
                    Study to Hatch Me!
                  </p>
                  <p className="text-xs text-forest-dark/50 mt-1">
                    Amur Leopard — Critically Endangered
                  </p>
                </div>

                {/* Timer mockup */}
                <div className="w-full bg-white/70 rounded-2xl p-4 mt-2 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-forest-dark/60">
                      Study Session
                    </span>
                    <span className="text-xs text-forest-light font-bold">
                      45:00
                    </span>
                  </div>
                  <div className="h-2 bg-sage-light rounded-full overflow-hidden">
                    <div className="h-full w-3/5 bg-forest-light rounded-full" />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-3 mt-2">
                  {[
                    { emoji: "🔥", label: "12" },
                    { emoji: "🐾", label: "8" },
                    { emoji: "🍀", label: "300" },
                  ].map((s) => (
                    <div
                      key={s.emoji}
                      className="bg-white/60 rounded-xl px-3 py-2 flex items-center gap-1.5"
                    >
                      <span className="text-sm">{s.emoji}</span>
                      <span className="text-xs font-bold text-forest-dark">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating decorations around phone */}
            <div className="absolute -top-4 -right-4 text-3xl animate-float-delay">
              🌸
            </div>
            <div className="absolute -bottom-2 -left-6 text-2xl animate-float-delay-2">
              🌿
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-6 h-10 border-2 border-forest-dark/20 rounded-full flex items-start justify-center p-1.5"
        >
          <div className="w-1.5 h-2.5 bg-forest-dark/30 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
