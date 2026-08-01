"use client";

import { useEffect, useRef } from "react";
import { useEngine, GameState } from "./hooks/useEngine";
import { SimpleOrb, SimpleBoard } from "./hooks/simpleEngine";

/* ══════════════════════════════════════════════════════════
   PALETA Y CONSTANTES
   ══════════════════════════════════════════════════════════ */
const C_BG:   Record<number,string> = {1:"#f5350a",2:"#1e90ff",3:"#22c55e",4:"#f59e0b",5:"#a855f7",6:"#06b6d4"};
const C_DK:   Record<number,string> = {1:"#8b1a00",2:"#0a3fa8",3:"#14532d",4:"#78350f",5:"#5b21b6",6:"#0e5f70"};
const C_LT:   Record<number,string> = {1:"#ff9580",2:"#7dd3fc",3:"#86efac",4:"#fde68a",5:"#d8b4fe",6:"#67e8f9"};
const C_HEX:  Record<number,number> = {1:0xf5350a,2:0x1e90ff,3:0x22c55e,4:0xf59e0b,5:0xa855f7,6:0x06b6d4};
const PAD=12, GAP=5;
const HUD_H = 90; // altura reservada para el HUD
const SWIPE_PX = 18; // píxeles mínimos para considerar un gesto como swipe

/* Estado del swipe — nivel de módulo para acceso desde listeners nativos del canvas */
let _dragOrb: { col:number; row:number; startX:number; startY:number } | null = null;

/* ── Geometría ── */
function cs(cols:number,rows:number,W:number,H:number){
  return Math.min((W-PAD*2-(cols-1)*GAP)/cols,(H-PAD*2-(rows-1)*GAP)/rows);
}
function xy(col:number,row:number,cellSz:number,cols:number,rows:number,W:number,H:number){
  const tw=cols*cellSz+(cols-1)*GAP, th=rows*cellSz+(rows-1)*GAP;
  return {x:(W-tw)/2+col*(cellSz+GAP)+cellSz/2, y:(H-th)/2+row*(cellSz+GAP)+cellSz/2};
}

