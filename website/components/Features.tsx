"use client";

import { motion } from "framer-motion";

const FEATURES = [
  {
    emoji: "⏳",
    title: "Gamified Study Timer",
    description:
      "Set focused study sessions with our beautiful timer. Every minute you study earns eco-credits and brings your egg closer to hatching.",
    color: "from-forest-light/20 to-sage-light/30",
  },
  {
    emoji: "🐣",
    title: "Hatch Endangered Animals",
    description:
      "Complete study sessions to hatch real endangered species — from Amur Leopards to Javan Rhinos. Collect, nickname, and learn about each one.",
    color: "from-sage/20 to-leaf/20",
  },
  {
    emoji: "🏡",
    title: "Build Your Sanctuary",
    description:
      "Create a beautiful habitat for your animals. Drag and drop accessories and decorations. Make it uniquely yours.",
    color: "from-sage-light/30 to-sand/50",
  },
  {
    emoji: "👥",
    title: "Study With Friends",
    description:
      "Create study pacts, join groups, compete on leaderboards, and react to friends' achievements. Studying is better together.",
    color: "from-leaf/15 to-forest-light/15",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export default function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-cream">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
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

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`bg-gradient-to-br ${feature.color} rounded-3xl p-8 sm:p-10 border border-white/60 backdrop-blur-sm`}
            >
              <span className="text-4xl block mb-4">{feature.emoji}</span>
              <h3 className="text-xl font-bold text-forest-dark mb-3">
                {feature.title}
              </h3>
              <p className="text-forest-dark/60 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
