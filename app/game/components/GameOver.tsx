"use client";

import { motion } from "framer-motion";

interface Props {
  score: number;
  level: number;
  onRestart: () => void;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 24 } },
};

export default function GameOver({ score, level, onRestart }: Props) {
  return (
    <div className="overlay">
      <motion.div
        className="overlay-card"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 24 }}
      >
        <motion.div
          className="gameover-icon"
          animate={{ rotate: [0, -8, 8, -5, 5, 0] }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          🍬
        </motion.div>

        <motion.h2
          className="overlay-title"
          variants={item}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.2 }}
        >
          ¡Juego terminado!
        </motion.h2>

        <motion.div
          className="overlay-stats"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div className="overlay-stat" variants={item}>
            <span>Puntaje final</span>
            <strong>{score.toLocaleString()}</strong>
          </motion.div>
          <motion.div className="overlay-stat" variants={item}>
            <span>Nivel alcanzado</span>
            <strong>{level}</strong>
          </motion.div>
        </motion.div>

        <motion.button
          className="btn-primary"
          onClick={onRestart}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, type: "spring", stiffness: 400, damping: 20 }}
          whileHover={{ scale: 1.06, y: -2 }}
          whileTap={{ scale: 0.94 }}
        >
          Jugar de nuevo
        </motion.button>
      </motion.div>
    </div>
  );
}
