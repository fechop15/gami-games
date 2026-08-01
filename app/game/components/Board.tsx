"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { Board as BoardType, Orb } from "../hooks/useEngine";
import OrbCell from "./OrbCell";

interface Props {
  board: BoardType;
  cols: number;
  rows: number;
  isAnimating: boolean;
  shakeTrigger: number;
  newOrbIds: Set<number>;
  onSwap: (c1: number, r1: number, c2: number, r2: number) => void;
}

interface Selection { col: number; row: number }
type SwapOffsets = Record<number, { x: number; y: number }>;

function isAdjacent(a: Selection, b: Selection) {
  const dc = Math.abs(a.col - b.col);
  const dr = Math.abs(a.row - b.row);
  return (dc === 1 && dr === 0) || (dc === 0 && dr === 1);
}

// Spring de gravedad: lento y con rebote visible al aterrizar
const GRAVITY_SPRING = { type: "spring" as const, stiffness: 110, damping: 14, mass: 1.2 };
// Spring de swap: rápido y preciso
const SWAP_SPRING = { type: "spring" as const, stiffness: 440, damping: 32 };

export default function Board({
  board, cols, rows, isAnimating, shakeTrigger, newOrbIds, onSwap,
}: Props) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [swapOffsets, setSwapOffsets] = useState<SwapOffsets>({});
  const touchStart = useRef<{ x: number; y: number; col: number; row: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const prevShake = useRef(0);
  const pendingSwap = useRef(false);

  // Sacudida en mismatch
  useEffect(() => {
    if (shakeTrigger !== 0 && shakeTrigger !== prevShake.current) {
      prevShake.current = shakeTrigger;
      controls.start({
        x: [0, -12, 12, -9, 9, -5, 5, -2, 2, 0],
        transition: { duration: 0.5, ease: "easeOut" },
      });
    }
  }, [shakeTrigger, controls]);

  const getCellSize = useCallback(() => {
    const el = boardRef.current;
    if (!el) return { w: 60, h: 60 };
    const inner = el.clientWidth - 20;
    const w = (inner - (cols - 1) * 5) / cols;
    const h = (el.clientHeight - 20 - (rows - 1) * 5) / rows;
    return { w, h };
  }, [cols, rows]);

  const executeSwap = useCallback(
    (c1: number, r1: number, c2: number, r2: number) => {
      if (pendingSwap.current || isAnimating) return;
      const orb1 = board[c1]?.[r1];
      const orb2 = board[c2]?.[r2];
      if (!orb1 || !orb2) return;

      const { w, h } = getCellSize();
      const dx = (c2 - c1) * (w + 5);
      const dy = (r2 - r1) * (h + 5);

      pendingSwap.current = true;
      setSelected(null);
      setSwapOffsets({
        [orb1.id]: { x: dx, y: dy },
        [orb2.id]: { x: -dx, y: -dy },
      });

      setTimeout(() => {
        setSwapOffsets({});
        pendingSwap.current = false;
        onSwap(c1, r1, c2, r2);
      }, 230);
    },
    [board, getCellSize, isAnimating, onSwap]
  );

  const handleClick = useCallback(
    (col: number, row: number) => {
      if (isAnimating || pendingSwap.current) return;
      if (!selected) { setSelected({ col, row }); return; }
      if (selected.col === col && selected.row === row) { setSelected(null); return; }
      if (isAdjacent(selected, { col, row })) {
        executeSwap(selected.col, selected.row, col, row);
      } else {
        setSelected({ col, row });
      }
    },
    [selected, isAnimating, executeSwap]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, col: number, row: number) => {
      e.preventDefault();
      if (isAnimating || pendingSwap.current) return;
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY, col, row };
    },
    [isAnimating]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (!touchStart.current || isAnimating || pendingSwap.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      const { col, row } = touchStart.current;
      const { w, h } = getCellSize();
      const threshold = Math.min(w, h) * 0.28;

      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
        handleClick(col, row);
        touchStart.current = null;
        return;
      }

      let tc = col, tr = row;
      if (Math.abs(dx) > Math.abs(dy)) {
        tc = dx > 0 ? col + 1 : col - 1;
      } else {
        tr = dy > 0 ? row + 1 : row - 1;
      }

      if (tc >= 0 && tc < cols && tr >= 0 && tr < rows) {
        executeSwap(col, row, tc, tr);
      }
      touchStart.current = null;
    },
    [isAnimating, cols, rows, getCellSize, handleClick, executeSwap]
  );

  // board col-major: board[c][r] → render row × col
  const cells: { orb: Orb | null; col: number; row: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ orb: board[c]?.[r] ?? null, col: c, row: r });
    }
  }

  return (
    <motion.div
      ref={boardRef}
      animate={controls}
      className="game-board"
      style={{ "--cols": cols, "--rows": rows } as React.CSSProperties}
    >
      <AnimatePresence mode="popLayout">
        {cells.map(({ orb, col, row }) =>
          orb ? (
            <motion.div
              key={`orb-${orb.id}`}
              layoutId={`layout-${orb.id}`}
              className="orb-wrapper"
              animate={swapOffsets[orb.id] ?? { x: 0, y: 0 }}
              transition={{
                // Gravedad: espera que los eliminados terminen, luego cae lento
                layout: { ...GRAVITY_SPRING, delay: 0.38 },
                x: SWAP_SPRING,
                y: SWAP_SPRING,
              }}
              exit={{
                // Pop dramático: crece, destella y desaparece
                scale: [1, 1.45, 0],
                opacity: [1, 1, 0],
                transition: { duration: 0.42, times: [0, 0.4, 1], ease: "easeIn" },
              }}
              style={{ zIndex: swapOffsets[orb.id] ? 20 : 1, position: "relative" }}
            >
              <OrbCell
                orb={orb}
                col={col}
                row={row}
                isSelected={selected?.col === col && selected?.row === row}
                isAnimating={isAnimating || pendingSwap.current}
                // Orbs nuevos (gravedad): entran DESPUÉS de que los existentes caigan
                // Orbs iniciales: caen secuencialmente fila por fila
                entryDelay={
                  newOrbIds.has(orb.id)
                    ? 1.0 + row * 0.08    // nuevos: aparecen bien después de la caída
                    : row * 0.09 + col * 0.012  // inicial: ola de arriba a abajo
                }
                onClick={handleClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              />
            </motion.div>
          ) : (
            <div key={`empty-${col}-${row}`} className="orb-slot" />
          )
        )}
      </AnimatePresence>
    </motion.div>
  );
}
