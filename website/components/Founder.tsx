"use client";

import { motion } from "framer-motion";

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
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-14">
          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="flex-shrink-0"
          >
            <div className="relative">
              <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-3xl bg-gradient-to-br from-sage-light to-sage overflow-hidden border-4 border-white shadow-xl">
                <div className="w-full h-full flex flex-col items-center justify-center text-forest-dark/40">
                  <span className="text-7xl mb-2">🌿</span>
                  <span className="text-sm font-medium">Photo coming soon</span>
                </div>
              </div>
              <div className="absolute -top-3 -left-3 text-3xl animate-float">
                🦁
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
                At 16, Rhea saw a problem she couldn&apos;t ignore: students
                struggling to stay motivated, and endangered species losing
                their fight for survival. As an IB Diploma student at
                Southbank International School in London, she decided to
                connect the two.
              </p>
              <p>
                Endura was born from a simple idea — that the hours young
                people spend studying can be channelled into something
                meaningful. Every study session becomes an act of conservation.
                Every student becomes a guardian of endangered wildlife. Today,
                170+ active users across 3 continents study and protect species
                through Endura.
              </p>
              <p>
                Beyond the app, Rhea has represented her school at Harvard and
                Oxford Model UN, conducted psychology research at the
                University of Chicago, won 1st place in the IE University
                Sustainability Datathon, spoken to 400+ students across Delhi
                about using AI responsibly, and volunteered teaching maths and
                computer science in underserved communities. She was selected
                as a student panellist at the international Cognita
                &ldquo;School of the Future&rdquo; conference in Chile,
                speaking to global educators about how AI will shape education.
              </p>
            </div>

            <motion.blockquote
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-8 pl-6 border-l-4 border-forest-light italic text-forest-dark/70 text-lg"
            >
              &ldquo;I believe my generation can be the one that turns the tide
              for endangered species. We just need the right tools and the right
              motivation.&rdquo;
            </motion.blockquote>

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
