"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Flag a nivel de módulo — persiste entre remounts de React StrictMode.
// useRef(false) se reinicia en cada remount, pero este valor no.
let _moduleInitialized = false;
let _gameActive       = false;  // true mientras el jugador está en pantalla de juego
import {
  SimpleBoard, SimpleOrb,
  generateBoard, processSwap, expandBoard, reshuffleBoard, hasPossibleMoves, isValidSwap,
  LEVEL_CONFIG,
} from "./simpleEngine";

export type OrbColor = 1 | 2 | 3 | 4 | 5 | 6;
export type { SimpleOrb as Orb };
export type Board = SimpleBoard;

export interface GameState {
  board: Board;
  cols: number;
  rows: number;
  score: number;
  moves: number;
  level: number;
  isOver: boolean;
  isReady: boolean;
  isAnimating: boolean;
  lastMatch: string | null;
  shakeTrigger: number;
  lastScoreGain: number;
  newOrbIds: Set<number>;
  hintPair: { c1:number; r1:number; c2:number; r2:number } | null;
  comboMultiplier: number;
  levelProgress: number;
  gameId: number;  // se incrementa en cada init() — detecta reinicios en GameCanvas
}

const EMPTY_SET = new Set<number>();

const INITIAL_STATE: GameState = {
  board:[], cols:6, rows:6, score:0, moves:65, level:1,
  isOver:false, isReady:false, isAnimating:false,
  lastMatch:null, shakeTrigger:0, lastScoreGain:0,
  newOrbIds:EMPTY_SET, hintPair:null, comboMultiplier:1, levelProgress:0, gameId:0,
};

const MOVES_GAME  = 65;
const PTS_ORB     = 10;
const FALL_MS_BASE = 450;  // ms base entre cascadas (animaciones duran ~400ms)
const HINT_DELAY  = 8000;  // 8s sin movimiento → mostrar hint
const MAX_ANIM_MS = 4_000;   // máx 4s — cascadas más largas duran ~2.5s

