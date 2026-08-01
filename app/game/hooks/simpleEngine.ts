/**
 * Motor match-3 con tipos especiales, combos y progresión de niveles.
 */

export type OrbColor = 1 | 2 | 3 | 4 | 5 | 6;
export type OrbType  = "NORMAL" | "STRIPPED_VER" | "STRIPPED_HOR" | "WRAPPED" | "BOMB" | "PULSATING";

export interface SimpleOrb {
  id: number;
  color: OrbColor;
  type: OrbType;
}

export type SimpleBoard = (SimpleOrb | null)[][];

export interface LevelCfg {
  cols: number; rows: number; colors: number; threshold: number;
}

export const LEVEL_CONFIG: LevelCfg[] = [
  { cols:6, rows:6, colors:4, threshold:75   },   // Nivel 1
  { cols:6, rows:7, colors:5, threshold:150  },   // Nivel 2
  { cols:7, rows:7, colors:5, threshold:300  },   // Nivel 3
  { cols:8, rows:7, colors:5, threshold:400  },   // Nivel 4
  { cols:8, rows:8, colors:6, threshold:500  },   // Nivel 5
  { cols:9, rows:8, colors:6, threshold:600  },   // Nivel 6
  { cols:9, rows:9, colors:6, threshold:750  },   // Nivel 7
  { cols:9, rows:10,colors:6, threshold:Infinity },// Nivel 8
];

export type MatchEvent =
  | { kind:"match";   eliminated:[number,number][]; specialCreated:[number,number][]; score:number; multiplier:number }
  | { kind:"mismatch" }
  | { kind:"settle" }
  | { kind:"reshuffle" }
  | { kind:"levelup"; level:number; cols:number; rows:number; colors:number };

export interface SwapResult {
  event: MatchEvent;
  newOrbIds: Set<number>;
  scoreGained: number;
  /** Snapshot del board DESPUÉS de esta cascada — para animar paso a paso */
  boardSnapshot?: SimpleBoard;
}

// ── PRNG ──────────────────────────────────────────────────────────────────────
let _id = 1;
function lcg(seed: { v: number }) {
  seed.v = (seed.v * 1664525 + 1013904223) & 0x7fffffff;
  return (seed.v >>> 0) / 0x7fffffff;
}
function mkOrb(color: OrbColor, type: OrbType = "NORMAL"): SimpleOrb {
  return { id: _id++, color, type };
}

function isSpecialOrb(orb: SimpleOrb | null | undefined): orb is SimpleOrb {
  return !!orb && orb.type !== "NORMAL";
}

const PTS_SPECIAL: Record<OrbType, number> = {
  NORMAL: 1, STRIPPED_VER: 2, STRIPPED_HOR: 2, WRAPPED: 3, BOMB: 5, PULSATING: 4,
};

// ── Generación de tablero SIN matches iniciales ───────────────────────────────
// Regla: solo prohibir un color X si los DOS vecinos anteriores son X.
// La implementación anterior prohibía colores individuales (demasiado restrictivo),
// lo que agotaba el pool y el fallback aleatorio creaba matches.
export function generateBoard(cols: number, rows: number, numColors: number): SimpleBoard {
  const rng = { v: Math.floor(Math.random() * 0x7fffffff) | 1 };
  const board: SimpleBoard = Array.from({ length: cols }, () => Array(rows).fill(null));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bad = new Set<OrbColor>();

      // Horizontal: prohibir X sólo si board[c-1] == board[c-2] == X
      // (poner X aquí daría: X, X, X → match de 3)
      const left1 = board[c-1]?.[r]?.color;
      const left2 = board[c-2]?.[r]?.color;
      if (left1 !== undefined && left1 === left2) bad.add(left1);

      // Vertical: prohibir Y sólo si board[c][r-1] == board[c][r-2] == Y
      const up1 = board[c]?.[r-1]?.color;
      const up2 = board[c]?.[r-2]?.color;
      if (up1 !== undefined && up1 === up2) bad.add(up1);

      // Con 4 colores y max 2 entradas en bad, pool nunca queda vacío
      const pool = Array.from({length:numColors},(_,i)=>(i+1) as OrbColor)
        .filter(n => !bad.has(n));
      const color: OrbColor = pool.length
        ? pool[Math.floor(lcg(rng) * pool.length)]
        : ((Math.floor(lcg(rng) * numColors) + 1) as OrbColor);

      board[c][r] = mkOrb(color);
    }
  }
  return board;
}

