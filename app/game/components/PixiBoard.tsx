"use client";

import { useEffect, useRef } from "react";
import { Board, Orb } from "../hooks/useEngine";

/* ── Paleta vibrante (candy crush style) ── */
const C_BG:  Record<number,string> = {1:"#f5350a",2:"#1e90ff",3:"#22c55e",4:"#f59e0b",5:"#a855f7",6:"#06b6d4"};
const C_DK:  Record<number,string> = {1:"#8b1a00",2:"#0a3fa8",3:"#14532d",4:"#78350f",5:"#5b21b6",6:"#0e5f70"};
const C_LT:  Record<number,string> = {1:"#ff9580",2:"#7dd3fc",3:"#86efac",4:"#fde68a",5:"#d8b4fe",6:"#67e8f9"};
const C_HEX: Record<number,number> = {1:0xf5350a,2:0x1e90ff,3:0x22c55e,4:0xf59e0b,5:0xa855f7,6:0x06b6d4};
const C_ICO: Record<string,string>  = {STRIPPED_VER:"▲",STRIPPED_HOR:"▶",WRAPPED:"✦",BOMB:"◉",PULSATING:"★",BIG_STRIPED:"⚡"};

const PAD=12, GAP=5;

/* ── Esperar a que window.PIXI y window.gsap estén disponibles
   Los scripts se cargan de forma síncrona desde el <head> en layout.tsx ── */
function waitForLibs(): Promise<{ PIXI: any; gsap: any }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const PIXI = (window as any).PIXI;
      const gsap = (window as any).gsap;
      if (PIXI?.Application && gsap?.to) { resolve({ PIXI, gsap }); return; }
      if (Date.now() - start > 8000) { reject(new Error("Timeout: PIXI/gsap no disponibles")); return; }
      setTimeout(check, 50);
    };
    check();
  });
}

/* ── Geometría ── */
function getCS(cols:number,rows:number,W:number,H:number){
  return Math.min((W-PAD*2-(cols-1)*GAP)/cols,(H-PAD*2-(rows-1)*GAP)/rows);
}
function getXY(col:number,row:number,cs:number,cols:number,rows:number,W:number,H:number){
  const tw=cols*cs+(cols-1)*GAP, th=rows*cs+(rows-1)*GAP;
  return { x:(W-tw)/2+col*(cs+GAP)+cs/2, y:(H-th)/2+row*(cs+GAP)+cs/2 };
}

