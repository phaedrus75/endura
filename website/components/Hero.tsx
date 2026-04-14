"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://endura-production.up.railway.app";

export default function Hero() {
  const [androidEmail, setAndroidEmail] = useState("");
  const [androidStatus, setAndroidStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");

  const handleAndroidSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!androidEmail.trim()) return;
    setAndroidStatus("loading");
    try {
      const res = await fetch(`${API_URL}/android-beta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: androidEmail.trim() }),
      });
      const data = await res.json();
      setAndroidStatus(data.status === "already_registered" ? "already" : "success");
    } catch {
      setAndroidStatus("error");
    }
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-sage-light/40 via-cream to-cream"
    >
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
              href="#android-beta"
              className="border-2 border-forest/20 text-forest-dark px-8 py-4 rounded-full text-base font-semibold hover:border-forest/40 transition-colors"
            >
              Android? Join the Beta
            </motion.a>
          </div>

          <div className="mt-10 flex items-center gap-5 sm:gap-8 justify-center lg:justify-start text-base font-medium text-forest-dark/70">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-leaf" /> Free to use
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-leaf" /> 30+ species
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-leaf" /> Real impact
            </span>
          </div>

          {/* Android Beta Signup */}
          <div id="android-beta" className="mt-8 p-5 bg-white/60 backdrop-blur-sm rounded-2xl border border-forest/10 max-w-md mx-auto lg:mx-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🤖</span>
              <span className="text-sm font-semibold text-forest-dark">Android Beta — Coming Soon</span>
            </div>
            {androidStatus === "success" ? (
              <p className="text-sm text-forest font-medium">You&apos;re on the list! We&apos;ll email you when Android is ready.</p>
            ) : androidStatus === "already" ? (
              <p className="text-sm text-forest font-medium">You&apos;re already signed up! We&apos;ll be in touch soon.</p>
            ) : (
              <form onSubmit={handleAndroidSignup} className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your Gmail address"
                  value={androidEmail}
                  onChange={(e) => setAndroidEmail(e.target.value)}
                  required
                  className="flex-1 px-4 py-2.5 rounded-xl border border-forest/20 text-sm focus:outline-none focus:border-forest/50 bg-white"
                />
                <button
                  type="submit"
                  disabled={androidStatus === "loading"}
                  className="px-5 py-2.5 bg-forest text-white rounded-xl text-sm font-semibold hover:bg-forest-dark transition-colors disabled:opacity-50"
                >
                  {androidStatus === "loading" ? "..." : "Notify Me"}
                </button>
              </form>
            )}
            {androidStatus === "error" && (
              <p className="text-sm text-red-500 mt-2">Something went wrong. Try again.</p>
            )}
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