/* ── Canvas texture orb (fallback) ── */
const TEX = new Map<string,HTMLCanvasElement>();
function orbCanvas(color:number,sz:number){
  const k=`${color}:${Math.round(sz)}`; if(TEX.has(k)) return TEX.get(k)!;
  const c=document.createElement("canvas"); c.width=c.height=Math.ceil(sz);
  const ctx=c.getContext("2d")!, r=sz/2;
  const g=ctx.createRadialGradient(sz*.37,sz*.28,0,sz*.5,sz*.5,sz*.54);
  g.addColorStop(0,C_LT[color]??"#fff"); g.addColorStop(.42,C_BG[color]??"#888"); g.addColorStop(1,C_DK[color]??"#222");
  ctx.beginPath(); ctx.arc(r,r,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  const sh=ctx.createLinearGradient(0,sz*.58,0,sz); sh.addColorStop(0,"rgba(0,0,0,0)"); sh.addColorStop(1,"rgba(0,0,0,.32)");
  ctx.fillStyle=sh; ctx.beginPath(); ctx.arc(r,r,r,0,Math.PI*2); ctx.fill();
  const sp=ctx.createRadialGradient(sz*.36,sz*.26,0,sz*.36,sz*.3,sz*.2); sp.addColorStop(0,"rgba(255,255,255,.62)"); sp.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=sp; ctx.beginPath(); ctx.arc(sz*.36,sz*.29,sz*.19,0,Math.PI*2); ctx.fill();
  TEX.set(k,c); return c;
}

/* ── Script loader ── */
/**
 * Wrapper seguro para gsap.to() sobre containers PixiJS.
 * Agrega onStart que mata el tween si el container fue destruido
 * entre el momento en que se crea el tween y el primer tick de GSAP.
 * Esto previene "Cannot read properties of null (reading 'position')".
 */
function ctrTo(gsap:any, ctr:any, vars:Record<string,any>) {
  if(!ctr||ctr.destroyed) return;
  const originalOnStart = vars.onStart;
  return gsap.to(ctr, {
    ...vars,
    onStart(this:any) {
      if(!ctr||ctr.destroyed){ this.kill(); return; }
      originalOnStart?.call(this);
    },
  });
}

function loadScript(src:string):Promise<void>{
  return new Promise((ok,fail)=>{
    if(document.querySelector(`script[src="${src}"]`)){ ok(); return; }
    const s=document.createElement("script"); s.src=src;
    s.onload=()=>ok(); s.onerror=()=>fail(new Error(src));
    document.head.appendChild(s);
  });
}

/* ── Atlas loader ──
   Evita Spritesheet.parse() (que cuelga en este contexto) y crea cada
   PIXI.Texture manualmente usando PIXI.Rectangle — sin callbacks ni timeouts. ── */
async function loadCandyAtlas(PIXI:any):Promise<Record<string,any>>{
  try{
    // 1. Cargar JSON del atlas
    const json=await fetch('/candy_atlas.json').then(r=>{
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    const atlasFrames=json.textures[0].frames as Array<any>;

    // 2. Cargar PNG como Texture (Promise nativa de PixiJS v7)
    const atlasTexture:any = await PIXI.Texture.fromURL('/candy_atlas.png');
    const baseTexture=atlasTexture.baseTexture;

    // 3. Crear cada Texture directamente con PIXI.Rectangle
    //    Sin Spritesheet.parse() — cero callbacks, cero timeouts
    const textures:Record<string,any>={};
    for(const f of atlasFrames){
      const {x,y,w,h}=f.frame;
      textures[f.filename]=new PIXI.Texture(baseTexture, new PIXI.Rectangle(x,y,w,h));
    }

    const count=Object.keys(textures).length;
    if(count===0) throw new Error('0 frames extraídos');
    console.log(`[Atlas] ✓ ${count} frames — orb-1: ${'orb-1' in textures}`);
    return textures;

  }catch(e){
    console.warn('[Atlas] falló — fallback canvas:', e);
    return {};
  }
}

/* ── Frame names for atlas sprites ── */
const ATLAS_FRAME:Record<string,string[]>={
  NORMAL:       ['orb-1','orb-2','orb-3','orb-4','orb-5','orb-6'],
  STRIPPED_VER: ['orb-1-v','orb-2-v','orb-3-v','orb-4-v','orb-5-v','orb-6-v'],
  STRIPPED_HOR: ['orb-1-h','orb-2-h','orb-3-h','orb-4-h','orb-5-h','orb-6-h'],
  WRAPPED:      ['orb-1-wrapped','orb-2-wrapped','orb-3-wrapped','orb-4-wrapped','orb-5-wrapped','orb-6-wrapped'],
  BOMB:         ['color-bomb','color-bomb','color-bomb','color-bomb','color-bomb','color-bomb'],
  PULSATING:    ['orb-1-on','orb-2-on','orb-3-on','orb-4-on','orb-5-on','orb-6-on'],
};

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════ */
interface OrbNode { ctr:any; orb:SimpleOrb; col:number; row:number; hinted?:boolean; baseY?:number; inFall?:boolean; }

export default function GameCanvas() {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const appRef   = useRef<any>(null);
  const { state, swap, restart, releaseAnim } = useEngine();

  /* Refs de capas PixiJS */
  const loadingLayer  = useRef<any>(null);
  const introLayer    = useRef<any>(null);
  const gameLayer     = useRef<any>(null);
  const hudLayer      = useRef<any>(null);
  const boardLayer    = useRef<any>(null);
  const fxLayer       = useRef<any>(null);
  const gameoverLayer = useRef<any>(null);

  /* Refs de texto del HUD */
  const hudScore   = useRef<any>(null);
  const hudMoves   = useRef<any>(null);
  const hudLevel   = useRef<any>(null);
  const hudCombo   = useRef<any>(null);
  const hudLockBar     = useRef<any>(null);  // barra de procesando
  const hudLevelBarRef = useRef<any>(null);  // barra de progreso del nivel

  /* Refs de estado del board */
  const orbMapRef    = useRef(new Map<number,OrbNode>());
  const selRef       = useRef<{col:number;row:number}|null>(null);
  const pendRef      = useRef(false);
  const liveRef      = useRef<GameState & {swap:typeof swap;restart:typeof restart}>({...state,swap,restart});
  const atlasRef     = useRef<Record<string,any>>({});
  const bgTexRef     = useRef<any>(null);  // candy_bg.jpg para intro/loading
  const prevBoardRef = useRef<SimpleBoard|null>(null);
  const fxLayerRef   = useRef<any>(null);   // alias para acceso desde effects
  const prevScore    = useRef(0);           // para animar el contador
  const prevMultiplier = useRef(1);

  /* Pantalla actual */
  const screenRef = useRef<"loading"|"intro"|"playing"|"gameover">("loading");

  /* Animación del progreso de carga */
  const progressBarRef  = useRef<any>(null);
  const progressTextRef = useRef<any>(null);

  /* Hint retry */
  const hintRetry = useRef<ReturnType<typeof setTimeout>|null>(null);

  /* ── Mantener liveRef actualizado ── */
  liveRef.current = { ...state, swap, restart };

  /* ── Score animado — objeto reutilizable para evitar acumular tweens ── */
  const scoreAnimObj = useRef({v:0});
  useEffect(()=>{
    const gsap=(window as any).gsap; if(!gsap||!hudScore.current) return;
    const to=state.score;
    if(scoreAnimObj.current.v===to) return;
    // Cancelar tween anterior antes de iniciar uno nuevo
    gsap.killTweensOf(scoreAnimObj.current);
    gsap.to(scoreAnimObj.current,{v:to,duration:0.4,ease:"power2.out",
      onUpdate:()=>{ if(hudScore.current) hudScore.current.text=Math.round(scoreAnimObj.current.v).toLocaleString(); }
    });
    prevScore.current=to;
  },[state.score]);

  /* ── Combo badge x2, x3... ── */
  useEffect(()=>{
    const PIXI=(window as any).PIXI, gsap=(window as any).gsap;
    if(!PIXI||!gsap||screenRef.current!=="playing") return;
    const mult=state.comboMultiplier;
    if(mult<2||mult===prevMultiplier.current) return;
    prevMultiplier.current=mult;

    const stage=appRef.current?.stage; if(!stage) return;
    const wrap=wrapRef.current;
    const W=wrap?.clientWidth||430, H=wrap?.clientHeight||800;

    const txt=new PIXI.Text(`×${mult}`,new PIXI.TextStyle({
      fontFamily:"system-ui,sans-serif",fontWeight:"900",
      fontSize:74,
      fill:mult>=3?["#ff4500","#ff0080"]:["#ffd700","#ff8c00"],
      fillGradientType:0,
      stroke:"#1a0030",strokeThickness:5,
      dropShadow:true,dropShadowDistance:4,dropShadowBlur:10,dropShadowColor:"#000",
    }));
    txt.anchor.set(.5); txt.x=W/2; txt.y=H*.38;
    txt.scale.set(0); txt.alpha=0;
    stage.addChild(txt);

    gsap.timeline()
      .to(txt.scale,{x:1.25,y:1.25,duration:.18,ease:"back.out(2.5)"})
      .to(txt,{alpha:1,duration:.12},"<")
      .to(txt.scale,{x:1,y:1,duration:.1})
      .to(txt,{y:H*.28,alpha:0,duration:.45,delay:.4,ease:"power2.in"})
      .call(()=>{ if(txt.parent) txt.parent.removeChild(txt); txt.destroy(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.comboMultiplier]);

  /* ── Barra de progreso / "lock" mientras isAnimating ── */
  useEffect(()=>{
    const gsap=(window as any).gsap; if(!gsap) return;
    const bar=hudLockBar.current; if(!bar) return;
    if(state.isAnimating){
      gsap.killTweensOf(bar);
      bar.alpha=1;
      gsap.to(bar,{alpha:.35,duration:.4,yoyo:true,repeat:-1,ease:"sine.inOut"});
    } else {
      gsap.killTweensOf(bar);
      gsap.to(bar,{alpha:0,duration:.25});
      prevMultiplier.current=1;  // resetear para el próximo combo
    }
  },[state.isAnimating]);

  /* ── Hint: useEffect React detecta cambios de estado correctamente ── */
  useEffect(()=>{
    if(screenRef.current !== "playing") return;
    const gsap=(window as any).gsap; if(!gsap) return;
    if(hintRetry.current){ clearTimeout(hintRetry.current); hintRetry.current=null; }

    const tryApply=()=>{
      const ok=applyHint(gsap,state.hintPair,state.board,orbMapRef);
      if(!ok && state.hintPair) hintRetry.current=setTimeout(tryApply,400);
    };
    tryApply();

    return ()=>{ if(hintRetry.current){ clearTimeout(hintRetry.current); hintRetry.current=null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.hintPair]);

  /* ══ DEBUG LOGS ══ */
  // Descomenta para debug: console.log('[DEBUG] state:', state.gameId, state.score, state.moves);

  /* ── PRIMERO: Limpieza cuando el juego se reinicia (gameId cambia)
     DEBE estar ANTES del board sync — si está después, el board crea orbs
     y luego este efecto los destruye → orbs pisados / tablero vacío ── */
  const prevGameId = useRef(0);
  useEffect(()=>{
    if(state.gameId === 0 || state.gameId === prevGameId.current) return;
    console.log(`[GameCanvas] gameId cambió ${prevGameId.current}→${state.gameId} — limpiando orbs`);
    prevGameId.current = state.gameId;
    const gsap=(window as any).gsap;
    orbMapRef.current.forEach(node=>{
      if(!node.ctr||node.ctr.destroyed) return;
      if(gsap){ gsap.killTweensOf(node.ctr); gsap.killTweensOf(node.ctr.scale); }
      if(node.ctr.parent) node.ctr.parent.removeChild(node.ctr);
      node.ctr.destroy({children:true});
    });
    orbMapRef.current.clear();
    selRef.current=null; pendRef.current=false;
    prevBoardRef.current=null;
    prevDimsRef.current={cols:0,rows:0}; // forzar rebuild de tiles con dimensiones correctas
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.gameId]);

  /* ── SEGUNDO: Board sync via useEffect ── */
  const prevDimsRef = useRef({cols:6,rows:6});

  useEffect(()=>{
    if(screenRef.current !== "playing") return;
    if(state.board === prevBoardRef.current) return;
    const PIXI=(window as any).PIXI, gsap=(window as any).gsap;
    if(!PIXI||!gsap||!boardLayer.current) return;
    prevBoardRef.current = state.board;
    // Liberar pendRef cuando llega una actualización del board
    // (el swap completó o hubo mismatch — en ambos casos pendRef debe ser false)
    pendRef.current = false;
    const wrap=wrapRef.current;
    const W=wrap?.clientWidth||window.innerWidth;
    const H=(wrap?.clientHeight||window.innerHeight)-HUD_H;

    // Reconstruir tiles si el board creció (level up)
    const dimChanged = state.cols!==prevDimsRef.current.cols || state.rows!==prevDimsRef.current.rows;
    if(dimChanged){
      prevDimsRef.current={cols:state.cols,rows:state.rows};
      buildTiles(PIXI,boardLayer.current,state.cols,state.rows,W,H);
      // Limpiar todos los orbs viejos — serán recreados con coordenadas correctas
      // Matar TODOS los tweens ANTES de destruir — evita el error GSAP null position
      orbMapRef.current.forEach(node=>{
        if(!node.ctr||node.ctr.destroyed) return;
        gsap.killTweensOf(node.ctr);
        gsap.killTweensOf(node.ctr.scale);
        // Matar tweens de hijos también
        node.ctr.children?.forEach?.((child:any)=>{ gsap.killTweensOf(child); });
        if(node.ctr.parent) node.ctr.parent.removeChild(node.ctr);
        node.ctr.destroy({children:true});
      });
      orbMapRef.current.clear();
      selRef.current=null; pendRef.current=false;
    }

    syncBoard({PIXI,gsap,stage:boardLayer.current,fx:fxLayer.current,
               orbMapRef,selRef,pendRef,live:liveRef,board:state.board,
               cols:state.cols,rows:state.rows,W,H,
               newOrbIds:state.newOrbIds,isInitial:dimChanged,atlasRef});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.board]);

  /* ── HUD update via useEffect ── */
  useEffect(()=>{
    if(hudScore.current) hudScore.current.text = state.score.toLocaleString();
    if(hudMoves.current) hudMoves.current.text = String(state.moves);
    if(hudLevel.current) hudLevel.current.text = String(state.level);
    if(hudCombo.current){
      const lm=state.lastMatch;
      hudCombo.current.text  = lm==="reshuffle"?"🔀 Mezclando…":lm?"🔥 ¡Combo!":"";
      hudCombo.current.alpha = lm ? 1 : 0;
    }
  },[state.score,state.moves,state.level,state.lastMatch]);


  /* ── Barra de progreso del nivel ── */
  useEffect(()=>{
    const gsap=(window as any).gsap;
    const bar=hudLevelBarRef.current;
    if(!gsap||!bar) return;
    const pct=state.levelProgress;
    // Animar el width de la barra usando scaleX (más eficiente que redraw)
    gsap.to(bar.scale,{x:pct,duration:.5,ease:"power2.out"});
    // Flash dorado al subir de nivel
    if(pct===0&&state.level>1){
      // Flash: la barra se ilumina al subir de nivel
      gsap.fromTo(bar,{alpha:0},{alpha:1,duration:.5,ease:"power2.out"});
    }
  },[state.levelProgress,state.level]);

  /* ── Celebración de level-up ── */
  const prevLevelRef = useRef(1);
  useEffect(()=>{
    const PIXI=(window as any).PIXI, gsap=(window as any).gsap;
    if(!PIXI||!gsap||screenRef.current!=="playing"){ prevLevelRef.current=state.level; return; }
    if(state.level<=prevLevelRef.current){ prevLevelRef.current=state.level; return; }
    prevLevelRef.current=state.level;

    const stage=appRef.current?.stage; if(!stage) return;
    const wrap=wrapRef.current;
    const W=Math.min(wrap?.clientWidth||430,430), H=wrap?.clientHeight||800;

    // Flash de pantalla
    const flash=new PIXI.Graphics();
    flash.beginFill(0xffffff,1); flash.drawRect(0,0,W,H); flash.endFill(); flash.alpha=0;
    stage.addChild(flash);
    gsap.to(flash,{alpha:.45,duration:.12,yoyo:true,repeat:1,ease:"sine.inOut",
      onComplete:()=>{ gsap.killTweensOf(flash); if(flash.parent) stage.removeChild(flash); flash.destroy(); }});

    // Banner "¡NIVEL X!"
    const cont=new PIXI.Container(); cont.x=W/2; cont.y=H*.42;
    const txt=new PIXI.Text(`¡NIVEL ${state.level}!`,new PIXI.TextStyle({
      fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:54,
      fill:["#ffffff","#ffd700"],fillGradientType:0,
      stroke:"#2a0060",strokeThickness:6,
      dropShadow:true,dropShadowDistance:4,dropShadowBlur:12,dropShadowColor:"#000",
    }));
    txt.anchor.set(.5); cont.addChild(txt);
    const sub=new PIXI.Text("¡Tablero ampliado!",new PIXI.TextStyle({
      fontFamily:"system-ui,sans-serif",fontWeight:"700",fontSize:16,fill:0xffeecc,letterSpacing:.5,
    }));
    sub.anchor.set(.5); sub.y=46; cont.addChild(sub);
    cont.scale.set(0); cont.alpha=0; stage.addChild(cont);
    gsap.timeline()
      .to(cont.scale,{x:1,y:1,duration:.42,ease:"back.out(2)"})
      .to(cont,{alpha:1,duration:.2},"<")
      .to(cont,{alpha:0,duration:.4,delay:1,ease:"power2.in"})
      .to(cont.scale,{x:1.18,y:1.18,duration:.4},"<")
      .call(()=>{ gsap.killTweensOf(cont); gsap.killTweensOf(cont.scale); if(cont.parent) stage.removeChild(cont); cont.destroy({children:true}); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.level]);

  /* ── Game over via useEffect ── */
  useEffect(()=>{
    if(!state.isOver||screenRef.current!=="playing") return;
    const PIXI=(window as any).PIXI, gsap=(window as any).gsap;
    const wrap=wrapRef.current;
    if(!PIXI||!gsap||!wrap) return;
    setTimeout(()=>transitionToRef.current?.("gameover",PIXI,gsap,wrap.clientWidth,wrap.clientHeight),800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.isOver]);

  /* ── Shake via useEffect ── */
  useEffect(()=>{
    if(!state.shakeTrigger) return;
    const gsap=(window as any).gsap;
    if(!gsap||!boardLayer.current) return;
    gsap.killTweensOf(boardLayer.current);
    gsap.to(boardLayer.current,{x:-14,duration:.05,yoyo:true,repeat:9,ease:"none",onComplete:()=>{boardLayer.current.x=0;}});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.shakeTrigger]);

  /* Ref to transitionTo so useEffect closures can call latest version */
  const transitionToRef = useRef<((to:"intro"|"playing"|"gameover",PIXI:any,gsap:any,W:number,H:number)=>void)|null>(null);

  /* ════════════════════════════════════════════════════════
     INIT PIXI — carga scripts, construye escenas
     ════════════════════════════════════════════════════════ */
  useEffect(()=>{
    const wrap = wrapRef.current; if(!wrap) return;
    let dead = false;
    let canvasListeners: { canvas:HTMLCanvasElement; up:(e:PointerEvent)=>void; cancel:()=>void } | null = null;

    const updateHud = ()=>{
      if(hudScore.current) hudScore.current.text = liveRef.current.score.toLocaleString();
      if(hudMoves.current) hudMoves.current.text = String(liveRef.current.moves);
      if(hudLevel.current) hudLevel.current.text = String(liveRef.current.level);
      if(hudCombo.current){
        const lm=liveRef.current.lastMatch;
        hudCombo.current.text  = lm==="reshuffle"?"🔀 Mezclando…":lm?"🔥 ¡Combo!":"";
        hudCombo.current.alpha = lm ? 1 : 0;
      }
    };

    const transitionTo = (to:"intro"|"playing"|"gameover",PIXI:any,gsap:any,W:number,H:number)=>{
      screenRef.current = to;
      const fadeOut=(l:any,cb?:()=>void)=>{ if(!l){cb?.();return;} gsap.killTweensOf(l); gsap.to(l,{alpha:0,duration:.4,onComplete:()=>{ if(l){ l.visible=false; l.interactiveChildren=false; } cb?.(); }}); };
      const fadeIn =(l:any)=>{ if(l){ gsap.killTweensOf(l); l.visible=true; gsap.to(l,{alpha:1,duration:.4}); } };

      if(to==="intro"){
        fadeOut(loadingLayer.current,()=>{ if(loadingLayer.current) loadingLayer.current.visible=false; });
        fadeOut(gameoverLayer.current); fadeOut(gameLayer.current);

        // Limpiar introLayer completamente y reconstruir contenido + burbujas
        const il=introLayer.current;
        if(il){
          // Matar todos los tweens de hijos anteriores
          const prev=[...Array(il.children.length)].map((_,i)=>il.getChildAt(i));
          prev.forEach((c:any)=>{ gsap.killTweensOf(c); gsap.killTweensOf((c as any).scale); });
          il.removeChildren().forEach((c:any)=>{ if(c&&!c.destroyed) c.destroy({children:true}); });

          // 1 — Burbujas flotantes al fondo
          buildFloatingBubbles(PIXI,gsap,il,W,H,atlasRef);

          // 2 — Contenido estático encima (título, botón)
          const content=buildIntroScreen(PIXI,gsap,W,H,null,()=>transitionTo("playing",PIXI,gsap,W,H));
          // Mover hijos de content a il (content es un contenedor temporal)
          while(content.children.length>0) il.addChild(content.removeChildAt(0));
          content.destroy();
        }
        il.alpha=0;
        fadeIn(il);
      }
      if(to==="playing"){
        orbMapRef.current.clear();
        selRef.current=null; pendRef.current=false;
        // Matar todos los tweens infinitos de la intro (bubbles, icon)
        // antes de que el jugador empiece — evita acumulación de GSAP trabajo
        const il=introLayer.current;
        if(il){
          const children=[...Array(il.children.length)].map((_,i)=>il.getChildAt(i));
          children.forEach((c:any)=>{ gsap.killTweensOf(c); });
        }
        gsap.killTweensOf(introLayer.current);
        fadeOut(introLayer.current,()=>{
          // Destruir hijos de intro después del fadeout para liberar memoria
          const il2=introLayer.current;
          if(il2){
            il2.removeChildren().forEach((c:any)=>{ if(!c.destroyed) c.destroy({children:true}); });
          }
        });
        fadeOut(gameoverLayer.current);
        const board=liveRef.current.board, cols=liveRef.current.cols, rows=liveRef.current.rows;
        // FIX #2: usar H-HUD_H (no H-100) para el área disponible del board
        const BH=H-HUD_H;
        buildTiles(PIXI,boardLayer.current,cols,rows,W,BH);
        syncBoard({PIXI,gsap,stage:boardLayer.current,fx:fxLayer.current,
                   orbMapRef,selRef,pendRef,live:liveRef,board,cols,rows,W,H:BH,
                   newOrbIds:liveRef.current.newOrbIds,isInitial:true,atlasRef});
        // Guardar estado del board Y dimensiones para evitar dimChanged falso en useEffect
        prevBoardRef.current = board;
        prevDimsRef.current = {cols, rows};
        updateHud();
        // Matar cualquier tween activo y restaurar visibilidad + interacciones
        if(gameLayer.current){
          gsap.killTweensOf(gameLayer.current);
          gameLayer.current.alpha=1;
          gameLayer.current.visible=true;
          gameLayer.current.interactiveChildren=true;  // restaurar interacciones del board
        }

        // Hint 4s después de que los orbs aterrizan (animación de entrada ~1s + 4s = 5s total)
        setTimeout(()=>{
          const pair=liveRef.current.hintPair;
          const tryFind=()=>{
            const p=liveRef.current.hintPair;
            if(p){ applyHint(gsap,p,liveRef.current.board,orbMapRef); return; }
            setTimeout(tryFind,500);
          };
          if(pair) applyHint(gsap,pair,liveRef.current.board,orbMapRef);
          else setTimeout(tryFind,500);
        },5000);
      }
      if(to==="gameover"){
        const gol=gameoverLayer.current; if(!gol) return;
        const scoreT=gol.getChildByName?.("score_val");
        if(scoreT) scoreT.text=liveRef.current.score.toLocaleString();
        // Matar cualquier tween previo y asegurarse de que sea visible e interactivo
        gsap.killTweensOf(gol);
        gol.alpha=0;
        gol.visible=true;
        gol.interactiveChildren=true;
        gsap.to(gol,{alpha:1,duration:.4});
      }
    };

    transitionToRef.current = transitionTo;

    (async ()=>{
      await loadScript("/pixi.min.js");
      if(dead) return;
      const PIXI = (window as any).PIXI;

      // Limitar a 430px máx (tamaño del juego original) para que los sprites
      // del atlas (65px frames) queden a escala nativa sin upscaling borroso.
      // resolution:1 evita que PixiJS escale los sprites por devicePixelRatio.
      const MAX_W = 430;
      const W = Math.min(wrap.clientWidth || window.innerWidth, MAX_W);
      const H = wrap.clientHeight || window.innerHeight;

      // Canvas completamente transparente — el CSS candy_bg.jpg se ve a través
      const app = new PIXI.Application({width:W,height:H,backgroundAlpha:0,antialias:true,
                                         resolution:1,autoDensity:false});
      wrap.appendChild(app.view);
      appRef.current = app;
      // El canvas debe ser transparent (CSS)
      (app.view as HTMLCanvasElement).style.background='transparent';

      // NO buildBackground() — el CSS maneja el fondo
      const ll = buildLoadingScreen(PIXI,W,H,null,progressBarRef,progressTextRef);
      loadingLayer.current = ll; app.stage.addChild(ll);

      setProgress(PIXI,progressBarRef,progressTextRef,W,0.1,"Iniciando…");
      await loadScript("/gsap.min.js");
      if(dead) return;
      const gsap = (window as any).gsap;
      setProgress(PIXI,progressBarRef,progressTextRef,W,0.4,"Cargando assets…");

      // Solo cargar atlas — fondo viene del CSS
      const atlasTextures = await loadCandyAtlas(PIXI);
      atlasRef.current = atlasTextures;
      setProgress(PIXI,progressBarRef,progressTextRef,W,0.6,"Cargando assets…");

      // Intro sin sprite de fondo (el CSS es el fondo)
      const il = buildIntroScreen(PIXI,gsap,W,H,null,()=>transitionTo("playing",PIXI,gsap,W,H));
      introLayer.current = il; il.alpha=0; app.stage.addChild(il);

      const gl = new PIXI.Container(); gameLayer.current=gl; gl.alpha=0; app.stage.addChild(gl);

      const hl = buildHud(PIXI,W,hudScore,hudMoves,hudLevel,hudCombo,hudLockBar,hudLevelBarRef);
      hudLayer.current=hl; gl.addChild(hl);

      // FIX #2: boardLayer en y=HUD_H para quedar justo debajo del HUD
      const stg = new PIXI.Container(); stg.y=HUD_H; boardLayer.current=stg; gl.addChild(stg);
      // FIX #3: fxl.y=HUD_H (antes decía stg.y=90 por segunda vez)
      const fxl = new PIXI.Container(); fxl.y=HUD_H; fxLayer.current=fxl; gl.addChild(fxl);

      const gol = buildGameOver(PIXI,gsap,W,H,()=>{
        restart();
        // Esperar a que React procese el setState de init() antes de transicionar.
        // Sin el delay, liveRef.current.board todavía tiene el board viejo y
        // transitionTo crea tiles/orbs con las dimensiones del nivel anterior.
        setTimeout(()=>transitionTo("playing",PIXI,gsap,W,H), 80);
      });
      gameoverLayer.current=gol;
      gol.alpha=0;
      gol.visible=false;          // invisible hasta que sea necesario
      gol.interactiveChildren=false; // botones NO activos cuando invisible
      app.stage.addChild(gol);

      setProgress(PIXI,progressBarRef,progressTextRef,W,0.85,"Generando tablero…");

      const waitReady = ():Promise<void>=>{
        if(liveRef.current.isReady) return Promise.resolve();
        return new Promise(r=>setTimeout(()=>waitReady().then(r),100));
      };
      await waitReady();
      if(dead) return;

      setProgress(PIXI,progressBarRef,progressTextRef,W,1,"¡Listo!");
      await new Promise(r=>setTimeout(r,500));

      transitionTo("intro",PIXI,gsap,W,H);

      // ── Swipe / tap sobre el canvas ──────────────────────────────────────────
      const BH = H - HUD_H;
      const canvas = app.view as HTMLCanvasElement;
      const onCanvasPointerUp = (e: PointerEvent) => {
        if (!_dragOrb || screenRef.current !== "playing") { _dragOrb = null; return; }
        const d = _dragOrb; _dragOrb = null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / (rect.width  || 1);
        const scaleY = canvas.height / (rect.height || 1);
        const endX = (e.clientX - rect.left) * scaleX;
        const endY = (e.clientY - rect.top)  * scaleY;
        const dx = endX - d.startX, dy = endY - d.startY;
        const absDx = Math.abs(dx), absDy = Math.abs(dy);
        const { cols: gc, rows: gr } = liveRef.current;
        const cellSz = cs(gc, gr, W, BH);
        if (Math.max(absDx, absDy) < SWIPE_PX) {
          // Toque sin desplazamiento → flujo de selección normal
          handleClick(d.col, d.row, PIXI, gsap, boardLayer.current, orbMapRef, selRef, pendRef, liveRef, cellSz, gc, gr, W, BH);
          return;
        }
        // Swipe: determinar celda destino según dirección
        const { board, isAnimating, swap: doSwap } = liveRef.current;
        if (isAnimating || pendRef.current) return;
        let tc = d.col, tr = d.row;
        if (absDx >= absDy) tc = dx > 0 ? d.col + 1 : d.col - 1;
        else                tr = dy > 0 ? d.row + 1 : d.row - 1;
        if (tc < 0 || tc >= gc || tr < 0 || tr >= gr) return;
        const o1 = board[d.col]?.[d.row], o2 = board[tc]?.[tr];
        if (!o1 || !o2) return;
        const map = orbMapRef.current!;
        const n1 = map.get(o1.id), n2 = map.get(o2.id); if (!n1 || !n2) return;
        const p1 = xy(tc, tr, cellSz, gc, gr, W, BH);
        const p2 = xy(d.col, d.row, cellSz, gc, gr, W, BH);
        // Limpiar selección previa si existe
        map.forEach(n => { if (n.ctr[SEL_KEY]) { n.ctr[SEL_KEY]=false; gsap?.killTweensOf(n.ctr); gsap?.to(n.ctr,{alpha:1,duration:.15}); } });
        selRef.current = null;
        pendRef.current = true;
        const t = setTimeout(() => { pendRef.current = false; }, 500);
        gsap.to(n1.ctr, { x:p1.x, y:p1.y, duration:.22, ease:"power2.inOut" });
        gsap.to(n2.ctr, { x:p2.x, y:p2.y, duration:.22, ease:"power2.inOut",
          onComplete: () => { clearTimeout(t); pendRef.current=false; doSwap(d.col, d.row, tc, tr); }
        });
      };
      const onCanvasPointerCancel = () => { _dragOrb = null; };
      canvas.addEventListener("pointerup",     onCanvasPointerUp);
      canvas.addEventListener("pointercancel", onCanvasPointerCancel);
      canvasListeners = { canvas, up: onCanvasPointerUp, cancel: onCanvasPointerCancel };

      // Ticker: solo HUD y shake (board sync se hace via useEffect)
      const prevTicker = { score:-1, moves:-1, lastMatch:null as any, shake:0, isOver:false };
      app.ticker.add(()=>{
        const s=liveRef.current;
        if(!s||screenRef.current==="loading") return;
        if(s.score!==prevTicker.score||s.moves!==prevTicker.moves||s.lastMatch!==prevTicker.lastMatch){
          prevTicker.score=s.score; prevTicker.moves=s.moves; prevTicker.lastMatch=s.lastMatch;
          updateHud();
        }
      });
    })();

    return ()=>{
      dead=true;
      _dragOrb = null;
      // Matar TODOS los tweens pendientes antes de destruir PixiJS — evita que
      // FX en vuelo (puntaje flotante, partículas, banner…) tickeen sobre
      // objetos ya destruidos ("Cannot read properties of null (reading 'position')").
      const g=(window as any).gsap;
      if(g){ try{ g.globalTimeline.clear(); }catch{} }
      canvasListeners?.canvas.removeEventListener("pointerup",     canvasListeners.up);
      canvasListeners?.canvas.removeEventListener("pointercancel", canvasListeners.cancel);
      if(hintRetry.current) clearTimeout(hintRetry.current);
      if(appRef.current){ appRef.current.destroy(true,{children:true}); appRef.current=null; }
      TEX.clear(); orbMapRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  return (
    <div style={{
      width:"100dvw",height:"100dvh",display:"flex",
      alignItems:"flex-start",justifyContent:"center",
      background:`url('/candy_bg.jpg') center/cover no-repeat`,
      overflow:"hidden",
    }}>
      <div ref={wrapRef} style={{width:"430px",maxWidth:"100dvw",height:"100dvh",overflow:"hidden",flexShrink:0}} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PANTALLA DE CARGA
   ══════════════════════════════════════════════════════════ */
function buildBackground(PIXI:any,W:number,H:number){
  const g=new PIXI.Graphics();
  // Gradiente: azul claro arriba → violeta medio → rosa/magenta abajo (como el juego de referencia)
  const colors=[0x1a6fd4,0x2255c8,0x3b2aaa,0x5c1e9e,0x8c1a8a,0xb5206e,0xd4255a];
  const steps=colors.length;
  for(let i=0;i<steps;i++){
    g.beginFill(colors[i],1);
    g.drawRect(0,H*i/steps,W,H/steps+2);
    g.endFill();
  }
  // Destello sutil en la parte superior (efecto cielo)
  g.beginFill(0x80cfff,.12); g.drawEllipse(W/2,-30,W*.8,100); g.endFill();
  return g;
}

function buildLoadingScreen(PIXI:any,W:number,H:number,_bgTex:any,barRef:any,textRef:any){
  const layer=new PIXI.Container();
  const cy=H*.44;

  // Overlay oscuro sobre el fondo CSS
  const ov=new PIXI.Graphics();
  ov.beginFill(0x05001a,.6); ov.drawRect(0,0,W,H); ov.endFill();
  layer.addChild(ov);

  // Ícono 🍬
  const icon=new PIXI.Text("🍬",new PIXI.TextStyle({fontSize:80}));
  icon.anchor.set(.5); icon.x=W/2; icon.y=cy-70; layer.addChild(icon);

  // Título
  const title=new PIXI.Text("CANDY FIESTA",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:38,
    fill:["#ffffff","#ffd700"],fillGradientType:0,
    stroke:"#2a0060",strokeThickness:5,
    dropShadow:true,dropShadowDistance:4,dropShadowBlur:14,dropShadowColor:"#000",
  }));
  title.anchor.set(.5); title.x=W/2; title.y=cy+6; layer.addChild(title);

  // Barra de progreso — contenedor independiente de fácil acceso
  const bw=Math.min(W*.78, 320), bh=14;
  const bx=(W-bw)/2, by=cy+52;

  // Fondo de barra
  const barBg=new PIXI.Graphics();
  barBg.beginFill(0x000000,.4); barBg.drawRoundedRect(bx-2,by-2,bw+4,bh+4,9); barBg.endFill();
  barBg.beginFill(0xffffff,.1); barBg.drawRoundedRect(bx,by,bw,bh,7); barBg.endFill();
  layer.addChild(barBg);

  // Fill de barra (se redibuja en setProgress)
  const barFill=new PIXI.Graphics();
  barFill.name="fill";
  // Guardamos dimensiones en el objeto para setProgress
  (barFill as any).__bx=bx; (barFill as any).__by=by;
  (barFill as any).__bw=bw; (barFill as any).__bh=bh;
  barRef.current=barFill;
  layer.addChild(barFill);

  // Texto de estado
  const txt=new PIXI.Text("Cargando…",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"600",fontSize:13,
    fill:0xffffff,alpha:.72,letterSpacing:.5,
  }));
  txt.anchor.set(.5); txt.x=W/2; txt.y=by+bh+16;
  textRef.current=txt; layer.addChild(txt);

  return layer;
}

function setProgress(_PIXI:any,barRef:any,textRef:any,_W:number,pct:number,msg:string){
  const bar=barRef.current; if(!bar) return;
  const bx=(bar as any).__bx;
  const by=(bar as any).__by;
  const bw=(bar as any).__bw;
  const bh=(bar as any).__bh;
  if(bx===undefined||by===undefined) return;

  bar.clear();
  const fw=Math.max(0, bw*Math.min(1,pct));
  if(fw>4){
    // Gradiente simulado: naranja → amarillo
    bar.beginFill(0xff4400,1); bar.drawRoundedRect(bx,by,fw,bh,7); bar.endFill();
    if(fw>20){
      bar.beginFill(0xffc000,.6); bar.drawRoundedRect(bx,by,fw*.45,bh/2,4); bar.endFill();
    }
    // Destello en el frente de la barra
    bar.beginFill(0xffffff,.25); bar.drawRoundedRect(bx+fw-12,by+1,10,bh-2,4); bar.endFill();
  }
  if(textRef.current) textRef.current.text=msg;
}

/* ══════════════════════════════════════════════════════════
   INTRO SCREEN
   ══════════════════════════════════════════════════════════ */
function buildIntroScreen(PIXI:any,gsap:any,W:number,H:number,_bgTex:any,onPlay:()=>void){
  const layer=new PIXI.Container();
  // NO empieza en alpha=0 — los hijos arrancan visibles para no depender de GSAP delays
  // El fade-in del layer lo maneja transitionTo

  // Overlay semitransparente para legibilidad sobre el fondo candy
  const ov=new PIXI.Graphics();
  ov.beginFill(0x05001a,.52); ov.drawRect(0,0,W,H); ov.endFill();
  layer.addChild(ov);

  // Panel central detrás del contenido
  const panelW=W*.88, panelH=H*.58;
  const panel=new PIXI.Graphics();
  panel.beginFill(0x0a0030,.35);
  panel.drawRoundedRect((W-panelW)/2,H*.22,panelW,panelH,20);
  panel.endFill();
  layer.addChild(panel);

  // Título CANDY
  const titleY=H*.30;
  const fsCandy=Math.min(W*.165,68);
  const candy=new PIXI.Text("CANDY",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:fsCandy,
    fill:["#ffffff","#ffe566"],fillGradientType:0,
    stroke:"#2a0060",strokeThickness:6,
    dropShadow:true,dropShadowDistance:4,dropShadowBlur:14,dropShadowColor:"#000",
  }));
  candy.anchor.set(.5); candy.x=W/2; candy.y=titleY; layer.addChild(candy);

  // Título FIESTA
  const fsFiesta=Math.min(W*.11,46);
  const fiestaY=titleY+fsCandy*.88;
  const fiesta=new PIXI.Text("FIESTA",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:fsFiesta,
    fill:["#ff7b00","#ff2d78"],fillGradientType:0,
    stroke:"#1a0030",strokeThickness:4,
    dropShadow:true,dropShadowDistance:3,dropShadowBlur:10,dropShadowColor:"#000",
  }));
  fiesta.anchor.set(.5); fiesta.x=W/2; fiesta.y=fiestaY; layer.addChild(fiesta);

  // Subtítulo
  const subY=fiestaY+fsFiesta+16;
  const sub=new PIXI.Text("Combiná 3 o más del mismo color",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontSize:13,fill:0xffeecc,alpha:.88,letterSpacing:.4,
  }));
  sub.anchor.set(.5); sub.x=W/2; sub.y=subY; layer.addChild(sub);

  // Dots de colores
  const dotY=subY+40;
  const COLS=[0xf5350a,0x1e90ff,0x22c55e,0xf59e0b,0xa855f7];
  COLS.forEach((col,i)=>{
    const dot=new PIXI.Graphics();
    dot.beginFill(col,1); dot.drawCircle(0,0,13); dot.endFill();
    dot.beginFill(0xffffff,.35); dot.drawCircle(-4,-4,5); dot.endFill();
    dot.x=W/2+(i-2)*W*.14; dot.y=dotY;
    layer.addChild(dot);
    gsap.to(dot,{y:dotY-6,duration:.7+i*.06,yoyo:true,repeat:-1,ease:"sine.inOut",delay:i*.12});
  });

  // Botón ¡JUGAR!
  const btnW=Math.min(W*.65,230), btnH=56;
  const btnX=W/2-btnW/2, btnY=dotY+48;
  const btn=new PIXI.Container();
  btn.x=btnX; btn.y=btnY;

  const shadow=new PIXI.Graphics();
  shadow.beginFill(0x000000,.28); shadow.drawRoundedRect(3,5,btnW,btnH,btnH/2); shadow.endFill();
  btn.addChild(shadow);

  const bg=new PIXI.Graphics();
  bg.beginFill(0xff5500,1); bg.drawRoundedRect(0,0,btnW,btnH,btnH/2); bg.endFill();
  bg.beginFill(0xff9000,.7); bg.drawRoundedRect(0,0,btnW,btnH*.45,btnH/2); bg.endFill();
  bg.beginFill(0xff5500,1); bg.drawRoundedRect(0,btnH*.22,btnW,btnH*.78,btnH/2); bg.endFill();
  bg.beginFill(0xffffff,.2); bg.drawRoundedRect(8,5,btnW-16,18,9); bg.endFill();
  btn.addChild(bg);

  const txt=new PIXI.Text("¡ JUGAR !",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:25,
    fill:["#ffffff","#fff3b0"],fillGradientType:0,
    stroke:"#771100",strokeThickness:3,
    dropShadow:true,dropShadowDistance:2,dropShadowBlur:5,dropShadowColor:"#000",
  }));
  txt.anchor.set(.5); txt.x=btnW/2; txt.y=btnH/2; btn.addChild(txt);

  btn.interactive=true; btn.buttonMode=true; btn.cursor="pointer";
  layer.addChild(btn);

  // Pulso del botón
  gsap.to(btn.scale,{x:1.05,y:1.05,duration:.85,yoyo:true,repeat:-1,ease:"sine.inOut",delay:.5});

  btn.on("pointerdown",()=>{
    gsap.killTweensOf(btn.scale);
    gsap.to(btn.scale,{x:.93,y:.93,duration:.08,yoyo:true,repeat:1,
      onComplete:()=>{ gsap.to(btn.scale,{x:1.05,y:1.05,duration:.85,yoyo:true,repeat:-1,ease:"sine.inOut"}); }
    });
    onPlay();
  });
  btn.on("pointerover",()=>{ gsap.killTweensOf(btn.scale); gsap.to(btn.scale,{x:1.08,y:1.08,duration:.12}); });
  btn.on("pointerout", ()=>{ gsap.killTweensOf(btn.scale); gsap.to(btn.scale,{x:1.05,y:1.05,duration:.18}); });

  return layer;
}

function buildFloatingBubbles(PIXI:any,gsap:any,layer:any,W:number,H:number,atlasRef:React.RefObject<Record<string,any>>){
  // Usar orbs del atlas si están disponibles, si no canvas
  for(let i=0;i<18;i++){
    const color=(i%6)+1;
    const sz=22+Math.random()*38;
    const frameName=ATLAS_FRAME.NORMAL[color-1];
    const atlasTexture=atlasRef.current?.[frameName];
    const spr = atlasTexture ? new PIXI.Sprite(atlasTexture) : PIXI.Sprite.from(orbCanvas(color,sz));
    spr.width=sz; spr.height=sz; spr.alpha=.15+Math.random()*.2;
    spr.anchor?.set(.5);
    spr.x=Math.random()*W; spr.y=Math.random()*H;
    layer.addChild(spr);
    gsap.to(spr,{y:spr.y-(30+Math.random()*50),x:spr.x+(Math.random()-0.5)*40,
                 duration:4+Math.random()*5,yoyo:true,repeat:-1,ease:"sine.inOut",delay:Math.random()*4});
  }
}

/* ══════════════════════════════════════════════════════════
   HUD
   ══════════════════════════════════════════════════════════ */
function buildHud(PIXI:any,W:number,scoreRef:any,movesRef:any,levelRef:any,comboRef:any,lockBarRef:any,levelBarRef:any){
  const layer=new PIXI.Container();
  const h=76, pad=8, gap=6;
  const panels=[
    {label:"NIVEL",  w:90,  ref:levelRef,  val:"1"},
    {label:"PUNTAJE",w:W-90*2-gap*2-pad*2, ref:scoreRef, val:"0"},
    {label:"MOVIMIENTOS",w:90, ref:movesRef, val:"65"},
  ];
  let xOff=pad;
  panels.forEach(({label,w,ref,val},i)=>{
    const g=new PIXI.Graphics();
    const isCenter=i===1;
    g.beginFill(isCenter?0x7b2fa8:0x1e88e5,.95);
    g.drawRoundedRect(0,0,w,h-pad*2,12); g.endFill();
    g.beginFill(0xffffff,.12); g.drawRoundedRect(3,3,w-6,20,9); g.endFill();
    g.x=xOff; g.y=pad; layer.addChild(g);
    const lbl=new PIXI.Text(label,new PIXI.TextStyle({fontFamily:"system-ui,sans-serif",fontWeight:"700",fontSize:9,fill:0xffffff,alpha:.7,letterSpacing:1}));
    lbl.anchor.set(.5,0); lbl.x=xOff+w/2; lbl.y=pad+8; layer.addChild(lbl);
    const txt=new PIXI.Text(val,new PIXI.TextStyle({fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:isCenter?28:22,fill:isCenter?0xffd700:0xffffff,dropShadow:isCenter,dropShadowDistance:2,dropShadowBlur:6,dropShadowColor:"#000"}));
    txt.anchor.set(.5,.5); txt.x=xOff+w/2; txt.y=pad+(h-pad*2)*0.62;
    ref.current=txt; layer.addChild(txt);
    xOff+=w+gap;
  });

  // Barra de progreso del nivel — dentro del panel NIVEL
  const lvlPanelX=pad, lvlPanelW=90;
  const lpH=5, lpY=pad+(h-pad*2)-lpH-3, lpX=lvlPanelX+4, lpW=lvlPanelW-8;
  const lpBg=new PIXI.Graphics();
  lpBg.beginFill(0x000000,.25); lpBg.drawRoundedRect(lpX,lpY,lpW,lpH,2); lpBg.endFill();
  layer.addChild(lpBg);

  const lpFill=new PIXI.Graphics();
  lpFill.beginFill(0x00eeff,1); lpFill.drawRoundedRect(lpX,lpY,lpW,lpH,2); lpFill.endFill();
  lpFill.scale.x=0;  // empieza en 0, se anima via useEffect
  lpFill.pivot.set(0,0);
  if(levelBarRef) levelBarRef.current=lpFill;
  layer.addChild(lpFill);

  // Combo text (debajo del HUD)
  const combo=new PIXI.Text("",new PIXI.TextStyle({fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:13,fill:0x1a0533}));
  combo.anchor.set(.5,1); combo.x=W/2; combo.y=h+2; combo.alpha=0;
  comboRef.current=combo; layer.addChild(combo);

  // Barra de "procesando" — aparece debajo del HUD mientras isAnimating
  const barW=W-pad*2, barH=4;
  const lockBg=new PIXI.Graphics();
  lockBg.beginFill(0xffffff,.1); lockBg.drawRoundedRect(pad,h-2,barW,barH,2); lockBg.endFill();
  layer.addChild(lockBg);

  const lockBar=new PIXI.Graphics();
  lockBar.beginFill(0xffd700,.85); lockBar.drawRoundedRect(pad,h-2,barW,barH,2); lockBar.endFill();
  lockBar.alpha=0;
  lockBarRef.current=lockBar; layer.addChild(lockBar);

  return layer;
}

/* ══════════════════════════════════════════════════════════
   GAME OVER
   ══════════════════════════════════════════════════════════ */
function buildGameOver(PIXI:any,gsap:any,W:number,H:number,onRestart:()=>void){
  const layer=new PIXI.Container();

  // Overlay oscuro semitransparente
  const ov=new PIXI.Graphics();
  ov.beginFill(0x000000,.6); ov.drawRect(0,0,W,H); ov.endFill();
  layer.addChild(ov);

  // Modal centrado
  const mw=Math.min(W*.85,300), mh=320;
  const mx=(W-mw)/2, my=(H-mh)/2;

  // Sombra del modal
  const shadow=new PIXI.Graphics();
  shadow.beginFill(0x000000,.35); shadow.drawRoundedRect(mx+6,my+8,mw,mh,22); shadow.endFill();
  layer.addChild(shadow);

  // Fondo del modal — gradiente simulado
  const card=new PIXI.Graphics();
  card.beginFill(0x1a0045,1); card.drawRoundedRect(mx,my,mw,mh,22); card.endFill();
  card.beginFill(0x3a1080,.8); card.drawRoundedRect(mx,my,mw,mh*.5,22); card.endFill();
  card.beginFill(0x1a0045,1); card.drawRoundedRect(mx,my+mh*.25,mw,mh*.75,22); card.endFill();
  // Brillo superior
  card.beginFill(0xffffff,.07); card.drawRoundedRect(mx+8,my+6,mw-16,36,16); card.endFill();
  // Borde
  card.lineStyle(2,0x9960ff,.5); card.drawRoundedRect(mx,my,mw,mh,22); card.lineStyle(0);
  layer.addChild(card);

  // Emoji trofeo/fin
  const trophy=new PIXI.Text("🍬",new PIXI.TextStyle({fontSize:52}));
  trophy.anchor.set(.5); trophy.x=W/2; trophy.y=my+52; layer.addChild(trophy);
  // Bounce sutil del trofeo
  gsap.to(trophy,{y:trophy.y-6,duration:1.1,yoyo:true,repeat:-1,ease:"sine.inOut"});

  // Título
  const title=new PIXI.Text("¡JUEGO TERMINADO!",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:17,
    fill:["#ffd700","#ff8c00"],fillGradientType:0,
    stroke:"#1a0030",strokeThickness:3,
    dropShadow:true,dropShadowDistance:2,dropShadowBlur:6,dropShadowColor:"#000",
    letterSpacing:.5,
  }));
  title.anchor.set(.5); title.x=W/2; title.y=my+108; layer.addChild(title);

  // Separador
  const sep=new PIXI.Graphics();
  sep.lineStyle(1,0xffffff,.15); sep.moveTo(mx+20,my+128); sep.lineTo(mx+mw-20,my+128); layer.addChild(sep);

  // Label puntaje
  const lbl=new PIXI.Text("PUNTAJE FINAL",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"700",fontSize:11,
    fill:0xccaaff,letterSpacing:2,
  }));
  lbl.anchor.set(.5); lbl.x=W/2; lbl.y=my+148; layer.addChild(lbl);

  // Score grande
  const scoreVal=new PIXI.Text("0",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:44,
    fill:["#ffffff","#ffe066"],fillGradientType:0,
    dropShadow:true,dropShadowDistance:3,dropShadowBlur:8,dropShadowColor:"#000",
  }));
  scoreVal.name="score_val"; scoreVal.anchor.set(.5); scoreVal.x=W/2; scoreVal.y=my+188; layer.addChild(scoreVal);

  // Botón Volver a jugar
  const btnW=Math.min(mw*.78,210), btnH=52;
  const btnCtr=new PIXI.Container();
  btnCtr.x=W/2-btnW/2; btnCtr.y=my+mh-72;

  const btnShadow=new PIXI.Graphics();
  btnShadow.beginFill(0x000000,.3); btnShadow.drawRoundedRect(3,5,btnW,btnH,btnH/2); btnShadow.endFill();
  btnCtr.addChild(btnShadow);

  const btnBg=new PIXI.Graphics();
  btnBg.beginFill(0xff5500,1); btnBg.drawRoundedRect(0,0,btnW,btnH,btnH/2); btnBg.endFill();
  btnBg.beginFill(0xff9000,.65); btnBg.drawRoundedRect(0,0,btnW,btnH*.45,btnH/2); btnBg.endFill();
  btnBg.beginFill(0xff5500,1); btnBg.drawRoundedRect(0,btnH*.22,btnW,btnH*.78,btnH/2); btnBg.endFill();
  btnBg.beginFill(0xffffff,.18); btnBg.drawRoundedRect(8,5,btnW-16,18,8); btnBg.endFill();
  btnCtr.addChild(btnBg);

  const btnTxt=new PIXI.Text("🔄  Volver a jugar",new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:18,
    fill:["#ffffff","#fff3b0"],fillGradientType:0,
    stroke:"#882200",strokeThickness:2,
    dropShadow:true,dropShadowDistance:2,dropShadowBlur:4,dropShadowColor:"#000",
  }));
  btnTxt.anchor.set(.5); btnTxt.x=btnW/2; btnTxt.y=btnH/2; btnCtr.addChild(btnTxt);

  btnCtr.interactive=true; btnCtr.buttonMode=true; btnCtr.cursor="pointer";
  layer.addChild(btnCtr);

  // Pulso del botón
  gsap.to(btnCtr.scale,{x:1.04,y:1.04,duration:.8,yoyo:true,repeat:-1,ease:"sine.inOut",delay:.5});

  btnCtr.on("pointerdown",()=>{
    gsap.killTweensOf(btnCtr.scale);
    gsap.to(btnCtr.scale,{x:.93,y:.93,duration:.08,yoyo:true,repeat:1,
      onComplete:()=>{ gsap.to(btnCtr.scale,{x:1.04,y:1.04,duration:.8,yoyo:true,repeat:-1,ease:"sine.inOut"}); }
    });
    onRestart();
  });
  btnCtr.on("pointerover",()=>{ gsap.killTweensOf(btnCtr.scale); gsap.to(btnCtr.scale,{x:1.08,y:1.08,duration:.12}); });
  btnCtr.on("pointerout", ()=>{ gsap.killTweensOf(btnCtr.scale); gsap.to(btnCtr.scale,{x:1.04,y:1.04,duration:.18}); });

  return layer;
}