// ── Detección de líneas de match ───────────────────────────────────────────────
function getMatchLines(board: SimpleBoard, cols: number, rows: number): Array<Array<[number,number]>> {
  const lines: Array<Array<[number,number]>> = [];

  // Horizontal
  for (let r = 0; r < rows; r++) {
    let run: Array<[number,number]> = [];
    for (let c = 0; c <= cols; c++) {
      const color = c < cols ? board[c]?.[r]?.color : null;
      const prev  = run.length > 0 ? board[run[run.length-1][0]][r]?.color : null;
      if (color && color === prev) { run.push([c,r]); }
      else { if (run.length >= 3) lines.push(run); run = color ? [[c,r]] : []; }
    }
  }

  // Vertical
  for (let c = 0; c < cols; c++) {
    let run: Array<[number,number]> = [];
    for (let r = 0; r <= rows; r++) {
      const color = r < rows ? board[c]?.[r]?.color : null;
      const prev  = run.length > 0 ? board[c][run[run.length-1][1]]?.color : null;
      if (color && color === prev) { run.push([c,r]); }
      else { if (run.length >= 3) lines.push(run); run = color ? [[c,r]] : []; }
    }
  }

  return lines;
}

function hasAnyMatch(board: SimpleBoard, cols: number, rows: number): boolean {
  return getMatchLines(board, cols, rows).length > 0;
}

// ── ¿Swap crea match? ─────────────────────────────────────────────────────────
export function wouldMatch(board: SimpleBoard, c1:number, r1:number, c2:number, r2:number, cols:number, rows:number): boolean {
  const tmp = board[c1][r1]; board[c1][r1]=board[c2][r2]; board[c2][r2]=tmp;
  const ok = hasAnyMatch(board, cols, rows);
  board[c2][r2]=board[c1][r1]; board[c1][r1]=tmp;
  return ok;
}

export function isValidSwap(board: SimpleBoard, c1:number, r1:number, c2:number, r2:number, cols:number, rows:number): boolean {
  const o1 = board[c1]?.[r1], o2 = board[c2]?.[r2];
  if (!o1 || !o2) return false;
  if (o1.type === "BOMB" || o2.type === "BOMB") return true;
  if (o1.type !== "NORMAL" && o2.type !== "NORMAL") return true;
  return wouldMatch(board, c1, r1, c2, r2, cols, rows);
}

export function hasPossibleMoves(board: SimpleBoard, cols: number, rows: number): boolean {
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    if (c+1<cols && isValidSwap(board,c,r,c+1,r,cols,rows)) return true;
    if (r+1<rows && isValidSwap(board,c,r,c,r+1,cols,rows)) return true;
  }
  return false;
}

export function reshuffleBoard(board: SimpleBoard, cols: number, rows: number): void {
  const orbs: SimpleOrb[] = [];
  for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) if(board[c][r]) orbs.push(board[c][r]!);
  for (let i=orbs.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [orbs[i],orbs[j]]=[orbs[j],orbs[i]]; }
  let idx=0;
  for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) if(board[c][r]) board[c][r]=orbs[idx++];
}

// ── Efectos especiales: expande el set a eliminar ─────────────────────────────
function expandWithSpecials(
  toElim: Set<string>, board: SimpleBoard, cols: number, rows: number,
  inertIds: Set<number> = new Set()
): Set<string> {
  let prev = 0;
  do {
    prev = toElim.size;
    for (const key of [...toElim]) {
      const [c,r] = key.split(",").map(Number);
      const orb = board[c]?.[r]; if (!orb || orb.type==="NORMAL") continue;
      if (inertIds.has(orb.id)) continue;  // special recién creado — no activar todavía
      switch(orb.type) {
        case "STRIPPED_VER":
          for (let rr=0;rr<rows;rr++) toElim.add(`${c},${rr}`);
          break;
        case "STRIPPED_HOR":
          for (let cc=0;cc<cols;cc++) toElim.add(`${cc},${r}`);
          break;
        case "WRAPPED":
          for (let dc=-1;dc<=1;dc++) for (let dr=-1;dr<=1;dr++) {
            const nc=c+dc,nr=r+dr;
            if(nc>=0&&nc<cols&&nr>=0&&nr<rows) toElim.add(`${nc},${nr}`);
          }
          break;
        case "BOMB": {
          const bColor=orb.color;
          for (let cc=0;cc<cols;cc++) for (let rr=0;rr<rows;rr++)
            if(board[cc]?.[rr]?.color===bColor) toElim.add(`${cc},${rr}`);
          break;
        }
        case "PULSATING":
          // Limpia fila + columna completas (STRIPPED_HOR + STRIPPED_VER combinados)
          for (let cc=0;cc<cols;cc++) toElim.add(`${cc},${r}`);
          for (let rr=0;rr<rows;rr++) toElim.add(`${c},${rr}`);
          break;
      }
    }
  } while (toElim.size > prev);
  return toElim;
}

