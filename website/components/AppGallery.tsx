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
    title: "Gamified Study Timer",
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
    title: "Subjects & Task Management",
    description:
      "Organise your study by subject, create to-dos with due dates, and track what needs doing. Everything in one place so you can focus on what matters.",
    image: "/screenshots/progress.png",
    image2: "/screenshots/todos.png",
  },
  {
    id: "friends",
    title: "Study With Friends",
    description:
      "Join groups, set group goals by subject, compete on weekly and all-time leaderboards, and react to friends' achievements. Studying is better together.",
    image: "/screenshots/friends.png",
  },
  {
    id: "sanctuary",
    title: "Sanctuary & Shop",
    description:
      "Build a beautiful habitat for your animals. Spend eco-credits in the shop on accessories and decorations. Make your sanctuary uniquely yours.",
    image: "/screenshots/sanctuary.png",
  },
  {
    id: "progress",
    title: "Study Tips",
    description:
      "Earn 50+ badges as you study and protect wildlife. Discover community-powered study tips with voting and sharing to help you and your friends study smarter.",
    image: "/screenshots/tips.png",
    image2: "/screenshots/shop.png",
  },
  {
    id: "donate",
    title: "Take Action",
    description:
      "Donate directly to WWF conservation projects straight from the app. 100% goes to protecting endangered wildlife — no middlemen, no detours.",
    image: "/screenshots/donate.png",
  },
];

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

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section
      id="features"
      className="py-24 sm:py-32 bg-gradient-to-b from-cream via-sand/30 to-cream overflow-hidden"
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
            Studying that actually
            <br />
            <span className="text-forest-light">makes a difference</span>
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
          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="hidden lg:flex absolute -left-14 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white border border-forest-dark/10 text-forest-dark/40 hover:text-forest-dark hover:border-forest-dark/20 hover:shadow-md transition-all z-10"
            aria-label="Previous feature"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={next}
            className="hidden lg:flex absolute -right-14 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white border border-forest-dark/10 text-forest-dark/40 hover:text-forest-dark hover:border-forest-dark/20 hover:shadow-md transition-all z-10"
            aria-label="Next feature"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            {/* Phone screenshot(s) */}
            <div className="flex-shrink-0 flex justify-center">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={screen.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className={`flex items-center ${screen.image2 ? "gap-4" : ""}`}
                >
                  {screen.image2 && (
                    <div className="w-[170px] sm:w-[190px]">
                      <div className="rounded-[1.75rem] border-[3.5px] border-white/80 shadow-xl shadow-forest/10 overflow-hidden bg-black">
                        <Image
                          src={screen.image2}
                          alt={`${screen.title} — step 1`}
                          width={190}
                          height={412}
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    </div>
                  )}
                  <div className={screen.image2 ? "w-[170px] sm:w-[190px]" : "w-[220px] sm:w-[240px]"}>
                    <div className={`${screen.image2 ? "rounded-[1.75rem] border-[3.5px]" : "rounded-[2rem] border-[4px]"} border-white/80 shadow-2xl shadow-forest/15 overflow-hidden bg-black`}>
                      <Image
                        src={screen.image}
                        alt={screen.title}
                        width={screen.image2 ? 190 : 240}
                        height={screen.image2 ? 412 : 520}
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Text content */}
            <div className="flex-1 text-center lg:text-left min-h-[180px] flex flex-col justify-center">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={screen.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
                >
                  <span className="text-sm font-mono text-forest-light/60 tracking-wider mb-3 block">
                    {pad(active + 1)} / {pad(SCREENS.length)}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-forest-dark mb-4">
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
          <div className="flex items-center justify-center gap-6 mt-10 lg:hidden">
            <button
              onClick={prev}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-forest-dark/10 text-forest-dark/40 hover:text-forest-dark transition-all"
              aria-label="Previous feature"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
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
            <button
              onClick={next}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-forest-dark/10 text-forest-dark/40 hover:text-forest-dark transition-all"
              aria-label="Next feature"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Desktop progress bar */}
          <div className="hidden lg:flex justify-center gap-1.5 mt-10">
            {SCREENS.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`transition-all duration-300 rounded-full ${
                  active === i
                    ? "w-8 h-1.5 bg-forest"
                    : "w-1.5 h-1.5 bg-forest-dark/15 hover:bg-forest-dark/30"
                }`}
                aria-label={`Go to feature ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