/* ══════════════════════════════════════════════════════════
   TILES
   ══════════════════════════════════════════════════════════ */
function buildTiles(PIXI:any,stage:any,cols:number,rows:number,W:number,H:number){
  stage.children.filter((c:any)=>c._isTile).forEach((c:any)=>stage.removeChild(c));
  const g=new PIXI.Graphics(); (g as any)._isTile=true;
  const cellSz=cs(cols,rows,W,H);
  for(let c=0;c<cols;c++) for(let r=0;r<rows;r++){
    const {x,y}=xy(c,r,cellSz,cols,rows,W,H);
    const ts=cellSz*.95, rad=ts*.18;
    g.beginFill(0x000000,.2); g.drawRoundedRect(x-ts/2+2,y-ts/2+3,ts,ts,rad); g.endFill();
    g.beginFill(0x2244cc,.7); g.drawRoundedRect(x-ts/2,y-ts/2,ts,ts,rad); g.endFill();
    g.lineStyle(1,0xffffff,.1); g.drawRoundedRect(x-ts/2+1,y-ts/2+1,ts-2,ts-2,rad*.9); g.lineStyle(0);
  }
  stage.addChildAt(g,0);
}

/* ══════════════════════════════════════════════════════════
   SYNC BOARD
   ══════════════════════════════════════════════════════════ */
