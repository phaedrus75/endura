"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const credentials = [
  "Founder & CEO",
  "IB Diploma Student",
  "Harvard MUN Delegate",
  "UChicago Research Scholar",
  "1st Place IE Datathon",
  "Public Speaking Finalist",
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
          </motion.div>

          {/* Bio */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex-1 text-center lg:text-left"
          >
            <span className="inline-block bg-forest/10 text-forest-dark px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              Meet the Founder
            </span>

            <h2 className="text-4xl sm:text-5xl font-bold text-forest-dark tracking-tight mb-6">
              Rhea Munshi
            </h2>

            <div className="space-y-4 text-lg text-forest-dark/60 leading-relaxed">
              <p>
                At 16, Rhea Munshi was doom-scrolling Reels when it hit her:
                social media is addictive by design, so why isn&apos;t studying?
                With a passion for behavioural psychology, an eye for design,
                and concern for protecting wildlife, she did what any reasonable
                person would do: closed the app and built a better one.
              </p>
              <p>
                Endura is the result. Join her in proving that you can put in
                the hours — for yourself and for the planet.
              </p>
            </div>

            <p className="mt-6 text-lg text-forest-dark/60 leading-relaxed">
              Join her in proving that you can{" "}
              <span className="text-2xl sm:text-3xl font-bold text-forest-light">
                hatch your potential
              </span>
              .
            </p>

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
