"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface Screen {
  id: string;
  title: string;
  description: string;
  badge: string;
  image: string;
  image2?: string;
}

const SCREENS: Screen[] = [
  {
    id: "timer",
    title: "Gamified Study Timer",
    description:
      "Set focused study sessions with our beautiful timer. Pick your subject, start the clock, and watch your egg grow closer to hatching with every minute you study.",
    badge: "⏳",
    image: "/screenshots/timer.png",
  },
  {
    id: "hatching",
    title: "Hatch Endangered Animals",
    description:
      "Complete study sessions to unlock an interactive hatching experience — tap to crack the egg and reveal one of 30+ real endangered species. Collect, nickname, and learn about each one.",
    badge: "🐣",
    image: "/screenshots/hatching.png",
    image2: "/screenshots/egg-crack.png",
  },
  {
    id: "home",
    title: "Subjects & Task Management",
    description:
      "Organise your study by subject, create to-dos with due dates, and track what needs doing. Everything in one place so you can focus on what matters.",
    badge: "📋",
    image: "/screenshots/progress.png",
    image2: "/screenshots/todos.png",
  },
  {
    id: "friends",
    title: "Study With Friends",
    description:
      "Join groups, set group goals by subject, compete on weekly and all-time leaderboards, and react to friends' achievements. Studying is better together.",
    badge: "👥",
    image: "/screenshots/friends.png",
  },
  {
    id: "sanctuary",
    title: "Sanctuary & Shop",
    description:
      "Build a beautiful habitat for your animals. Spend eco-credits in the shop on accessories and decorations. Make your sanctuary uniquely yours.",
    badge: "🏡",
    image: "/screenshots/sanctuary.png",
  },
  {
    id: "progress",
    title: "Study Tips",
    description:
      "Earn 50+ badges as you study and protect wildlife. Discover community-powered study tips with voting and sharing to help you and your friends study smarter.",
    badge: "🏅",
    image: "/screenshots/tips.png",
    image2: "/screenshots/shop.png",
  },
  {
    id: "donate",
    title: "Take Action",
    description:
      "Donate directly to WWF conservation projects straight from the app. 100% goes to protecting endangered wildlife — no middlemen, no detours.",
    badge: "💚",
    image: "/screenshots/donate.png",
  },
];

export default function AppGallery() {
  const [active, setActive] = useState(0);
  const screen = SCREENS[active];

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
          className="text-center mb-12"
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

        {/* Tab pills */}
        <div className="flex justify-center mb-12 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-2">
            {SCREENS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  active === i
                    ? "bg-forest text-white shadow-md shadow-forest/20"
                    : "bg-white/70 text-forest-dark/60 hover:bg-white hover:text-forest-dark"
                }`}
              >
                <span className="text-sm">{s.badge}</span>
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content: phone + text side by side */}
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16 max-w-4xl mx-auto">
          {/* Phone screenshot(s) */}
          <div className="flex-shrink-0 flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
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
          <div className="flex-1 text-center lg:text-left min-h-[160px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <span className="text-3xl block mb-3">{screen.badge}</span>
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

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-12">
          {SCREENS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`transition-all duration-300 rounded-full ${
                active === i
                  ? "w-6 h-2 bg-forest"
                  : "w-2 h-2 bg-forest-dark/15 hover:bg-forest-dark/30"
              }`}
              aria-label={`Go to feature ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