interface SyncArgs {
  PIXI:any; gsap:any; stage:any; fx:any;
  orbMapRef:React.RefObject<Map<number,OrbNode>>;
  selRef:React.RefObject<any>; pendRef:React.RefObject<boolean>;
  live:React.RefObject<any>;
  atlasRef:React.RefObject<Record<string,any>>;
  board:SimpleBoard; cols:number; rows:number; W:number; H:number;
  newOrbIds:Set<number>; isInitial:boolean;
}
declare namespace React { interface RefObject<T> { current: T | null; } }

function syncBoard({PIXI,gsap,stage,fx,orbMapRef,live,atlasRef,board,cols,rows,W,H,newOrbIds,isInitial}:SyncArgs){
  const cellSz=cs(cols,rows,W,H);
  const map=orbMapRef.current!;

  const fresh=new Map<number,{orb:SimpleOrb;col:number;row:number}>();
  for(let c=0;c<cols;c++) for(let r=0;r<rows;r++){
    const o=board[c]?.[r]; if(o) fresh.set(o.id,{orb:o,col:c,row:r});
  }

  // NO matar todos los tweens en masa — solo para orbs eliminados o que se mueven.
  // Matar todos causaba que las animaciones de caída de cascadas previas se interrumpieran.

  // 1 — Eliminar orbs que ya no están en el board
  const elimPts:{x:number;y:number}[]=[];
  map.forEach((node,id)=>{
    if(fresh.has(id)) return;
    map.delete(id);
    if(!node.ctr||node.ctr.destroyed) return;
    const {x,y}=xy(node.col,node.row,cellSz,cols,rows,W,H);
    const color=C_HEX[node.orb.color]??0xffffff;
    gsap.killTweensOf(node.ctr); gsap.killTweensOf(node.ctr.scale);
    exitAnim(gsap,stage,node.ctr);
    // FX de activación según el tipo de especial consumido
    switch(node.orb.type){
      case "STRIPPED_HOR": specialBeam(PIXI,gsap,fx,x,y,color,true,W,H,cellSz); break;
      case "STRIPPED_VER": specialBeam(PIXI,gsap,fx,x,y,color,false,W,H,cellSz); break;
      case "PULSATING":    specialBeam(PIXI,gsap,fx,x,y,color,true,W,H,cellSz);
                           specialBeam(PIXI,gsap,fx,x,y,color,false,W,H,cellSz); break;
      case "BOMB":         shockwave(PIXI,gsap,fx,x,y,color,cellSz,true);  break;
      case "WRAPPED":      shockwave(PIXI,gsap,fx,x,y,color,cellSz,false); break;
    }
    spawnParticles(PIXI,gsap,fx,x,y,color,cellSz);
    elimPts.push({x,y});
  });

  // Puntaje flotante en el centro de lo eliminado en esta cascada
  const gain=live.current?.lastScoreGain??0;
  if(elimPts.length && gain>0){
    const cx=elimPts.reduce((s,p)=>s+p.x,0)/elimPts.length;
    const cy=elimPts.reduce((s,p)=>s+p.y,0)/elimPts.length;
    floatingScore(PIXI,gsap,fx,cx,cy,gain,live.current?.comboMultiplier??1,cellSz);
  }

  // 2 — Agregar / mover orbs
  fresh.forEach(({orb,col,row},id)=>{
    const {x,y}=xy(col,row,cellSz,cols,rows,W,H);

    if(map.has(id)){
      const node=map.get(id)!;
      if(!node.ctr || node.ctr.destroyed){ map.delete(id); return; }
      const moved=node.col!==col||node.row!==row;
      node.col=col; node.row=row; node.orb=orb;

      if(moved){
        gsap.killTweensOf(node.ctr);
        node.inFall=true;
        // Caída rápida — cabe en FALL_MS_BASE=450ms
        const mult=live.current.comboMultiplier??1;
        const fallDur=Math.max(.14, .26-mult*.03);
        const fallDelay=Math.max(.06, .14-mult*.015);
        gsap.killTweensOf(node.ctr.scale);
        ctrTo(gsap,node.ctr,{x,y,duration:fallDur,ease:"power3.out",delay:fallDelay,
          onComplete:()=>{ node.inFall=false; landBounce(gsap,node.ctr); }
        });
        node.ctr.removeAllListeners("pointerdown");
        node.ctr.on("pointerdown",(e:any)=>{
          e.stopPropagation();
          _dragOrb = { col, row, startX: e.data.global.x, startY: e.data.global.y };
        });
      } else {
        const displaced=Math.abs(node.ctr.y-y)>2||Math.abs(node.ctr.x-x)>2;
        if(node.hinted){
          gsap.killTweensOf(node.ctr);
          node.hinted=false; node.baseY=undefined; node.inFall=false;
          ctrTo(gsap,node.ctr,{x,y,duration:.2,ease:"power2.out"});
        } else if(displaced && !node.inFall){
          gsap.killTweensOf(node.ctr);
          ctrTo(gsap,node.ctr,{x,y,duration:.2,ease:"power2.out"});
        }
      }

    } else {
      // Orb nuevo — crear contenedor
      const ctr=makeOrb(PIXI,orb,cellSz,atlasRef);
      // Posición provisional — se ajusta según isInitial/cascade abajo
      const topY=xy(col,0,cellSz,cols,rows,W,H).y - cellSz*.6;
      ctr.x=x; ctr.y=topY; ctr.alpha=0;  // cascada: cae desde arriba
      stage.addChild(ctr);
      ctr.interactive=true; ctr.buttonMode=true; ctr.cursor="pointer";
      ctr.on("pointerdown",(e:any)=>{
        e.stopPropagation();
        _dragOrb = { col, row, startX: e.data.global.x, startY: e.data.global.y };
      });

      const nodeRef={ctr,orb,col,row,inFall:false};
      map.set(id,nodeRef);

      if(isInitial){
        // Tablero inicial: posición y visibilidad DIRECTA — sin GSAP, sin alpha=0
        ctr.x=x; ctr.y=y; ctr.alpha=1; ctr.scale.set(1);
        nodeRef.inFall=false;
      } else if(newOrbIds.has(id)){
        // Cascada: cae desde arriba — aquí SÍ podemos usar alpha=0 ya que GSAP está corriendo
        const delay=.12+row*.018;
        nodeRef.inFall=true;
        ctrTo(gsap,ctr,{y,alpha:1,duration:.26,ease:"power3.out",delay,
          onComplete:()=>{ nodeRef.inFall=false; landBounce(gsap,ctr); }});
      } else if(orb.type!=="NORMAL"){
        // Especial recién creado (mismo lugar, id nuevo): pulso de nacimiento
        ctr.x=x; ctr.y=y; ctr.alpha=0; ctr.scale.set(.2);
        spawnSpecialBirth(PIXI,gsap,fx,x,y,C_HEX[orb.color]??0xffffff,cellSz);
        gsap.to(ctr,{alpha:1,duration:.18});
        gsap.to(ctr.scale,{x:1,y:1,duration:.44,ease:"back.out(2.2)"});
      } else {
        ctr.x=x; ctr.y=y; ctr.alpha=1; ctr.scale.set(1);
      }
    }
  });
}

