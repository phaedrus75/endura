"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    number: "01",
    emoji: "📚",
    title: "Study",
    description:
      "Choose from your subjects, set a timer, and focus. Our distraction-free timer keeps you on track with gentle motivation — leave early and your egg might not make it!",
    accent: "bg-forest-light",
  },
  {
    number: "02",
    emoji: "🐣",
    title: "Hatch",
    description:
      "Complete your session and tap to crack open your egg in an interactive hatching experience. Discover one of 30+ real endangered species, learn about its conservation status, and earn eco-credits.",
    accent: "bg-leaf",
  },
  {
    number: "03",
    emoji: "🌍",
    title: "Protect",
    description:
      "Your study hours translate to real impact. Donate directly to WWF from inside the app — no middlemen, no detours. The more you study, the more species you help save.",
    accent: "bg-forest",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32 bg-gradient-to-b from-cream to-sand/40"
    >
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="inline-block bg-forest/10 text-forest-dark px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            Simple as 1-2-3
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-forest-dark tracking-tight">
            How it works
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-forest-light/20 via-leaf/30 to-forest/20 -translate-y-1/2" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                className="relative text-center"
              >
                {/* Step circle */}
                <div className="relative inline-block mb-6">
                  <div
                    className={`w-24 h-24 ${step.accent} rounded-full flex items-center justify-center shadow-lg relative z-10`}
                  >
                    <span className="text-4xl">{step.emoji}</span>
                  </div>
                  <div
                    className={`absolute -inset-2 ${step.accent} rounded-full opacity-20 animate-pulse`}
                  />
                </div>

                <div className="text-xs font-bold text-forest-dark/30 tracking-widest uppercase mb-2">
                  Step {step.number}
                </div>
                <h3 className="text-2xl font-bold text-forest-dark mb-3">
                  {step.title}
                </h3>
                <p className="text-forest-dark/55 leading-relaxed max-w-sm mx-auto">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Arrow flow on mobile */}
        <div className="lg:hidden flex justify-center mt-4">
          <span className="text-forest-dark/20 text-sm tracking-wider">
            study → hatch → protect
          </span>
        </div>
      </div>
    </section>
  );
}