// ── Crear special a partir de match ──────────────────────────────────────────
// Lógica fiel al motor original (candy-engine.js):
//   match-5+ → BOMB (bomba de color) en el centro de la línea
//   match-4  → STRIPPED_HOR (horizontal) o STRIPPED_VER (vertical)
//              Colocado en el orb swappeado que sea NORMAL; si no, en el centro
//   Intersección H+V (mismo orb en 2+ líneas) → WRAPPED (limpia 3×3)
function applySpecialCreation(
  board: SimpleBoard,
  lines: Array<Array<[number,number]>>,
  swapC1: number, swapR1: number,
  swapC2: number, swapR2: number,
  toElim: Set<string>
): [number,number][] {
  const created: [number,number][] = [];
  const createdKeys = new Set<string>();

  // Mapa: cuántas líneas contienen cada posición (detecta intersecciones)
  const posLineCount = new Map<string, number>();
  for (const line of lines) {
    for (const [c,r] of line) {
      const k = `${c},${r}`;
      posLineCount.set(k, (posLineCount.get(k) ?? 0) + 1);
    }
  }

  // Ordenar: primero match-5+, luego match-4, por ultimo match-3
  // (las líneas más largas tienen prioridad para crear specials)
  const sorted = [...lines].sort((a,b) => b.length - a.length);

  for (const line of sorted) {
    const len = line.length;
    const isHor = len > 1 && line[0][1] === line[1][1]; // misma fila → horizontal

    if (len >= 5) {
      // ── Match-5+: BOMB (color bomb) en el centro (índice 2) ────────────────
      const [bc, br] = line[2];
      const key = `${bc},${br}`;
      if (createdKeys.has(key)) continue;
      if (board[bc]?.[br]?.type !== "NORMAL") continue;
      toElim.delete(key);
      const orig = board[bc]?.[br];
      if (orig) {
        board[bc][br] = { ...orig, type: "BOMB", id: _id++ };
        created.push([bc, br]);
        createdKeys.add(key);
      }

    } else if (len === 4) {
      // ── Match-4: STRIPPED ──────────────────────────────────────────────────
      // Dirección: línea horizontal → limpiar fila → STRIPPED_HOR
      //            línea vertical   → limpiar col  → STRIPPED_VER
      const strType: OrbType = isHor ? "STRIPPED_HOR" : "STRIPPED_VER";

      // Colocación inteligente: preferir el orb swappeado (p1 o p2) que esté
      // en esta línea y sea NORMAL, igual que en el motor original.
      let tc = -1, tr = -1;
      for (const [c,r] of line) {
        if ((c===swapC1&&r===swapR1) || (c===swapC2&&r===swapR2)) {
          if (board[c]?.[r]?.type === "NORMAL") { tc=c; tr=r; break; }
        }
      }
      // Fallback: centro de la línea
      if (tc === -1) [tc, tr] = line[Math.floor(len/2)];

      const key = `${tc},${tr}`;
      if (createdKeys.has(key)) continue;
      if (board[tc]?.[tr]?.type !== "NORMAL") continue;

      // Si esta posición está en 2+ líneas → es intersección H+V.
      // Como esta rama es una línea de 4, el cruce es "grande" (brazo ≥4):
      // crea PULSATING (limpia fila + columna). El cruce simple 3+3 se maneja
      // en la rama match-3 y crea WRAPPED (3×3). Así ambos especiales viven.
      const finalType: OrbType = (posLineCount.get(key) ?? 1) >= 2 ? "PULSATING" : strType;
      toElim.delete(key);
      const orig = board[tc]?.[tr];
      if (orig) {
        board[tc][tr] = { ...orig, type: finalType, id: _id++ };
        created.push([tc, tr]);
        createdKeys.add(key);
      }

    } else {
      // ── Match-3: verificar intersecciones H+V → WRAPPED ───────────────────
      for (const [c,r] of line) {
        const key = `${c},${r}`;
        if (createdKeys.has(key)) continue;
        if (board[c]?.[r]?.type !== "NORMAL") continue;
        if ((posLineCount.get(key) ?? 1) >= 2) {
          toElim.delete(key);
          const orig = board[c]?.[r];
          if (orig) {
            board[c][r] = { ...orig, type: "WRAPPED", id: _id++ };
            created.push([c, r]);
            createdKeys.add(key);
          }
        }
      }
    }
  }

  return created;
}