function exitAnim(gsap:any,stage:any,ctr:any){
  if(!ctr||ctr.destroyed) return;
  gsap.killTweensOf(ctr); gsap.killTweensOf(ctr.scale);
  // Sin timeline (más ligero) — dos tweens directos
  gsap.to(ctr.scale,{x:0,y:0,duration:.25,ease:"power2.in"});
  gsap.to(ctr,{alpha:0,duration:.22,ease:"power2.in",
    onComplete:()=>{
      gsap.killTweensOf(ctr); gsap.killTweensOf(ctr.scale);
      if(ctr&&!ctr.destroyed&&ctr.parent) ctr.parent.removeChild(ctr);
      if(ctr&&!ctr.destroyed) ctr.destroy({children:true});
    }
  });
}

function spawnParticles(PIXI:any,gsap:any,fx:any,cx:number,cy:number,color:number,cellSz:number){
  // Destello blanco que crece y se apaga — da el "pop" del impacto
  const flash=new PIXI.Graphics();
  flash.beginFill(0xffffff,.85); flash.drawCircle(0,0,cellSz*.34); flash.endFill();
  flash.x=cx; flash.y=cy; flash.scale.set(.4); fx.addChild(flash);
  gsap.to(flash.scale,{x:1.5,y:1.5,duration:.25,ease:"power2.out"});
  gsap.to(flash,{alpha:0,duration:.25,ease:"power2.out",
    onComplete:()=>{ gsap.killTweensOf(flash); gsap.killTweensOf(flash.scale); if(flash.parent) fx.removeChild(flash); if(!flash.destroyed) flash.destroy(); }});

  // Partículas de color que salen disparadas
  const N=7;
  for(let i=0;i<N;i++){
    const p=new PIXI.Graphics(); p.beginFill(color,.95); p.drawCircle(0,0,cellSz*(.05+Math.random()*.05)); p.endFill();
    p.x=cx; p.y=cy; fx.addChild(p);
    const angle=(i/N)*Math.PI*2+Math.random()*.6, dist=cellSz*(.5+Math.random()*.7);
    gsap.to(p,{
      x:cx+Math.cos(angle)*dist, y:cy+Math.sin(angle)*dist,
      alpha:0,
      duration:.4+Math.random()*.2, ease:"power2.out",
      onComplete:()=>{
        gsap.killTweensOf(p);
        if(p.parent) fx.removeChild(p);
        if(!p.destroyed) p.destroy();
      }
    });
  }
}

