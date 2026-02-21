"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Screen {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  bg: string;
  content: React.ReactNode;
}

const SCREENS: Screen[] = [
  {
    id: "home",
    title: "Home",
    subtitle: "Your daily dashboard",
    badge: "🏠",
    bg: "from-[#E7EFEA] to-[#F2F8F4]",
    content: (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-1 mb-3">
          <div>
            <p className="text-[10px] text-[#5E7F6E]">Good morning</p>
            <p className="text-sm font-bold text-[#2F4A3E]">Rhea</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#5E7F6E]/20 flex items-center justify-center text-xs">
            R
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          {[
            { icon: "🔥", val: "12", label: "Streak" },
            { icon: "🐾", val: "8", label: "Animals" },
            { icon: "⏱", val: "6.5h", label: "This week" },
          ].map((c) => (
            <div
              key={c.label}
              className="flex-1 bg-white/70 rounded-xl px-2 py-2 text-center"
            >
              <span className="text-xs">{c.icon}</span>
              <p className="text-xs font-bold text-[#2F4A3E] leading-tight">
                {c.val}
              </p>
              <p className="text-[8px] text-[#5E7F6E]">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-white/60 rounded-2xl p-3 mb-3">
          <p className="text-[10px] font-bold text-[#2F4A3E] mb-2">
            My Recent Hatches
          </p>
          <div className="flex gap-3 justify-center">
            {["🐆", "🦏", "🐘", "🦁"].map((a, i) => (
              <div
                key={i}
                className="w-10 h-10 bg-[#E7EFEA] rounded-xl flex items-center justify-center text-lg"
              >
                {a}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white/60 rounded-2xl p-3">
          <p className="text-[10px] font-bold text-[#2F4A3E] mb-2">
            Today&apos;s To-Dos
          </p>
          {["Biology revision", "Maths practice"].map((t) => (
            <div
              key={t}
              className="flex items-center gap-2 py-1.5 border-b border-[#E7EFEA] last:border-0"
            >
              <div className="w-3.5 h-3.5 rounded border-2 border-[#5E7F6E]/40" />
              <span className="text-[10px] text-[#2F4A3E]">{t}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "timer",
    title: "Study Timer",
    subtitle: "Focus mode with egg hatching",
    badge: "⏳",
    bg: "from-[#E7EFEA] to-[#D4E8DE]",
    content: (
      <div className="flex flex-col items-center h-full justify-center">
        <p className="text-[10px] text-[#5E7F6E] font-medium mb-1">
          Biology — Chapter 4
        </p>
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#E7EFEA"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="url(#timerGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42 * 0.65} ${2 * Math.PI * 42}`}
            />
            <defs>
              <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5E7F6E" />
                <stop offset="100%" stopColor="#81C784" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl mb-0.5">🥚</span>
            <span className="text-lg font-bold text-[#2F4A3E]">29:15</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="bg-white/70 rounded-full px-4 py-1.5 text-[10px] font-semibold text-[#5E7F6E]">
            Pause
          </div>
          <div className="bg-[#5E7F6E] rounded-full px-4 py-1.5 text-[10px] font-semibold text-white">
            End Session
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "sanctuary",
    title: "Sanctuary",
    subtitle: "Your animal collection",
    badge: "🏡",
    bg: "from-[#D4E8DE] to-[#E7EFEA]",
    content: (
      <div className="flex flex-col h-full">
        <p className="text-sm font-bold text-[#2F4A3E] mb-1">My Sanctuary</p>
        <p className="text-[9px] text-[#5E7F6E] mb-3">8 animals collected</p>
        <div className="flex-1 bg-gradient-to-b from-[#87CEEB]/30 to-[#90EE90]/30 rounded-2xl p-3 relative overflow-hidden mb-3">
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#228B22]/20 to-transparent rounded-b-2xl" />
          <div className="grid grid-cols-4 gap-2 relative z-10 mt-6">
            {["🐆", "🦏", "🐘", "🦁", "🐼", "🦒", "🐯", "🐧"].map(
              (a, i) => (
                <div
                  key={i}
                  className="flex items-end justify-center text-xl h-8"
                >
                  {a}
                </div>
              )
            )}
          </div>
        </div>
        <div className="bg-white/60 rounded-xl p-2.5 flex items-center gap-2">
          <span className="text-sm">🤝</span>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-[#2F4A3E]">Take Action</p>
            <p className="text-[8px] text-[#5E7F6E]">
              $127 raised by our community
            </p>
          </div>
          <span className="text-[10px] text-[#5E7F6E]">→</span>
        </div>
      </div>
    ),
  },
  {
    id: "hatching",
    title: "Hatching",
    subtitle: "The magical reveal",
    badge: "🐣",
    bg: "from-[#C2DDD0] to-[#E7EFEA]",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-24 h-24 bg-white/50 rounded-full flex items-center justify-center mb-4 shadow-inner">
          <span className="text-5xl">🐆</span>
        </div>
        <p className="text-lg font-bold text-[#2F4A3E]">Congratulations!</p>
        <p className="text-[10px] text-[#5E7F6E] mt-1 mb-3">
          You hatched an Amur Leopard!
        </p>
        <div className="bg-white/50 rounded-xl px-4 py-2 mb-3">
          <p className="text-[9px] text-[#5E7F6E] font-medium">
            Critically Endangered — fewer than 100 left in the wild
          </p>
        </div>
        <div className="flex gap-2 text-[9px]">
          <span className="bg-[#5E7F6E]/10 text-[#2F4A3E] px-3 py-1 rounded-full font-medium">
            🍀 +50 eco-credits
          </span>
          <span className="bg-[#5E7F6E]/10 text-[#2F4A3E] px-3 py-1 rounded-full font-medium">
            🏅 New badge!
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "progress",
    title: "Progress",
    subtitle: "Track your study stats",
    badge: "📊",
    bg: "from-[#E7EFEA] to-[#F2F8F4]",
    content: (
      <div className="flex flex-col h-full">
        <p className="text-sm font-bold text-[#2F4A3E] mb-3">This Past Week</p>
        <div className="bg-white/60 rounded-2xl p-3 mb-3">
          <div className="flex items-end justify-between gap-1 h-20">
            {[
              { day: "M", h: 60 },
              { day: "T", h: 80 },
              { day: "W", h: 45 },
              { day: "T", h: 90 },
              { day: "F", h: 70 },
              { day: "S", h: 30 },
              { day: "S", h: 55 },
            ].map((d, i) => (
              <div key={i} className="flex flex-col items-center flex-1 gap-1">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-[#5E7F6E] to-[#81C784]"
                  style={{ height: `${d.h}%` }}
                />
                <span className="text-[8px] text-[#5E7F6E]">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-white/60 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-[#2F4A3E]">6.5h</p>
            <p className="text-[8px] text-[#5E7F6E]">Total this week</p>
          </div>
          <div className="flex-1 bg-white/60 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-[#2F4A3E]">56m</p>
            <p className="text-[8px] text-[#5E7F6E]">Daily average</p>
          </div>
        </div>
        <div className="bg-white/60 rounded-xl p-2.5">
          <p className="text-[10px] font-bold text-[#2F4A3E] mb-1.5">
            Badges
          </p>
          <div className="flex gap-2">
            {["🏅", "⭐", "🎯", "💎", "🔥"].map((b, i) => (
              <div
                key={i}
                className="w-7 h-7 bg-[#E7EFEA] rounded-lg flex items-center justify-center text-sm"
              >
                {b}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "friends",
    title: "Friends",
    subtitle: "Study together",
    badge: "👥",
    bg: "from-[#E8EFF5] to-[#E7EFEA]",
    content: (
      <div className="flex flex-col h-full">
        <p className="text-sm font-bold text-[#2F4A3E] mb-3">Friends</p>
        <div className="bg-white/60 rounded-2xl p-3 mb-3">
          <p className="text-[10px] font-bold text-[#2F4A3E] mb-2">
            Leaderboard
          </p>
          {[
            { name: "Rhea", hrs: "6.5h", pos: "1", emoji: "🥇" },
            { name: "Alex", hrs: "5.2h", pos: "2", emoji: "🥈" },
            { name: "Maya", hrs: "4.8h", pos: "3", emoji: "🥉" },
          ].map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-2 py-1.5 border-b border-[#E7EFEA] last:border-0"
            >
              <span className="text-xs">{f.emoji}</span>
              <div className="w-5 h-5 rounded-full bg-[#5E7F6E]/20 flex items-center justify-center text-[8px] font-bold text-[#2F4A3E]">
                {f.name[0]}
              </div>
              <span className="text-[10px] font-medium text-[#2F4A3E] flex-1">
                {f.name}
              </span>
              <span className="text-[9px] text-[#5E7F6E] font-semibold">
                {f.hrs}
              </span>
            </div>
          ))}
        </div>
        <div className="bg-white/60 rounded-2xl p-3">
          <p className="text-[10px] font-bold text-[#2F4A3E] mb-2">
            Study Groups
          </p>
          {["Biology Crew", "GCSE Gang"].map((g) => (
            <div
              key={g}
              className="flex items-center gap-2 py-1.5 border-b border-[#E7EFEA] last:border-0"
            >
              <div className="w-6 h-6 rounded-lg bg-[#5E7F6E]/15 flex items-center justify-center text-[10px]">
                📚
              </div>
              <span className="text-[10px] font-medium text-[#2F4A3E] flex-1">
                {g}
              </span>
              <span className="text-[9px] text-[#5E7F6E]">3 online</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "donate",
    title: "Take Action",
    subtitle: "Donate to protect wildlife",
    badge: "💚",
    bg: "from-[#E7EFEA] to-[#C2DDD0]",
    content: (
      <div className="flex flex-col items-center h-full justify-center text-center">
        <span className="text-4xl mb-2">🌍</span>
        <p className="text-sm font-bold text-[#2F4A3E] mb-1">
          Protect Wildlife
        </p>
        <p className="text-[9px] text-[#5E7F6E] mb-4 px-2">
          100% of donations go to WWF conservation projects
        </p>
        <div className="w-20 h-20 bg-white/50 rounded-full flex items-center justify-center mb-3 relative">
          <span className="text-3xl">🏺</span>
          <div className="absolute -top-1 -right-1 bg-[#5E7F6E] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
            $347
          </div>
        </div>
        <p className="text-[8px] text-[#5E7F6E] mb-3">
          Raised by our community
        </p>
        <div className="flex gap-1.5 mb-3">
          {["$1", "$5", "$10", "$25"].map((a) => (
            <div
              key={a}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold ${
                a === "$5"
                  ? "bg-[#5E7F6E] text-white"
                  : "bg-white/60 text-[#2F4A3E]"
              }`}
            >
              {a}
            </div>
          ))}
        </div>
        <div className="bg-[#5E7F6E] text-white rounded-full px-6 py-2 text-[10px] font-semibold">
          Donate Now
        </div>
      </div>
    ),
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
      id="app-gallery"
      className="py-24 sm:py-32 bg-gradient-to-b from-sand/40 to-cream overflow-hidden"
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
            Inside the App
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-forest-dark tracking-tight">
            A sneak peek at
            <br />
            <span className="text-forest-light">every screen</span>
          </h2>
          <p className="mt-4 text-lg text-forest-dark/50 max-w-2xl mx-auto">
            From focused study sessions to hatching endangered animals — explore
            what makes Endura special.
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
                {/* Phone frame */}
                <div className="w-[280px] sm:w-[300px] relative">
                  <div
                    className={`bg-gradient-to-b ${screen.bg} rounded-[2.5rem] border-[5px] border-white/80 shadow-2xl shadow-forest/15 overflow-hidden`}
                  >
                    {/* Notch */}
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="w-20 h-5 bg-black/10 rounded-full" />
                    </div>

                    {/* Screen content */}
                    <div className="px-5 pb-6 min-h-[420px] sm:min-h-[460px]">
                      {screen.content}
                    </div>

                    {/* Home indicator */}
                    <div className="flex justify-center pb-3">
                      <div className="w-28 h-1 bg-black/10 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Label beneath active phone */}
              <AnimatePresence mode="wait">
                {active === i && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="text-center mt-6"
                  >
                    <p className="text-base font-bold text-forest-dark">
                      {screen.title}
                    </p>
                    <p className="text-sm text-forest-dark/50">
                      {screen.subtitle}
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