// ── Gravedad + rellenar desde arriba ─────────────────────────────────────────
export function applyGravity(board: SimpleBoard, cols: number, rows: number, numColors: number): SimpleOrb[] {
  const rng = { v: Math.floor(Math.random()*0x7fffffff)|1 };
  const newOrbs: SimpleOrb[] = [];
  for (let c=0;c<cols;c++) {
    const kept: SimpleOrb[] = [];
    for (let r=rows-1;r>=0;r--) if(board[c][r]) kept.push(board[c][r]!);
    const needed = rows - kept.length;
    for (let i=0;i<needed;i++) {
      const orb = mkOrb(((Math.floor(lcg(rng)*numColors)+1) as OrbColor));
      newOrbs.push(orb); kept.push(orb);
    }
    for (let r=0;r<rows;r++) board[c][rows-1-r]=kept[r]??null;
  }
  return newOrbs;
}

// ── Expandir tablero al subir de nivel ───────────────────────────────────────
export function expandBoard(board: SimpleBoard, oldCols: number, oldRows: number, newCols: number, newRows: number, numColors: number): SimpleBoard {
  const rng = { v: Math.floor(Math.random()*0x7fffffff)|1 };
  // Crear tablero nuevo
  const nb: SimpleBoard = Array.from({length:newCols},()=>Array(newRows).fill(null));

  // Copiar tablero anterior centrado
  const colOffset = Math.floor((newCols - oldCols) / 2);
  for (let c=0;c<oldCols;c++) for (let r=0;r<oldRows;r++)
    nb[c+colOffset][r+newRows-oldRows] = board[c]?.[r] ?? null;

  // Rellenar celdas vacías
  for (let c=0;c<newCols;c++) for (let r=0;r<newRows;r++) {
    if (!nb[c][r]) nb[c][r] = mkOrb(((Math.floor(lcg(rng)*numColors)+1) as OrbColor));
  }

  return nb;
}

// ── Cascadas post-primer-golpe ────────────────────────────────────────────────
function runCascadesAndSettle(
  board: SimpleBoard,
  cols: number, rows: number,
  numColors: number,
  pointsPerOrb: number,
  c1: number, r1: number, c2: number, r2: number,
  inertSpecialIds: Set<number> = new Set(),
  startDepth = 0,
): SwapResult[] {
  const results: SwapResult[] = [];
  let cascadeDepth = startDepth;

  while (cascadeDepth < 30) {
    const lines = getMatchLines(board, cols, rows);
    if (lines.length === 0) break;
    cascadeDepth++;

    const toElim = new Set<string>();
    for (const line of lines) for (const [c,r] of line) toElim.add(`${c},${r}`);

    const specialCreated = applySpecialCreation(board, lines, c1, r1, c2, r2, toElim);
    for (const [sc,sr] of specialCreated) {
      const orb = board[sc]?.[sr]; if (orb) inertSpecialIds.add(orb.id);
    }
    expandWithSpecials(toElim, board, cols, rows, inertSpecialIds);

    let scoreGained = 0;
    const eliminated: [number,number][] = [];
    for (const key of toElim) {
      const [c,r] = key.split(",").map(Number);
      const orb = board[c]?.[r]; if (!orb) continue;
      scoreGained += pointsPerOrb * (PTS_SPECIAL[orb.type]??1) * Math.max(1, cascadeDepth);
      eliminated.push([c,r]);
      board[c][r] = null;
    }

    const newOrbs = applyGravity(board, cols, rows, numColors);
    const snapshot: SimpleBoard = board.map(col => [...col]);

    results.push({
      event: { kind:"match", eliminated, specialCreated, score:scoreGained, multiplier:cascadeDepth },
      newOrbIds: new Set(newOrbs.map(o=>o.id)),
      scoreGained,
      boardSnapshot: snapshot,
    });
  }

  if (!hasPossibleMoves(board, cols, rows)) {
    reshuffleBoard(board, cols, rows);
    if (!hasPossibleMoves(board, cols, rows)) {
      for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) {
        const o=board[c][r]; if(o) o.color=((Math.floor(Math.random()*numColors)+1) as OrbColor);
      }
    }
    results.push({ event:{kind:"reshuffle"}, newOrbIds:new Set(), scoreGained:0 });
  }

  results.push({ event:{kind:"settle"}, newOrbIds:new Set(), scoreGained:0 });
  return results;
}