/* ── Puntaje flotante que sale del centro del match ── */
function floatingScore(PIXI:any,gsap:any,fx:any,x:number,y:number,amount:number,mult:number,cellSz:number){
  const big=mult>=3;
  const txt=new PIXI.Text(`+${amount}`,new PIXI.TextStyle({
    fontFamily:"system-ui,sans-serif",fontWeight:"900",
    fontSize: big?40:28,
    fill: big?["#ffd700","#ff4500"]:["#ffffff","#ffe066"],
    fillGradientType:0,
    stroke:"#1a0030",strokeThickness:4,
    dropShadow:true,dropShadowDistance:2,dropShadowBlur:6,dropShadowColor:"#000",
  }));
  txt.anchor.set(.5); txt.x=x; txt.y=y; txt.scale.set(.4); txt.alpha=0;
  fx.addChild(txt);
  gsap.timeline()
    .to(txt.scale,{x:1,y:1,duration:.2,ease:"back.out(2.6)"})
    .to(txt,{alpha:1,duration:.12},"<")
    .to(txt,{y:y-cellSz*1.2,duration:.6,ease:"power1.out"},">-0.05")
    .to(txt,{alpha:0,duration:.32},"<+0.25")
    .call(()=>{ gsap.killTweensOf(txt); gsap.killTweensOf(txt.scale); if(txt.parent) fx.removeChild(txt); if(!txt.destroyed) txt.destroy(); });
}