export function useEngine() {
  const boardRef     = useRef<SimpleBoard>([]);
  const scoreRef     = useRef(0);
  const gameIdRef    = useRef(0);
  const movesRef     = useRef(MOVES_GAME);
  const animRef      = useRef(false);
  const levelRef     = useRef(1);
  const elimRef      = useRef(0);
  const hintTimer    = useRef<ReturnType<typeof setTimeout>|null>(null);
  const autoTimer    = useRef<ReturnType<typeof setTimeout>|null>(null);
  const animSafety   = useRef<ReturnType<typeof setTimeout>|null>(null);

  const [state, setState] = useState<GameState>(INITIAL_STATE);

  const clearTimers = useCallback(()=>{
    if(hintTimer.current)   clearTimeout(hintTimer.current);
    if(autoTimer.current)   clearTimeout(autoTimer.current);
    if(animSafety.current)  clearTimeout(animSafety.current);
    hintTimer.current=null; autoTimer.current=null; animSafety.current=null;
  },[]);

  const levelCfg = useCallback(()=>
    LEVEL_CONFIG[Math.min(levelRef.current-1, LEVEL_CONFIG.length-1)],
  []);

  /* ── Buscar hint pair ── */
  const findHintPair = useCallback(():GameState["hintPair"]=>{
    const board=boardRef.current;
    const {cols,rows}=levelCfg();
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      if(c+1<cols && isValidSwap(board,c,r,c+1,r,cols,rows)) return{c1:c,r1:r,c2:c+1,r2:r};
      if(r+1<rows && isValidSwap(board,c,r,c,r+1,cols,rows)) return{c1:c,r1:r,c2:c,r2:r+1};
    }
    return null;
  },[levelCfg]);

  /* ── Reset animación (safety) ── */
  const releaseAnim = useCallback(()=>{
    if(animSafety.current) clearTimeout(animSafety.current);
    animRef.current=false;
    setState(prev=>({...prev,isAnimating:false}));
  },[]);

  /* ── Mostrar hint ── */
  const showHint = useCallback((delay=0)=>{
    if(hintTimer.current)  clearTimeout(hintTimer.current);
    if(autoTimer.current)  clearTimeout(autoTimer.current);
    hintTimer.current=null; autoTimer.current=null;
    const activate=()=>{
      if(animRef.current){ hintTimer.current=setTimeout(activate,400); return; }
      const pair=findHintPair();
      setState(prev=>({...prev,hintPair:pair}));
    };
    if(delay>0) hintTimer.current=setTimeout(activate,delay); else activate();
  },[findHintPair]);

  /* ── Aplicar resultados ── */
  const applyResults = useCallback((results:ReturnType<typeof processSwap>)=>{
    let delay=0;
    // Cada cascada consecutiva es un poco más rápida (efecto de velocidad acumulada)
    // FALL_MS_BASE=800ms → cascada 2: 700ms → cascada 3: 600ms → mínimo 400ms
    let fallMs = FALL_MS_BASE;
    const speedUp = () => { fallMs = Math.max(180, fallMs - 80); };

    // Safety: si algo falla y las animaciones no terminan, liberar tras MAX_ANIM_MS
    if(animSafety.current) clearTimeout(animSafety.current);
    animSafety.current=setTimeout(()=>{
      animRef.current=false;
      setState(prev=>({...prev,isAnimating:false,hintPair:null}));
      showHint(HINT_DELAY);
    }, MAX_ANIM_MS);

    const runNext=(idx:number)=>{
      if(idx>=results.length){
        if(animSafety.current){ clearTimeout(animSafety.current); animSafety.current=null; }
        animRef.current=false;
        showHint(HINT_DELAY);
        return;
      }
      const {event,newOrbIds,scoreGained}=results[idx];

      scoreRef.current += scoreGained;

      // Contar eliminados y preparar level-up (se aplica en SETTLE, no en MATCH)
      if(event.kind==="match"){
        if(idx===0) movesRef.current=Math.max(0,movesRef.current-1);
        elimRef.current += event.eliminated.length;
      }

      setTimeout(()=>{
        // Level-up: sólo al SETTLE para no corromper el estado a mitad de cascade
        let didLevelUp = false;
        if(event.kind==="settle"){
          const cfg=levelCfg();
          if(elimRef.current>=cfg.threshold && levelRef.current<LEVEL_CONFIG.length){
            levelRef.current++;
            const next=LEVEL_CONFIG[levelRef.current-1];
            const newBoard=expandBoard(boardRef.current,cfg.cols,cfg.rows,next.cols,next.rows,next.colors);
            let attempts=0;
            while(!hasPossibleMoves(newBoard,next.cols,next.rows)&&attempts<10){
              reshuffleBoard(newBoard,next.cols,next.rows); attempts++;
            }
            boardRef.current=newBoard;
            movesRef.current=MOVES_GAME;
            didLevelUp=true;
          }
        }

        const {cols:nc,rows:nr}=levelCfg();
        const isOver=movesRef.current<=0&&event.kind==="settle";
        const isAnim=event.kind==="match";
        const isSettle=event.kind==="settle";
        animRef.current=isAnim;

        // CLAVE: para cada MATCH usar el snapshot de ESA cascada específica,
        // no el board final. Esto garantiza que PixiJS anime paso a paso y
        // no muestre el resultado de cascadas futuras en el paso actual.
        const boardForThisStep =
          isSettle ? null
          : (results[idx].boardSnapshot ?? boardRef.current);

        setState(prev=>({
          ...prev,
          board: (isSettle && !didLevelUp)
            ? prev.board  // SETTLE: misma referencia → no dispara syncBoard
            : (boardForThisStep ?? boardRef.current).map(col=>[...col]),
          cols:nc, rows:nr,
          score:scoreRef.current, moves:movesRef.current,
          level:levelRef.current,
          isAnimating:isAnim,
          lastMatch:isAnim?"match":event.kind==="reshuffle"?"reshuffle":null,
          comboMultiplier:isAnim?(event as any).multiplier??1:1,
          levelProgress:Math.min(1, elimRef.current / (levelCfg().threshold||75)),
          lastScoreGain:isSettle?0:scoreGained,
          newOrbIds: isSettle ? EMPTY_SET : newOrbIds,
          isOver, hintPair:null,
        }));
        runNext(idx+1);
      },delay);

      if(event.kind==="match"){ delay+=fallMs; speedUp(); }
    };

    animRef.current=true;
    setState(prev=>({...prev,isAnimating:true,hintPair:null}));
    runNext(0);
  },[levelCfg, showHint]);

  /* ── Ejecutar swap ── */
  const executeSwap=useCallback((c1:number,r1:number,c2:number,r2:number)=>{
    if(hintTimer.current)  clearTimeout(hintTimer.current);
    if(autoTimer.current)  clearTimeout(autoTimer.current);
    hintTimer.current=null; autoTimer.current=null;
    const {cols,rows,colors}=levelCfg();
    const results=processSwap(boardRef.current,c1,r1,c2,r2,cols,rows,colors,PTS_ORB);
    if(results[0]?.event.kind==="mismatch"){
      // Forzar re-sync para snap-back visual
      setState(prev=>({...prev,board:boardRef.current.map(col=>[...col]),
                       shakeTrigger:Date.now(),isAnimating:false}));
      showHint(HINT_DELAY);
    } else {
      applyResults(results);
    }
  },[levelCfg,applyResults,showHint]);

  const executeSwapRef=useRef(executeSwap);
  useEffect(()=>{ executeSwapRef.current=executeSwap; },[executeSwap]);

  /* ── Init ── */
  const init=useCallback((forced=false)=>{
    // Guard multicapa: evita resets accidentales mid-game
    const gameInProgress = _gameActive || scoreRef.current>0 || movesRef.current<MOVES_GAME;
    if(!forced && gameInProgress){
      console.warn(`[useEngine] init() BLOQUEADA — partida activa (score=${scoreRef.current} moves=${movesRef.current} active=${_gameActive}). Usar restart(true) para forzar.`);
      return;
    }
    console.log(`[useEngine] init() EJECUTADA (forced=${forced})`);
    clearTimers();
    scoreRef.current=0; movesRef.current=MOVES_GAME;
    animRef.current=false; levelRef.current=1; elimRef.current=0;
    const {cols,rows,colors}=LEVEL_CONFIG[0];
    let board=generateBoard(cols,rows,colors);
    let attempts=0;
    while(!hasPossibleMoves(board,cols,rows)&&attempts<20){
      reshuffleBoard(board,cols,rows);
      if(attempts===10) board=generateBoard(cols,rows,colors);
      attempts++;
    }
    boardRef.current=board;
    gameIdRef.current++;
    setState({...INITIAL_STATE,board:board.map(col=>[...col]),moves:MOVES_GAME,isReady:true,gameId:gameIdRef.current});
    // 5s desde que el board se muestra ≈ 4s después de que los orbs aterrizan (~1s de animación)
    showHint(5000);
  },[clearTimers,showHint]);

  const didInitRef = useRef(false);
  useEffect(()=>{
    // useRef(false) crea una referencia NUEVA en cada remount (React StrictMode).
    // El módulo-level flag garantiza que init() solo corra una vez por sesión.
    if(didInitRef.current || _moduleInitialized) return;
    didInitRef.current = true;
    _moduleInitialized = true;
    init();
    return()=>clearTimers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  /* ── Swap público ── */
  const swap=useCallback((c1:number,r1:number,c2:number,r2:number)=>{
    _gameActive = true;  // marcar que hay partida activa desde el primer movimiento
    if(state.isOver) return;
    if(animRef.current){
      // Si hay un safety timer activo, significa que las animaciones tardan demasiado.
      // Verificar si el safety ya debería haber disparado pero no lo hizo.
      if(!animSafety.current){
        // No hay safety timer → liberamos manualmente
        animRef.current=false;
        setState(prev=>({...prev,isAnimating:false}));
      } else {
        return; // animación legítima en progreso
      }
    }
    showHint(HINT_DELAY);
    executeSwap(c1,r1,c2,r2);
  },[state.isOver,showHint,executeSwap]);

  const restart=useCallback(()=>{ _gameActive=false; init(true); },[init]);

  return{state,swap,restart,releaseAnim};
}