// ── Combo special+special: construir set inicial a eliminar ───────────────────
function buildComboToElim(
  board: SimpleBoard,
  c1: number, r1: number,
  c2: number, r2: number,
  cols: number, rows: number,
  orb1: SimpleOrb, orb2: SimpleOrb,
): Set<string> {
  const toElim = new Set<string>();
  const add = (c:number, r:number) => {
    if (c>=0&&c<cols&&r>=0&&r<rows) toElim.add(`${c},${r}`);
  };
  const t1 = orb1.type, t2 = orb2.type;
  const isBomb     = (t: OrbType) => t === "BOMB";
  const isStripped = (t: OrbType) => t === "STRIPPED_HOR" || t === "STRIPPED_VER";
  const isWrapped  = (t: OrbType) => t === "WRAPPED";

  if (isBomb(t1) && isBomb(t2)) {
    for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) {
      const o = board[c]?.[r];
      if (o && (o.color===orb1.color || o.color===orb2.color)) add(c,r);
    }

  } else if (isBomb(t1) && isStripped(t2)) {
    const bc = orb1.color, isHor = t2==="STRIPPED_HOR";
    for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) {
      if (board[c]?.[r]?.color === bc) {
        if (isHor) for (let cc=0;cc<cols;cc++) add(cc,r);
        else       for (let rr=0;rr<rows;rr++) add(c,rr);
      }
    }
    add(c1,r1); add(c2,r2);

  } else if (isBomb(t2) && isStripped(t1)) {
    const bc = orb2.color, isHor = t1==="STRIPPED_HOR";
    for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) {
      if (board[c]?.[r]?.color === bc) {
        if (isHor) for (let cc=0;cc<cols;cc++) add(cc,r);
        else       for (let rr=0;rr<rows;rr++) add(c,rr);
      }
    }
    add(c1,r1); add(c2,r2);

  } else if (isBomb(t1) && isWrapped(t2)) {
    const bc = orb1.color;
    for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) {
      if (board[c]?.[r]?.color === bc)
        for (let dc=-1;dc<=1;dc++) for (let dr=-1;dr<=1;dr++) add(c+dc,r+dr);
    }
    add(c1,r1); add(c2,r2);

  } else if (isBomb(t2) && isWrapped(t1)) {
    const bc = orb2.color;
    for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) {
      if (board[c]?.[r]?.color === bc)
        for (let dc=-1;dc<=1;dc++) for (let dr=-1;dr<=1;dr++) add(c+dc,r+dr);
    }
    add(c1,r1); add(c2,r2);

  } else if (isStripped(t1) && isStripped(t2)) {
    for (let cc=0;cc<cols;cc++) { add(cc,r1); add(cc,r2); }
    for (let rr=0;rr<rows;rr++) { add(c1,rr); add(c2,rr); }

  } else if (isStripped(t1) && isWrapped(t2)) {
    if (t1==="STRIPPED_HOR") {
      for (let dr=-1;dr<=1;dr++) for (let cc=0;cc<cols;cc++) add(cc,r1+dr);
    } else {
      for (let dc=-1;dc<=1;dc++) for (let rr=0;rr<rows;rr++) add(c1+dc,rr);
    }
    add(c1,r1); add(c2,r2);

  } else if (isWrapped(t1) && isStripped(t2)) {
    if (t2==="STRIPPED_HOR") {
      for (let dr=-1;dr<=1;dr++) for (let cc=0;cc<cols;cc++) add(cc,r2+dr);
    } else {
      for (let dc=-1;dc<=1;dc++) for (let rr=0;rr<rows;rr++) add(c2+dc,rr);
    }
    add(c1,r1); add(c2,r2);

  } else if (isWrapped(t1) && isWrapped(t2)) {
    for (let dc=-2;dc<=2;dc++) for (let dr=-2;dr<=2;dr++) {
      add(c1+dc,r1+dr); add(c2+dc,r2+dr);
    }

  } else {
    // Genérico (PULSATING u otras combinaciones): activar ambos vía expandWithSpecials
    add(c1,r1); add(c2,r2);
    expandWithSpecials(toElim, board, cols, rows);
  }

  return toElim;
}

