"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Colores de los 6 candies ── */
const CANDY_COLORS = [
  { bg: "#e74c3c", dark: "#922b21", light: "#f1948a" },
  { bg: "#3498db", dark: "#1a5276", light: "#7fb3d3" },
  { bg: "#2ecc71", dark: "#1e8449", light: "#82e0aa" },
  { bg: "#f39c12", dark: "#9a6000", light: "#f8c471" },
  { bg: "#9b59b6", dark: "#6c3483", light: "#c39bd3" },
  { bg: "#1abc9c", dark: "#0e6655", light: "#76d7c4" },
];

/* ── Burbuja flotante en background ── */
interface Bubble {
  id: number;
  color: (typeof CANDY_COLORS)[0];
  size: number;
  x: number;
  y: number;
  duration: number;
  driftY: number;
  driftX: number;
  opacity: number;
  delay: number;
}

function makeBubbles(n: number): Bubble[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    color: CANDY_COLORS[i % CANDY_COLORS.length],
    size: 28 + Math.random() * 52,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 5 + Math.random() * 8,
    driftY: -(20 + Math.random() * 40),
    driftX: (Math.random() - 0.5) * 30,
    opacity: 0.07 + Math.random() * 0.18,
    delay: Math.random() * 4,
  }));
}

function FloatingBubbles() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    setBubbles(makeBubbles(30));
  }, []);

  return (
    <div className="intro-bubbles">
      {bubbles.map((b) => (
        <motion.div
          key={b.id}
          className="intro-bubble"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.x}%`,
            top: `${b.y}%`,
            opacity: b.opacity,
            background: `radial-gradient(circle at 35% 30%, ${b.color.light}, ${b.color.bg} 55%, ${b.color.dark})`,
            boxShadow: `0 0 ${b.size * 0.6}px ${b.color.bg}55`,
          }}
          animate={{
            y: [0, b.driftY, b.driftY * 0.4, 0],
            x: [0, b.driftX, b.driftX * 0.3, 0],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ── Título letra por letra ── */
const titleWord = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};

const letterVariant = {
  hidden: { y: -56, opacity: 0, rotate: -18, scale: 0.7 },
  show: {
    y: 0,
    opacity: 1,
    rotate: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 480, damping: 22 },
  },
};

function AnimatedTitle() {
  const word1 = "CANDY";
  const word2 = "FIESTA";

  return (
    <div className="intro-title-wrap">
      {/* CANDY */}
      <motion.div
        className="intro-title-line intro-candy"
        variants={titleWord}
        initial="hidden"
        animate="show"
        transition={{ delayChildren: 0.3 }}
      >
        {word1.split("").map((ch, i) => (
          <motion.span key={i} variants={letterVariant} className="intro-letter">
            {ch}
          </motion.span>
        ))}
      </motion.div>

      {/* FIESTA */}
      <motion.div
        className="intro-title-line intro-fiesta"
        variants={titleWord}
        initial="hidden"
        animate="show"
        transition={{ delayChildren: 0.6 }}
      >
        {word2.split("").map((ch, i) => (
          <motion.span key={i} variants={letterVariant} className="intro-letter">
            {ch}
          </motion.span>
        ))}
      </motion.div>

      {/* Línea decorativa bajo el título */}
      <motion.div
        className="intro-divider"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/* ── Mini preview de tipos especiales ── */
const SPECIALS = [
  { color: CANDY_COLORS[0], icon: "▲", label: "Striped" },
  { color: CANDY_COLORS[1], icon: "✦", label: "Wrapped" },
  { color: CANDY_COLORS[4], icon: "◉", label: "Bomba" },
];

function SpecialPreviews() {
  return (
    <motion.div
      className="intro-specials"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5, duration: 0.5 }}
    >
      {SPECIALS.map((s, i) => (
        <motion.div
          key={i}
          className="intro-special-item"
          whileHover={{ scale: 1.15, y: -4 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <div
            className="intro-special-orb orb-special"
            style={{
              background: `radial-gradient(circle at 35% 30%, ${s.color.light}, ${s.color.bg} 55%, ${s.color.dark})`,
              boxShadow: `0 4px 0 ${s.color.dark}, 0 6px 20px ${s.color.bg}88`,
              "--orb-bg": s.color.bg,
              "--orb-dark": s.color.dark,
              "--orb-light": s.color.light,
            } as React.CSSProperties}
          >
            <span className="orb-shine" />
            <span className="intro-special-icon">{s.icon}</span>
          </div>
          <span className="intro-special-label">{s.label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ── Botón de jugar con anillo pulsante ── */
function PlayButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      className="intro-play-wrap"
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.8, type: "spring", stiffness: 380, damping: 22 }}
    >
      {/* Anillo pulsante exterior */}
      <motion.div
        className="play-ring"
        animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="play-ring play-ring-2"
        animate={{ scale: [1, 1.32, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />

      <motion.button
        className="btn-play"
        onClick={onClick}
        whileHover={{ scale: 1.07, y: -3 }}
        whileTap={{ scale: 0.93, y: 2 }}
      >
        <span className="btn-play-shine" />
        ¡Jugar!
      </motion.button>
    </motion.div>
  );
}

/* ── Paleta de colores ── */
function ColorPalette() {
  return (
    <motion.div
      className="intro-palette"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.35, duration: 0.5 }}
    >
      {CANDY_COLORS.map((c, i) => (
        <motion.div
          key={i}
          className="palette-dot"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.bg})`,
            boxShadow: `0 2px 0 ${c.dark}`,
          }}
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 1.4,
            delay: i * 0.12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}

/* ── Tagline ── */
function Tagline() {
  return (
    <motion.p
      className="intro-tagline"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1, duration: 0.5 }}
    >
      Combiná 3 o más candies del mismo color
    </motion.p>
  );
}

/* ── Pantalla completa ── */
interface Props {
  onStart: () => void;
}

export default function IntroScreen({ onStart }: Props) {
  const [exiting, setExiting] = useState(false);

  const handlePlay = () => {
    setExiting(true);
    setTimeout(onStart, 500);
  };

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          className="intro-root"
          exit={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 0.45, ease: "easeIn" }}
        >
          <FloatingBubbles />

          {/* Contenido central */}
          <div className="intro-content">
            {/* Ícono arriba */}
            <motion.div
              className="intro-icon"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
            >
              🍬
            </motion.div>

            <AnimatedTitle />
            <Tagline />
            <ColorPalette />
            <SpecialPreviews />
            <PlayButton onClick={handlePlay} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
