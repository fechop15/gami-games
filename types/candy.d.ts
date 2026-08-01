export {};

declare global {
  interface Window {
    Candy: typeof CandyNS;
  }
}

declare namespace CandyNS {
  type OrbColor = 1 | 2 | 3 | 4 | 5 | 6;

  const OrbType: {
    NORMAL: string;
    STRIPPED_VER: string;
    STRIPPED_HOR: string;
    WRAPPED: string;
    BOMB: string;
    PULSATING: string;
    BIG_STRIPED: string;
  };

  const Event: {
    MATCH: string;
    MISMATCH: string;
    REMATCH: string;
    NO_REMATCH: string;
    RESHUFFLE: string;
    NOT_ADJACENT_ORBS_SELECTED: string;
    SET_SEED: string;
  };

  interface OrbPosition {
    c: number;
    r: number;
  }

  interface Orb {
    color: OrbColor;
    type: string;
    id: number;
    mutated: boolean;
    removed: boolean;
    prevPos: OrbPosition;
  }

  interface AffectedOrbs {
    eliminatedOrbs: Orb[];
    mutatedOrbs: Orb[];
    displacementData: unknown[];
  }

  interface MatchEvent extends Event {
    affectedOrbs: AffectedOrbs;
    matchType: string;
    score: number;
  }

  interface BoardConfig {
    cols: number;
    rows: number;
    numOrbs: number;
    moves: number;
  }

  class Engine {
    constructor(
      boardConfig: BoardConfig,
      startLevel: number,
      forcedOrbs: unknown[],
      numColors: number,
      forcedCombo?: unknown
    );
    board: Orb[][];
    cols: number;
    rows: number;
    score: number;
    moves: number;
    numOrbs: number;
    setSeed(seed: number): void;
    onOrbsSelected(p1: OrbPosition, p2: OrbPosition): void;
    checkBoard(): void;
    addEventListener(event: string, handler: (e: MatchEvent) => void, scope?: unknown): void;
    removeEventListener(event: string, handler: (e: MatchEvent) => void): void;
  }
}