// ── Special+Special combo ─────────────────────────────────────────────────────
function processSpecialCombo(
  board: SimpleBoard,
  c1: number, r1: number,
  c2: number, r2: number,
  cols: number, rows: number,
  numColors: number,
  pointsPerOrb: number,
  orb1: SimpleOrb, orb2: SimpleOrb,
): SwapResult[] {
  const toElim = buildComboToElim(board, c1, r1, c2, r2, cols, rows, orb1, orb2);

  let scoreGained = 0;
  const eliminated: [number,number][] = [];
  for (const key of toElim) {
    const [c,r] = key.split(",").map(Number);
    const orb = board[c]?.[r]; if (!orb) continue;
    scoreGained += pointsPerOrb * (PTS_SPECIAL[orb.type]??1) * 3;
    eliminated.push([c,r]);
    board[c][r] = null;
  }

  const newOrbs = applyGravity(board, cols, rows, numColors);
  const snapshot: SimpleBoard = board.map(col => [...col]);

  const first: SwapResult = {
    event: { kind:"match", eliminated, specialCreated:[], score:scoreGained, multiplier:3 },
    newOrbIds: new Set(newOrbs.map(o=>o.id)),
    scoreGained,
    boardSnapshot: snapshot,
  };

  return [first, ...runCascadesAndSettle(board, cols, rows, numColors, pointsPerOrb, c1, r1, c2, r2, new Set(), 1)];
}

// ── BOMB + NORMAL: apunta al color del orb con el que se swapea ───────────────
function processBombActivation(
  board: SimpleBoard,
  c1: number, r1: number,
  c2: number, r2: number,
  cols: number, rows: number,
  numColors: number,
  pointsPerOrb: number,
  targetColor: OrbColor,
): SwapResult[] {
  const toElim = new Set<string>();
  for (let c=0;c<cols;c++) for (let r=0;r<rows;r++) {
    const o = board[c]?.[r];
    if (o?.color === targetColor) toElim.add(`${c},${r}`);
  }
  toElim.add(`${c1},${r1}`);
  toElim.add(`${c2},${r2}`);

  let scoreGained = 0;
  const eliminated: [number,number][] = [];
  for (const key of toElim) {
    const [c,r] = key.split(",").map(Number);
    const orb = board[c]?.[r]; if (!orb) continue;
    scoreGained += pointsPerOrb * (PTS_SPECIAL[orb.type]??1) * 2;
    eliminated.push([c,r]);
    board[c][r] = null;
  }

  const newOrbs = applyGravity(board, cols, rows, numColors);
  const snapshot: SimpleBoard = board.map(col => [...col]);

  const first: SwapResult = {
    event: { kind:"match", eliminated, specialCreated:[], score:scoreGained, multiplier:2 },
    newOrbIds: new Set(newOrbs.map(o=>o.id)),
    scoreGained,
    boardSnapshot: snapshot,
  };

  return [first, ...runCascadesAndSettle(board, cols, rows, numColors, pointsPerOrb, c1, r1, c2, r2, new Set(), 1)];
}

// ── Swap completo ─────────────────────────────────────────────────────────────
export function processSwap(
  board: SimpleBoard,
  c1: number, r1: number,
  c2: number, r2: number,
  cols: number, rows: number,
  numColors: number,
  pointsPerOrb = 10
): SwapResult[] {
  const orb1 = board[c1]?.[r1];
  const orb2 = board[c2]?.[r2];

  // Special+Special: siempre válido, efectos combinados
  if (isSpecialOrb(orb1) && isSpecialOrb(orb2))
    return processSpecialCombo(board, c1, r1, c2, r2, cols, rows, numColors, pointsPerOrb, orb1, orb2);

  // BOMB + cualquier orb: siempre válido, apunta al color del otro orb
  if (orb1?.type === "BOMB" && orb2)
    return processBombActivation(board, c1, r1, c2, r2, cols, rows, numColors, pointsPerOrb, orb2.color);
  if (orb2?.type === "BOMB" && orb1)
    return processBombActivation(board, c1, r1, c2, r2, cols, rows, numColors, pointsPerOrb, orb1.color);

  if (!wouldMatch(board, c1, r1, c2, r2, cols, rows))
    return [{ event:{kind:"mismatch"}, newOrbIds:new Set(), scoreGained:0 }];

  // Ejecutar swap normal
  const tmp = board[c1][r1]; board[c1][r1]=board[c2][r2]; board[c2][r2]=tmp;

  return runCascadesAndSettle(board, cols, rows, numColors, pointsPerOrb, c1, r1, c2, r2);
}
