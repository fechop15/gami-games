"use client";

import React from "react";
import { motion } from "framer-motion";
import { Orb } from "../hooks/useEngine";

const COLOR_BG: Record<number, string> = {
  0: "#e74c3c", 1: "#e74c3c",
  2: "#3498db", 3: "#2ecc71",
  4: "#f39c12", 5: "#9b59b6",
  6: "#1abc9c",
};
const COLOR_DARK: Record<number, string> = {
  0: "#922b21", 1: "#922b21",
  2: "#1a5276", 3: "#1e8449",
  4: "#9a6000", 5: "#6c3483",
  6: "#0e6655",
};
const COLOR_LIGHT: Record<number, string> = {
  0: "#f1948a", 1: "#f1948a",
  2: "#7fb3d3", 3: "#82e0aa",
  4: "#f8c471", 5: "#c39bd3",
  6: "#76d7c4",
};
const TYPE_ICON: Record<string, string> = {
  NORMAL: "", STRIPPED_VER: "▲", STRIPPED_HOR: "▶",
  WRAPPED: "✦", BOMB: "◉", PULSATING: "★", BIG_STRIPED: "⚡",
};
const SPECIAL_TYPES = new Set(["STRIPPED_VER", "STRIPPED_HOR", "WRAPPED", "BOMB", "PULSATING", "BIG_STRIPED"]);

interface Props {
  orb: Orb;
  col: number;
  row: number;
  isSelected: boolean;
  isAnimating: boolean;
  entryDelay: number;
  onClick: (col: number, row: number) => void;
  onTouchStart: (e: React.TouchEvent, col: number, row: number) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export default function OrbCell({
  orb, col, row, isSelected, isAnimating, entryDelay,
  onClick, onTouchStart, onTouchEnd,
}: Props) {
  const bg    = COLOR_BG[orb.color]    ?? COLOR_BG[1];
  const dark  = COLOR_DARK[orb.color]  ?? COLOR_DARK[1];
  const light = COLOR_LIGHT[orb.color] ?? COLOR_LIGHT[1];
  const icon  = TYPE_ICON[orb.type]    ?? "";
  const isSpecial = SPECIAL_TYPES.has(orb.type);

  // ── Estilos inline directos — nunca CSS variables ──
  const orbStyle: React.CSSProperties = {
    background: `radial-gradient(circle at 38% 32%, ${light} 0%, ${bg} 45%, ${dark} 100%)`,
    boxShadow: isSelected
      ? `0 0 0 3px #fff, 0 0 0 6px rgba(255,255,255,0.25), 0 4px 0 ${dark}, 0 6px 20px rgba(255,255,255,0.2)`
      : `0 4px 0 ${dark}, 0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.38)`,
  };

  // Anillo pulsante para especiales — via CSS en la clase
  const specialRingStyle: React.CSSProperties | undefined = isSpecial
    ? { outlineOffset: "3px", outline: `2px solid rgba(255,255,255,0.55)` }
    : undefined;

  return (
    <motion.button
      className={`orb-cell${isSpecial ? " orb-special" : ""}`}
      style={{ ...orbStyle, ...specialRingStyle }}
      // Caída desde arriba sin encoger — solo Y + opacidad
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 18, delay: entryDelay }}
      whileHover={!isAnimating ? { scale: 1.09, transition: { duration: 0.1 } } : undefined}
      whileTap={!isAnimating ? { scale: 0.9, transition: { duration: 0.08 } } : undefined}
      onClick={() => onClick(col, row)}
      onTouchStart={(e) => onTouchStart(e, col, row)}
      onTouchEnd={onTouchEnd}
      disabled={isAnimating}
      aria-label={`Candy color ${orb.color} type ${orb.type}`}
    >
      <span className="orb-shine" />
      {icon && <span className="orb-icon">{icon}</span>}
    </motion.button>
  );
}
