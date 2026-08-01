"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  score: number;
  moves: number;
  level: number;
  lastMatch: string | null;
  lastScoreGain: number;
}

function useRollingNumber(target: number) {
  const [displayed, setDisplayed] = useState(target);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const fromRef = useRef(target);

  useEffect(() => {
    fromRef.current = displayed;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    const animate = (now: number) => {
      const t = Math.min((now - startRef.current) / 450, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return displayed;
}

export default function HUD({ score, moves, level, lastMatch, lastScoreGain }: Props) {
  const displayedScore = useRollingNumber(score);
  const movesWarning = moves <= 4;

  return (
    <div className="hud">
      {/* Nivel */}
      <div className="hud-stat">
        <span className="hud-label">Nivel</span>
        <motion.span
          key={level}
          className="hud-value"
          initial={{ scale: 1.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
        >
          {level}
        </motion.span>
      </div>

      {/* Puntaje — centro */}
      <div className="hud-stat hud-center">
        <span className="hud-label">Puntaje</span>
        <span className="hud-score">{displayedScore.toLocaleString()}</span>

        {/* +Puntos flotante */}
        <AnimatePresence mode="wait">
          {lastScoreGain > 0 && (
            <motion.div
              key={score}
              className="score-pop"
              initial={{ opacity: 0, y: 4, scale: 0.7 }}
              animate={{ opacity: 1, y: -28, scale: 1.1 }}
              exit={{ opacity: 0, y: -48, scale: 0.9 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            >
              +{lastScoreGain.toLocaleString()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Movimientos */}
      <div className={`hud-stat ${movesWarning ? "hud-warn" : ""}`}>
        <span className="hud-label">Movimientos</span>
        <motion.span
          key={moves}
          className="hud-value"
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 600, damping: 18 }}
        >
          {moves}
        </motion.span>
      </div>

    </div>
  );
}