/* ── Haz de luz al activar un STRIPPED / PULSATING ── */
function specialBeam(PIXI:any,gsap:any,fx:any,x:number,y:number,color:number,horizontal:boolean,W:number,H:number,cellSz:number){
  const g=new PIXI.Graphics();
  const thick=cellSz*.55;
  g.beginFill(color,.85);
  if(horizontal) g.drawRect(0,y-thick/2,W,thick); else g.drawRect(x-thick/2,0,thick,H);
  g.endFill();
  g.beginFill(0xffffff,.9); // núcleo blanco
  if(horizontal) g.drawRect(0,y-thick*.16,W,thick*.32); else g.drawRect(x-thick*.16,0,thick*.32,H);
  g.endFill();
  g.alpha=0; fx.addChild(g);
  gsap.timeline()
    .to(g,{alpha:1,duration:.06,ease:"power2.out"})
    .to(g,{alpha:0,duration:.3,ease:"power2.in"})
    .call(()=>{ gsap.killTweensOf(g); if(g.parent) fx.removeChild(g); if(!g.destroyed) g.destroy(); });
}

/* ── Onda expansiva al activar BOMB / WRAPPED ── */
function shockwave(PIXI:any,gsap:any,fx:any,x:number,y:number,color:number,cellSz:number,big:boolean){
  const ring=new PIXI.Graphics();
  ring.lineStyle(cellSz*(big?.22:.16),color,.9); ring.drawCircle(0,0,cellSz*.5);
  ring.lineStyle(cellSz*.08,0xffffff,.7); ring.drawCircle(0,0,cellSz*.5);
  ring.x=x; ring.y=y; ring.alpha=.95; fx.addChild(ring);
  const sc=big?5:2.8;
  gsap.to(ring.scale,{x:sc,y:sc,duration:.5,ease:"power2.out"});
  gsap.to(ring,{alpha:0,duration:.5,ease:"power2.out",
    onComplete:()=>{ gsap.killTweensOf(ring); gsap.killTweensOf(ring.scale); if(ring.parent) fx.removeChild(ring); if(!ring.destroyed) ring.destroy(); }});
}

