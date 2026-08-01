"use client";

import { motion } from "framer-motion";

const CANDIES = ["🔴", "🔵", "🟢", "🟠", "🟣", "🟦"];

interface Props {
  onStart: () => void;
}

export default function Splash({ onStart }: Props) {
  return (
    <div className="overlay">
      <motion.div
        className="overlay-card"
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 26 }}
      >
        <div className="splash-candies">
          {CANDIES.map((c, i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 1.2, delay: i * 0.15, repeat: Infinity, ease: "easeInOut" }}
            >
              {c}
            </motion.span>
          ))}
        </div>

        <motion.h1
          className="splash-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Candy Fiesta
        </motion.h1>

        <motion.p
          className="splash-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          Combiná 3 o más candies del mismo color
        </motion.p>

        <motion.div
          className="splash-legend"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <span>▲ Striped</span>
          <span>✦ Wrapped</span>
          <span>◉ Bomba</span>
        </motion.div>

        <motion.button
          className="btn-primary"
          onClick={onStart}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.06, y: -2 }}
          whileTap={{ scale: 0.94 }}
        >
          ¡Jugar!
        </motion.button>
      </motion.div>
    </div>
  );
}
