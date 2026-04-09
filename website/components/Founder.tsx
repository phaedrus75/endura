"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const credentials = [
  "Founder & CEO",
  "IB Diploma Student",
];

export default function Founder() {
  return (
    <section
      id="founder"
      className="py-24 sm:py-32 bg-cream"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-14">
          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="flex-shrink-0"
          >
            <div className="relative">
              <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                <Image
                  src="/rhea.png"
                  alt="Rhea Munshi, Founder of Endura"
                  width={320}
                  height={320}
                  className="w-full h-full object-cover object-[center_30%]"
                />
              </div>
            </div>
            <a
              href="https://www.linkedin.com/in/rhea-munshi-188251366/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 bg-[#0A66C2] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#004182] transition-colors shadow-md shadow-[#0A66C2]/20"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Connect on LinkedIn
            </a>
          </motion.div>

          {/* Bio */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex-1 text-center lg:text-left"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-forest-dark tracking-tight mb-2">
              Meet the <span className="text-forest-light">Founder</span>
            </h2>
            <p className="text-lg sm:text-xl font-semibold text-forest-dark/50 mb-6">
              Rhea Munshi
            </p>

            <div className="space-y-4 text-lg text-forest-dark/60 leading-relaxed">
              <p>
                At 16, Rhea Munshi was doom-scrolling Reels when it hit her:
                social media is addictive by design, so why isn&apos;t studying?
                With a passion for behavioural psychology, an eye for design,
                and concern for protecting wildlife, she did what any reasonable
                person would do: closed the app and built a better one.
              </p>
              <p>
                Endura is the result.
              </p>
              <p>
                Join her in proving that you can put in
                the hours — for yourself and for the planet.
              </p>
              <p>
                Join her in proving that you can{" "}
                <span className="text-xl sm:text-2xl font-bold text-forest-light">
                  hatch your potential
                </span>
                .
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5 justify-center lg:justify-start">
              {credentials.map((tag) => (
                <span
                  key={tag}
                  className="bg-sand px-4 py-2 rounded-full text-sm font-medium text-forest-dark/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