/* ── Nacimiento de un especial (pulso brillante al crearse) ── */
function spawnSpecialBirth(PIXI:any,gsap:any,fx:any,x:number,y:number,color:number,cellSz:number){
  const ring=new PIXI.Graphics();
  ring.lineStyle(cellSz*.12,0xffffff,.95); ring.drawCircle(0,0,cellSz*.55);
  ring.lineStyle(cellSz*.05,color,.9);     ring.drawCircle(0,0,cellSz*.42);
  ring.x=x; ring.y=y; ring.scale.set(1.4); ring.alpha=0; fx.addChild(ring);
  gsap.timeline()
    .to(ring,{alpha:.9,duration:.1})
    .to(ring.scale,{x:.3,y:.3,duration:.32,ease:"power2.in"},"<")
    .to(ring,{alpha:0,duration:.2},">-0.12")
    .call(()=>{ gsap.killTweensOf(ring); gsap.killTweensOf(ring.scale); if(ring.parent) fx.removeChild(ring); if(!ring.destroyed) ring.destroy(); });
}

/* ── Rebote al aterrizar (squash & stretch) ──
   Tweens planos (no timeline) para que killTweensOf(ctr.scale) los mate de
   forma fiable cuando el orb se destruye — evita el error GSAP null position. */
function landBounce(gsap:any,ctr:any){
  if(!ctr||ctr.destroyed) return;
  gsap.killTweensOf(ctr.scale);
  gsap.to(ctr.scale,{x:1.16,y:.84,duration:.08,ease:"power2.out",
    onComplete(){
      if(!ctr||ctr.destroyed) return;
      gsap.to(ctr.scale,{x:1,y:1,duration:.2,ease:"back.out(3)"});
    }});
}

const TYPE_ICON:Record<string,string>={STRIPPED_VER:"▲",STRIPPED_HOR:"▶",WRAPPED:"✦",BOMB:"◉"};

function makeOrb(PIXI:any,orb:SimpleOrb,cellSz:number,atlasRef:React.RefObject<Record<string,any>>):any{
  const ctr=new PIXI.Container(), sz=cellSz*.91;

  const frameName=ATLAS_FRAME[orb.type]?.[orb.color-1]??ATLAS_FRAME.NORMAL[orb.color-1];
  const atlasTexture=atlasRef.current?.[frameName];
  let sprite:any;

  if(atlasTexture){
    sprite=new PIXI.Sprite(atlasTexture);
    sprite.anchor.set(.5);
    // Escalar al tamaño de celda usando scale para preservar calidad
    // (en lugar de forzar width/height que puede distorsionar)
    const nativeW=atlasTexture.width||atlasTexture.frame?.width||sz;
    const nativeH=atlasTexture.height||atlasTexture.frame?.height||sz;
    const scaleX=sz/nativeW, scaleY=sz/nativeH;
    sprite.scale.set(Math.min(scaleX,scaleY));
    // Filtro NEAREST para sprites de atlas (definición más nítida)
    sprite.texture.baseTexture.scaleMode=1; // PIXI.SCALE_MODES.NEAREST
  } else {
    sprite=PIXI.Sprite.from(orbCanvas(orb.color||1,sz));
    sprite.width=sz; sprite.height=sz; sprite.anchor.set(.5);
  }
  ctr.addChild(sprite);

  // Ícono para specials (cuando NO usamos frame específico del atlas)
  if(!atlasTexture){
    const icon=TYPE_ICON[orb.type];
    if(icon){
      const txt=new PIXI.Text(icon,new PIXI.TextStyle({fontFamily:"system-ui,sans-serif",fontWeight:"900",fontSize:sz*.38,fill:0xffffff,dropShadow:true,dropShadowAlpha:.6,dropShadowBlur:4,dropShadowDistance:1}));
      txt.anchor.set(.5); ctr.addChild(txt);
      const ring=new PIXI.Graphics(); ring.lineStyle(2,0xffffff,.5); ring.drawCircle(0,0,sz*.48); ctr.addChild(ring);
    }
  }
  return ctr;
}

const SEL_KEY="__sel_id__";

function handleClick(col:number,row:number,PIXI:any,gsap:any,stage:any,
                     orbMapRef:React.RefObject<Map<number,OrbNode>>,
                     selRef:React.RefObject<any>,pendRef:React.RefObject<boolean>,
                     live:React.RefObject<any>,
                     cellSz:number,cols:number,rows:number,W:number,H:number){
  const {isAnimating,board,swap:doSwap}=live.current;
  if(isAnimating||pendRef.current) return;
  const map=orbMapRef.current!, sel=selRef.current;
  const clearSelFn=()=>{ map.forEach(n=>{ if(n.ctr[SEL_KEY]){ n.ctr[SEL_KEY]=false; gsap?.killTweensOf(n.ctr); gsap?.to(n.ctr,{alpha:1,duration:.15}); } }); };
  const showSelFn=(c:number,r:number)=>{ clearSelFn(); const orb=board[c]?.[r]; if(!orb) return; const node=map.get(orb.id); if(!node) return; node.ctr[SEL_KEY]=true; gsap.killTweensOf(node.ctr); gsap.to(node.ctr,{alpha:.45,duration:.12}); };
  if(!sel){ selRef.current={col,row}; showSelFn(col,row); return; }
  if(sel.col===col&&sel.row===row){ clearSelFn(); selRef.current=null; return; }
  const dc=Math.abs(sel.col-col),dr=Math.abs(sel.row-row);
  if((dc===1&&dr===0)||(dc===0&&dr===1)){
    const o1=board[sel.col]?.[sel.row], o2=board[col]?.[row];
    clearSelFn(); selRef.current=null; if(!o1||!o2) return;
    const n1=map.get(o1.id), n2=map.get(o2.id); if(!n1||!n2) return;
    const p1=xy(col,row,cellSz,cols,rows,W,H), p2=xy(sel.col,sel.row,cellSz,cols,rows,W,H);
    pendRef.current=true;
    const t=setTimeout(()=>{pendRef.current=false;},500);
    gsap.to(n1.ctr,{x:p1.x,y:p1.y,duration:.22,ease:"power2.inOut"});
    gsap.to(n2.ctr,{x:p2.x,y:p2.y,duration:.22,ease:"power2.inOut",onComplete:()=>{ clearTimeout(t); pendRef.current=false; doSwap(sel.col,sel.row,col,row); }});
  } else { clearSelFn(); selRef.current={col,row}; showSelFn(col,row); }
  void PIXI; void stage;
}

function applyHint(gsap:any,pair:any,board:SimpleBoard,orbMapRef:React.RefObject<Map<number,OrbNode>>):boolean{
  const map=orbMapRef.current!;
  // Limpiar hint anterior: restaurar y EXACTA antes del salto, no solo alpha
  map.forEach(n=>{
    if(n.hinted){
      gsap.killTweensOf(n.ctr);
      const restoreY = n.baseY ?? n.ctr.y;
      gsap.to(n.ctr,{y:restoreY, alpha:1, duration:.18, ease:"power2.out"});
      n.hinted=false; n.baseY=undefined;
    }
  });
  if(!pair||!gsap) return true;
  const o1=board[pair.c1]?.[pair.r1], o2=board[pair.c2]?.[pair.r2];
  if(!o1||!o2) return false;
  const n1=map.get(o1.id), n2=map.get(o2.id);
  if(!n1||!n2) return false;
  const jump=(n:OrbNode,delay:number)=>{
    n.hinted=true;
    n.baseY=n.ctr.y;  // guardar posición original antes de saltar
    gsap.to(n.ctr,{y:n.ctr.y-8,duration:.4,yoyo:true,repeat:-1,ease:"sine.inOut",delay});
  };
  jump(n1,0); jump(n2,.19);
  return true;
}
