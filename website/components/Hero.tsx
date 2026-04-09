"use client";

import { motion } from "framer-motion";
import Image from "next/image";

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
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-forest-dark leading-tight tracking-tight">
            You get the grades.
            <br />
            <span className="text-forest-light">The animals get to live.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-forest-dark/60 max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Endura turns every focused study session into an endangered animal
            you hatch, collect, and protect. Finally, a reason to sit down and
            do the work.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              href="https://apps.apple.com/app/endura-study-timer/id6759482612"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-forest text-white px-8 py-4 rounded-full text-base font-semibold shadow-lg shadow-forest/25 hover:bg-forest-dark transition-colors"
            >
              Download on the App Store
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              href="#features"
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
              <span className="text-leaf">●</span> 30+ endangered species
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
            <div className="w-[280px] sm:w-[300px] rounded-[2.5rem] border-[5px] border-white/80 shadow-2xl shadow-forest/20 overflow-hidden bg-black">
              <Image
                src="/screenshots/home.png"
                alt="Endura home screen"
                width={300}
                height={650}
                className="w-full h-auto object-cover"
                priority
              />
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
      <motion.a
        href="#features"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 group"
      >
        <span className="text-xs font-medium text-forest-dark/30 tracking-widest uppercase">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-forest-dark/30 group-hover:text-forest-dark/50 transition-colors">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </motion.a>
    </section>
  );
}
