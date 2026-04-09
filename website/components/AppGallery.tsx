"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface Screen {
  id: string;
  title: string;
  description: string;
  badge: string;
  image: string;
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
  },
  {
    id: "home",
    title: "Subjects & Task Management",
    description:
      "Organise your study by subject, create to-dos with due dates, and track what needs doing. Everything in one place so you can focus on what matters.",
    badge: "📋",
    image: "/screenshots/home.png",
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
    title: "Badges & Study Tips",
    description:
      "Earn 50+ badges as you study and protect wildlife. Discover community-powered study tips with voting and sharing to help you and your friends study smarter.",
    badge: "🏅",
    image: "/screenshots/progress.png",
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const scrollToCard = (index: number) => {
    setActive(index);
    if (scrollRef.current) {
      const card = scrollRef.current.children[index] as HTMLElement;
      if (card) {
        const containerRect = scrollRef.current.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const scrollTarget =
          card.offsetLeft -
          containerRect.width / 2 +
          cardRect.width / 2;
        scrollRef.current.scrollTo({ left: scrollTarget, behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const containerCenter = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      Array.from(el.children).forEach((child, i) => {
        const childEl = child as HTMLElement;
        const childCenter = childEl.offsetLeft + childEl.clientWidth / 2;
        const dist = Math.abs(containerCenter - childCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      if (closest !== active) setActive(closest);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [active]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <section
      id="features"
      className="py-24 sm:py-32 bg-gradient-to-b from-cream via-sand/30 to-cream overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
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
        <div className="flex justify-center mb-10 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-2">
            {SCREENS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => scrollToCard(i)}
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

        {/* Carousel */}
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-8 px-[calc(50%-140px)] sm:px-[calc(50%-160px)] cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {SCREENS.map((screen, i) => (
            <motion.div
              key={screen.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="snap-center flex-shrink-0"
            >
              <div
                className={`transition-all duration-500 ${
                  active === i ? "scale-100" : "scale-[0.88] opacity-60"
                }`}
              >
                {/* Phone frame with screenshot */}
                <div className="w-[280px] sm:w-[300px] relative">
                  <div className="rounded-[2.5rem] border-[5px] border-white/80 shadow-2xl shadow-forest/15 overflow-hidden bg-black">
                    <Image
                      src={screen.image}
                      alt={screen.title}
                      width={300}
                      height={650}
                      className="w-full h-auto object-cover"
                      draggable={false}
                    />
                  </div>
                </div>
              </div>

              {/* Label + description beneath active phone */}
              <AnimatePresence mode="wait">
                {active === i && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="text-center mt-6 max-w-[300px]"
                  >
                    <p className="text-base font-bold text-forest-dark">
                      {screen.title}
                    </p>
                    <p className="text-sm text-forest-dark/50 mt-1.5 leading-relaxed">
                      {screen.description}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {SCREENS.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToCard(i)}
              className={`transition-all duration-300 rounded-full ${
                active === i
                  ? "w-6 h-2 bg-forest"
                  : "w-2 h-2 bg-forest-dark/15 hover:bg-forest-dark/30"
              }`}
              aria-label={`Go to screen ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