/* ── Canvas texture cacheada (esfera 3D con gradiente) ── */
const TEX = new Map<string,HTMLCanvasElement>();
function orbCanvas(color:number,sz:number){
  const k=`${color}:${Math.round(sz)}`; if(TEX.has(k)) return TEX.get(k)!;
  const c=document.createElement("canvas"); c.width=c.height=Math.ceil(sz);
  const ctx=c.getContext("2d")!, r=sz/2;
  const g=ctx.createRadialGradient(sz*.37,sz*.28,0,sz*.5,sz*.5,sz*.54);
  g.addColorStop(0,C_LT[color]??"#fff"); g.addColorStop(.42,C_BG[color]??"#888"); g.addColorStop(1,C_DK[color]??"#222");
  ctx.beginPath(); ctx.arc(r,r,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  // sombra inferior
  const sh=ctx.createLinearGradient(0,sz*.58,0,sz);
  sh.addColorStop(0,"rgba(0,0,0,0)"); sh.addColorStop(1,"rgba(0,0,0,.32)");
  ctx.fillStyle=sh; ctx.beginPath(); ctx.arc(r,r,r,0,Math.PI*2); ctx.fill();
  // brillo especular
  const sp=ctx.createRadialGradient(sz*.36,sz*.26,0,sz*.36,sz*.3,sz*.2);
  sp.addColorStop(0,"rgba(255,255,255,.62)"); sp.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=sp; ctx.beginPath(); ctx.arc(sz*.36,sz*.29,sz*.19,0,Math.PI*2); ctx.fill();
  TEX.set(k,c); return c;
}

/* ── Tiles de fondo estilo candy crush ── */
function drawTiles(PIXI:any, stage:any, cols:number, rows:number, W:number, H:number) {
  const cs=getCS(cols,rows,W,H);
  const g=new PIXI.Graphics();
  for(let c=0;c<cols;c++){
    for(let r=0;r<rows;r++){
      const {x,y}=getXY(c,r,cs,cols,rows,W,H);
      const ts=cs*.95, rad=ts*.18;
      // Sombra offset (abajo y derecha)
      g.beginFill(0x000000,.2);
      g.drawRoundedRect(x-ts/2+2,y-ts/2+3,ts,ts,rad);
      g.endFill();
      // Cuerpo del tile
      g.beginFill(0x2244cc,.7);
      g.drawRoundedRect(x-ts/2,y-ts/2,ts,ts,rad);
      g.endFill();
      // Borde interior sutil (uniform, no solo arriba)
      g.lineStyle(1,0xffffff,.12);
      g.drawRoundedRect(x-ts/2+1,y-ts/2+1,ts-2,ts-2,rad*.9);
      g.lineStyle(0);
    }
  }
  stage.addChild(g);
}

/* ── Tipos internos ── */
interface OrbNode { ctr:any; orb:Orb; col:number; row:number; hinted?:boolean; }
interface Props {
  board:Board; cols:number; rows:number;
  isAnimating:boolean; shakeTrigger:number;
  newOrbIds:Set<number>;
  hintPair:{ c1:number;r1:number;c2:number;r2:number }|null;
  onSwap:(c1:number,r1:number,c2:number,r2:number)=>void;
}

/* ══════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════════ */
export default function PixiBoard({board,cols,rows,isAnimating,shakeTrigger,newOrbIds,hintPair,onSwap}:Props){
  const wrapRef   = useRef<HTMLDivElement>(null);
  const appRef    = useRef<any>(null);
  const stageRef  = useRef<any>(null);
  const fxRef     = useRef<any>(null);   // capa de partículas / FX (encima del board)
  const orbMapRef = useRef(new Map<number,OrbNode>());
  const selRef    = useRef<{col:number;row:number}|null>(null);
  const pendRef   = useRef(false);
  const live      = useRef({board,cols,rows,isAnimating,newOrbIds,onSwap});
  live.current    = {board,cols,rows,isAnimating,newOrbIds,onSwap};

  /* ── Inicializar PixiJS via CDN ── */
  useEffect(()=>{
    const wrap=wrapRef.current; if(!wrap) return;
    let dead=false;

    (async()=>{
      let PIXI: any, gsap: any;
      try {
        ({ PIXI, gsap } = await waitForLibs());
      } catch(e){ console.error("[PixiBoard]", e); return; }
      if(dead||!wrap) return;

      const W=wrap.clientWidth||480, H=Math.round(W*rows/cols);
      const app=new PIXI.Application({width:W,height:H,backgroundAlpha:0,
                                       antialias:true,resolution:devicePixelRatio||1,autoDensity:true});
      if(dead){ app.destroy(true); return; }
      wrap.appendChild(app.view);
      appRef.current=app;

      // Capa board (sacudir en mismatch)
      const stage=new PIXI.Container(); app.stage.addChild(stage); stageRef.current=stage;
      const fx=new PIXI.Container(); app.stage.addChild(fx); fxRef.current=fx;

      // Dibujar tiles de fondo (se crean una sola vez)
      drawTiles(PIXI, stage, cols, rows, W, H);

      syncBoard({PIXI,gsap,stage,fx,orbMapRef,selRef,pendRef,live,
                 board:live.current.board,cols,rows,W,H,
                 newOrbIds:live.current.newOrbIds,isInitial:true});
    })();

    return ()=>{
      dead=true;
      const gsap=(window as any).gsap;
      gsap?.killTweensOf(stageRef.current);
      if(appRef.current){ appRef.current.destroy(true,{children:true}); appRef.current=null; }
      orbMapRef.current.clear(); TEX.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  /* ── Sync board al cambiar ── */
  useEffect(()=>{
    const PIXI=(window as any).PIXI, gsap=(window as any).gsap;
    const stage=stageRef.current, fx=fxRef.current, wrap=wrapRef.current;
    if(!PIXI||!gsap||!stage||!wrap) return;
    const W=wrap.clientWidth||480, H=Math.round(W*rows/cols);
    appRef.current?.renderer.resize(W,H);
    syncBoard({PIXI,gsap,stage,fx,orbMapRef,selRef,pendRef,live,board,cols,rows,W,H,newOrbIds,isInitial:false});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[board,cols,rows,newOrbIds]);

  /* ── Shake en mismatch ── */
  const prevShake=useRef(0);
  useEffect(()=>{
    if(!shakeTrigger||shakeTrigger===prevShake.current) return;
    prevShake.current=shakeTrigger;
    const gsap=(window as any).gsap, s=stageRef.current;
    if(!gsap||!s) return;
    gsap.killTweensOf(s);
    gsap.to(s,{x:-14,duration:.05,yoyo:true,repeat:9,ease:"none",onComplete:()=>{s.x=0;}});
  },[shakeTrigger]);

  /* ── Hint: los dos orbs saltan para indicar el próximo movimiento ──
     Usa reintentos porque hintPair puede llegar antes de que PixiJS inicialice
     y los orbs estén en orbMapRef. ── */
  const hintRetryRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    const gsap=(window as any).gsap;
    if(!gsap) return;
    const map=orbMapRef.current;

    // Limpiar reintento anterior
    if(hintRetryRef.current){ clearTimeout(hintRetryRef.current); hintRetryRef.current=null; }

    // Detener saltos previos y restaurar posición
    map.forEach(node=>{
      if(node.hinted){
        gsap.killTweensOf(node.ctr);
        gsap.to(node.ctr,{y: node.ctr.y, alpha:1, duration:.1});
        node.hinted=false;
      }
    });

    if(!hintPair) return;

    const jumpH = () => getCS(
      live.current.cols, live.current.rows,
      wrapRef.current?.clientWidth||480,
      wrapRef.current?.clientHeight||480
    ) * 0.22;

    const applyJump=(col:number, row:number, phaseDelay:number)=>{
      const orb=live.current.board[col]?.[row]; if(!orb) return false;
      const node=map.get(orb.id); if(!node) return false;
      node.hinted=true;
      gsap.killTweensOf(node.ctr);
      gsap.to(node.ctr,{
        y: node.ctr.y - jumpH(),
        duration: .38,
        yoyo: true,
        repeat: -1,
        ease: "power2.out",
        delay: phaseDelay,
      });
      return true;
    };

    const tryApply = () => {
      const ok1 = applyJump(hintPair.c1, hintPair.r1, 0);
      const ok2 = applyJump(hintPair.c2, hintPair.r2, .19);
      if(!ok1 || !ok2){
        // Orbs aún no están en el mapa (PixiJS inicializando) → reintentar
        hintRetryRef.current = setTimeout(tryApply, 400);
      }
    };

    tryApply();
    return ()=>{ if(hintRetryRef.current) clearTimeout(hintRetryRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hintPair]);

  return(
    <div ref={wrapRef} className="pixi-board-wrap"
         style={{width:"min(92vw, 480px)",aspectRatio:`${cols}/${rows}`}} />
  );
}

/* ══════════════════════════════════════════════════════════════════
   SYNC — diff + animaciones
   ══════════════════════════════════════════════════════════════════ */
interface SyncArgs {
  PIXI:any; gsap:any; stage:any; fx:any;
  orbMapRef:React.RefObject<Map<number,OrbNode>>;
  selRef:React.RefObject<any>; pendRef:React.RefObject<boolean>;
  live:React.RefObject<any>;
  board:Board; cols:number; rows:number; W:number; H:number;
  newOrbIds:Set<number>; isInitial:boolean;
}

function syncBoard({PIXI,gsap,stage,fx,orbMapRef,selRef,pendRef,live,board,cols,rows,W,H,newOrbIds,isInitial}:SyncArgs){
  const cs=getCS(cols,rows,W,H);
  const map=orbMapRef.current!;

  // Mapa del board nuevo
  const fresh=new Map<number,{orb:Orb;col:number;row:number}>();
  for(let c=0;c<cols;c++) for(let r=0;r<rows;r++){
    const o=board[c]?.[r]; if(o) fresh.set(o.id,{orb:o,col:c,row:r});
  }

  /* 0 — Matar TODOS los tweens activos antes de procesar
     Evita conflictos entre animaciones de ciclos anteriores ── */
  if(!isInitial){
    map.forEach(node=>{
      gsap.killTweensOf(node.ctr);
      gsap.killTweensOf(node.ctr.scale);
    });
  }

  /* 1 — Eliminar orbs con animación de salida + partículas */
  map.forEach((node,id)=>{
    if(fresh.has(id)) return;
    map.delete(id);
    const {x,y}=getXY(node.col,node.row,cs,cols,rows,W,H);
    exitAnim(gsap,stage,node.ctr);
    spawnParticles(PIXI,gsap,fx,x,y,C_HEX[node.orb.color]??0xffffff,cs);
  });

  /* 2 — Agregar / mover orbs */
  fresh.forEach(({orb,col,row},id)=>{
    const {x,y}=getXY(col,row,cs,cols,rows,W,H);

    if(map.has(id)){
      const node=map.get(id)!;
      const moved=node.col!==col||node.row!==row;
      node.col=col; node.row=row; node.orb=orb;

      if(moved){
        // Caída gravitacional con rebote
        gsap.to(node.ctr,{x,y,duration:.65,ease:"bounce.out",delay:.38});
      } else {
        // Snap-back (mismatch): regresa a la posición original con un pequeño rebote
        // para que el usuario vea claramente que el movimiento no fue válido
        gsap.killTweensOf(node.ctr);
        gsap.to(node.ctr,{x,y,duration:.35,ease:"back.out(2.5)"});
      }
    } else {
      // Orb nuevo — crear y animar entrada
      const ctr=makeOrb(PIXI,orb,cs);
      ctr.x=x;
      ctr.y=y;   // ← SIEMPRE setear y antes de cualquier animación
      stage.addChild(ctr);
      map.set(id,{ctr,orb,col,row});

      // Bind input
      ctr.interactive=true; ctr.buttonMode=true;
      ctr.on("pointerdown",(e:any)=>{
        e.stopPropagation();
        handleClick({col,row,PIXI,gsap,stage,fx,orbMapRef,selRef,pendRef,live,cs,cols,rows,W,H});
      });

      if(isInitial){
        // Ola inicial: caída desde arriba fila por fila
        const delay=row*.10+col*.012;
        ctr.y=y-H*.6; ctr.alpha=0;
        gsap.to(ctr,{y,alpha:1,duration:.55,ease:"back.out(1.3)",delay});
      } else {
        // Cascada: caída desde arriba con delay acotado
        const isCascade=newOrbIds.has(id);
        const delay=isCascade ? .45+row*.05 : 0;
        ctr.y=y-H*.5; ctr.alpha=0;
        gsap.to(ctr,{y,alpha:1,duration:.5,ease:"back.out(1.1)",delay});
      }
    }
  });
}

/* ── Explosión de salida ── */
function exitAnim(gsap:any,stage:any,ctr:any){
  gsap.killTweensOf(ctr); gsap.killTweensOf(ctr.scale);
  gsap.timeline()
    .to(ctr.scale,{x:1.5,y:1.5,duration:.16,ease:"power2.out"})
    .to(ctr.scale,{x:0,y:0,duration:.25,ease:"power2.in"})
    .to(ctr,{alpha:0,duration:.22,ease:"power2.in"},"<")
    .call(()=>{ if(ctr.parent) stage.removeChild(ctr); ctr.destroy({children:true}); });
}

/* ── Partículas de match ── */
function spawnParticles(PIXI:any,gsap:any,fx:any,cx:number,cy:number,color:number,cellSz:number){
  const count=10, radius=cellSz*.55;
  for(let i=0;i<count;i++){
    const p=new PIXI.Graphics();
    p.beginFill(color,.9); p.drawCircle(0,0,cellSz*.09); p.endFill();
    p.x=cx; p.y=cy; fx.addChild(p);
    const angle=(i/count)*Math.PI*2 + Math.random()*.3;
    const dist=radius*(0.6+Math.random()*.8);
    gsap.to(p,{
      x:cx+Math.cos(angle)*dist, y:cy+Math.sin(angle)*dist,
      alpha:0, duration:.55+Math.random()*.2, ease:"power2.out",
      onComplete:()=>{ if(p.parent) fx.removeChild(p); p.destroy(); }
    });
    gsap.to(p.scale,{x:.15,y:.15,duration:.55,ease:"power2.in"});
  }
  // Flash central
  const flash=new PIXI.Graphics();
  flash.beginFill(0xffffff,.7); flash.drawCircle(0,0,cellSz*.4); flash.endFill();
  flash.x=cx; flash.y=cy; fx.addChild(flash);
  gsap.to(flash,{alpha:0,duration:.28,ease:"power2.out",
    onComplete:()=>{ if(flash.parent) fx.removeChild(flash); flash.destroy(); }});
  gsap.to(flash.scale,{x:1.8,y:1.8,duration:.28,ease:"power2.out"});
}

/* ── Crear sprite de orb ── */
function makeOrb(PIXI:any,orb:Orb,cs:number):any{
  const ctr=new PIXI.Container();
  const sz=cs*.91;
  const sprite=PIXI.Sprite.from(orbCanvas(orb.color||1,sz));
  sprite.width=sz; sprite.height=sz; sprite.anchor.set(.5);
  ctr.addChild(sprite);
  const icon=C_ICO[orb.type];
  if(icon){
    const txt=new PIXI.Text(icon,new PIXI.TextStyle({
      fontFamily:"system-ui,sans-serif", fontWeight:"900",
      fontSize:sz*.36, fill:0xffffff,
      dropShadow:true,dropShadowAlpha:.5,dropShadowBlur:3,dropShadowDistance:1,
    }));
    txt.anchor.set(.5); ctr.addChild(txt);
  }
  return ctr;
}

/* ── Click / Swap ── */
interface ClickArgs{
  col:number;row:number;PIXI:any;gsap:any;stage:any;fx:any;
  orbMapRef:React.RefObject<Map<number,OrbNode>>;
  selRef:React.RefObject<any>; pendRef:React.RefObject<boolean>;
  live:React.RefObject<any>;
  cs:number;cols:number;rows:number;W:number;H:number;
}

function handleClick({col,row,PIXI,gsap,stage,fx,orbMapRef,selRef,pendRef,live,cs,cols,rows,W,H}:ClickArgs){
  const {isAnimating,board,onSwap}=live.current;
  if(isAnimating||pendRef.current) return;
  const map=orbMapRef.current!, sel=selRef.current;

  if(!sel){ selRef.current={col,row}; showSel(PIXI,gsap,board,col,row,cs,map); return; }
  if(sel.col===col&&sel.row===row){ clearSel(gsap,map); selRef.current=null; return; }

  const dc=Math.abs(sel.col-col), dr=Math.abs(sel.row-row);
  if((dc===1&&dr===0)||(dc===0&&dr===1)){
    const o1=board[sel.col]?.[sel.row], o2=board[col]?.[row];
    clearSel(gsap,map); selRef.current=null;
    if(!o1||!o2) return;
    const n1=map.get(o1.id), n2=map.get(o2.id); if(!n1||!n2) return;
    const p1=getXY(col,row,cs,cols,rows,W,H);
    const p2=getXY(sel.col,sel.row,cs,cols,rows,W,H);
    pendRef.current=true;
    // Safety: si onComplete no llega (orb destruido, error), liberar tras 800ms
    const safetyTimer=setTimeout(()=>{ pendRef.current=false; },800);
    gsap.to(n1.ctr,{x:p1.x,y:p1.y,duration:.22,ease:"power2.inOut"});
    gsap.to(n2.ctr,{x:p2.x,y:p2.y,duration:.22,ease:"power2.inOut",
      onComplete:()=>{ clearTimeout(safetyTimer); pendRef.current=false; onSwap(sel.col,sel.row,col,row); }});
  } else {
    clearSel(gsap,map); selRef.current={col,row};
    showSel(PIXI,gsap,board,col,row,cs,map);
  }
}

/* ── Selección: sin aro, solo transparencia ── */
const SEL_KEY = "__sel_id__";

function showSel(PIXI:any,gsap:any,board:Board,col:number,row:number,cs:number,map:Map<number,OrbNode>){
  void PIXI; void cs;
  clearSel(gsap,map);
  const orb=board[col]?.[row]; if(!orb) return;
  const node=map.get(orb.id); if(!node) return;
  // Marcar como seleccionado
  node.ctr[SEL_KEY]=true;
  // Solo transparencia — sin aros, sin escala
  gsap.killTweensOf(node.ctr);
  gsap.to(node.ctr,{alpha:.45,duration:.12,ease:"power2.out"});
}

function clearSel(gsap:any,map:Map<number,OrbNode>){
  map.forEach(n=>{
    if(n.ctr[SEL_KEY]){
      n.ctr[SEL_KEY]=false;
      gsap?.killTweensOf(n.ctr);
      gsap?.to(n.ctr,{alpha:1,duration:.15,ease:"power2.out"});
    }
  });
}
