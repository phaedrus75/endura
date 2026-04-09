"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface Screen {
  id: string;
  title: string;
  description: string;
  image: string;
  image2?: string;
}

const SCREENS: Screen[] = [
  {
    id: "timer",
    title: "Study Timer",
    description:
      "Set focused study sessions with our beautiful timer. Pick your subject, start the clock, and watch your egg grow closer to hatching with every minute you study.",
    image: "/screenshots/timer.png",
  },
  {
    id: "hatching",
    title: "Hatch Endangered Animals",
    description:
      "Complete study sessions to unlock an interactive hatching experience — tap to crack the egg and reveal one of 30+ real endangered species. Collect, nickname, and learn about each one.",
    image: "/screenshots/hatching.png",
    image2: "/screenshots/egg-crack.png",
  },
  {
    id: "home",
    title: "To-Dos & Progress",
    description:
      "Organise your study by subject, create to-dos with due dates, and track your weekly stats. Everything in one place so you can focus on what matters.",
    image: "/screenshots/progress.png",
    image2: "/screenshots/todos.png",
  },
  {
    id: "friends",
    title: "Study With Friends",
    description:
      "Join groups, set group goals by subject, compete on weekly and all-time leaderboards, and react to friends' achievements. Studying is better together.",
    image: "/screenshots/friends.png",
    image2: "/screenshots/groups.png",
  },
  {
    id: "sanctuary",
    title: "Sanctuary & Shop",
    description:
      "Build a beautiful habitat for your animals. Spend eco-credits in the shop on accessories and decorations. Make your sanctuary uniquely yours.",
    image: "/screenshots/shop.png",
    image2: "/screenshots/sanctuary.png",
  },
  {
    id: "progress",
    title: "Study Tips",
    description:
      "Earn 50+ badges as you study and protect wildlife. Discover community-powered study tips with voting and sharing to help you and your friends study smarter.",
    image: "/screenshots/tips.png",
  },
  {
    id: "donate",
    title: "Take Action",
    description:
      "Donate directly to WWF conservation projects straight from the app. 100% goes to protecting endangered wildlife.",
    image: "/screenshots/donate.png",
  },
];

function ArrowLeft({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ArrowRight({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function AppGallery() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(0);
  const screen = SCREENS[active];

  const go = useCallback(
    (idx: number) => {
      setDirection(idx > active ? 1 : -1);
      setActive(idx);
    },
    [active]
  );

  const prev = () => go((active - 1 + SCREENS.length) % SCREENS.length);
  const next = () => go((active + 1) % SCREENS.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const slideVariants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 60 : -60 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -60 : 60 }),
  };

  const textVariants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section
      id="features"
      className="py-24 sm:py-32 bg-gradient-to-b from-forest-dark/[0.04] via-forest/[0.07] to-forest-dark/[0.04] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-block bg-forest/10 text-forest-dark px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            Why Endura?
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-forest-dark tracking-tight">
            A closer <span className="text-forest-light">look</span>
          </h2>
          <p className="mt-4 text-lg text-forest-dark/50 max-w-2xl mx-auto">
            Every feature is designed to keep you focused, motivated, and
            connected to something bigger than grades.
          </p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex justify-center mb-12 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1.5 border border-forest-dark/5">
            {SCREENS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                className={`relative px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  active === i
                    ? "text-white"
                    : "text-forest-dark/50 hover:text-forest-dark/80"
                }`}
              >
                {active === i && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-forest rounded-xl shadow-md shadow-forest/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="relative max-w-5xl mx-auto">
          {/* Desktop navigation arrows — inset, refined style */}
          <motion.button
            onClick={prev}
            whileHover={{ scale: 1.08, backgroundColor: "rgba(47, 74, 62, 0.12)" }}
            whileTap={{ scale: 0.92 }}
            className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-forest-dark/10 text-forest-dark/60 shadow-md transition-all z-10"
            aria-label="Previous feature"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <motion.button
            onClick={next}
            whileHover={{ scale: 1.08, backgroundColor: "rgba(47, 74, 62, 0.12)" }}
            whileTap={{ scale: 0.92 }}
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-forest-dark/10 text-forest-dark/60 shadow-md transition-all z-10"
            aria-label="Next feature"
          >
            <ArrowRight size={20} />
          </motion.button>

          {/* Fixed-height content container to prevent jumpiness */}
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16 lg:min-h-[520px]">
            {/* Phone screenshot(s) — uniform container width */}
            <div className="flex-shrink-0 flex justify-center items-center w-full lg:w-[420px]">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={screen.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex items-center justify-center ${screen.image2 ? "gap-3 sm:gap-4" : ""}`}
                >
                  {screen.image2 && (
                    <div className="w-[160px] sm:w-[180px]">
                      <div className="rounded-[1.75rem] border-[3.5px] border-white/80 shadow-xl shadow-forest/10 overflow-hidden bg-black">
                        <Image
                          src={screen.image2}
                          alt={`${screen.title} — step 1`}
                          width={180}
                          height={390}
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    </div>
                  )}
                  <div className={screen.image2 ? "w-[160px] sm:w-[180px]" : "w-[220px] sm:w-[240px]"}>
                    <div className={`${screen.image2 ? "rounded-[1.75rem] border-[3.5px]" : "rounded-[2rem] border-[4px]"} border-white/80 shadow-2xl shadow-forest/15 overflow-hidden bg-black`}>
                      <Image
                        src={screen.image}
                        alt={screen.title}
                        width={screen.image2 ? 180 : 240}
                        height={screen.image2 ? 390 : 520}
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Text content — fixed width to prevent reflow */}
            <div className="flex-1 text-center lg:text-left flex flex-col justify-center lg:min-h-[280px]">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={screen.id}
                  custom={direction}
                  variants={textVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                >
                  <span className="text-sm font-mono text-forest-light/50 tracking-widest mb-4 block">
                    {pad(active + 1)} / {pad(SCREENS.length)}
                  </span>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-forest-dark mb-5 tracking-tight">
                    {screen.title}
                  </h3>
                  <p className="text-base sm:text-lg text-forest-dark/55 leading-relaxed max-w-md mx-auto lg:mx-0">
                    {screen.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile prev/next + progress */}
          <div className="flex items-center justify-center gap-5 mt-10 lg:hidden">
            <motion.button
              onClick={prev}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-forest-dark/10 text-forest-dark/60 shadow-md"
              aria-label="Previous feature"
            >
              <ArrowLeft size={18} />
            </motion.button>
            <div className="flex gap-1.5">
              {SCREENS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className={`transition-all duration-300 rounded-full ${
                    active === i
                      ? "w-6 h-1.5 bg-forest"
                      : "w-1.5 h-1.5 bg-forest-dark/15 hover:bg-forest-dark/30"
                  }`}
                  aria-label={`Go to feature ${i + 1}`}
                />
              ))}
            </div>
            <motion.button
              onClick={next}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-forest-dark/10 text-forest-dark/60 shadow-md"
              aria-label="Next feature"
            >
              <ArrowRight size={18} />
            </motion.button>
          </div>
        </div>
      </div>
    </section>
  );
}
