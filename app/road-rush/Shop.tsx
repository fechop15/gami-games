"use client";

import { SKINS, Skin } from "./skins";
import { Save, persistSave } from "./save";

interface Props {
  save: Save;
  onSaveChange: (s: Save) => void;
  onClose: () => void;
}

const ANIM_STYLES = `
  @keyframes holoGlow {
    0%   { filter: hue-rotate(0deg)   brightness(1.0) drop-shadow(0 0 8px rgba(255,80,80,0.95)); }
    14%  { filter: hue-rotate(52deg)  brightness(1.3) drop-shadow(0 0 18px rgba(255,200,0,0.95)); }
    28%  { filter: hue-rotate(104deg) brightness(1.0) drop-shadow(0 0 8px rgba(0,255,120,0.95)); }
    42%  { filter: hue-rotate(156deg) brightness(1.3) drop-shadow(0 0 18px rgba(0,210,255,0.95)); }
    57%  { filter: hue-rotate(208deg) brightness(1.0) drop-shadow(0 0 8px rgba(120,60,255,0.95)); }
    71%  { filter: hue-rotate(260deg) brightness(1.3) drop-shadow(0 0 18px rgba(255,60,200,0.95)); }
    85%  { filter: hue-rotate(312deg) brightness(1.0) drop-shadow(0 0 8px rgba(255,80,80,0.95)); }
    100% { filter: hue-rotate(360deg) brightness(1.0) drop-shadow(0 0 8px rgba(255,80,80,0.95)); }
  }
  @keyframes holoBreathe {
    0%, 100% { transform: scale(1);    }
    50%      { transform: scale(1.05); }
  }
  @keyframes holoBg {
    0%   { background-position: 0% 50%;   }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%;   }
  }
  .car-holo-img {
    animation: holoGlow 2.6s linear infinite;
  }
  .car-holo-wrap {
    animation: holoBreathe 2.6s ease-in-out infinite;
    background: linear-gradient(135deg,
      rgba(255,80,80,0.18), rgba(255,200,0,0.18),
      rgba(0,255,120,0.18), rgba(0,210,255,0.18),
      rgba(120,60,255,0.18), rgba(255,60,200,0.18),
      rgba(255,80,80,0.18)) !important;
    background-size: 400% 400% !important;
    animation: holoBreathe 2.6s ease-in-out infinite, holoBg 4s ease infinite;
  }
`;

function SkinCard({
  skin,
  save,
  onAction,
}: {
  skin: Skin;
  save: Save;
  onAction: (skin: Skin) => void;
}) {
  const unlocked = save.unlocked.includes(skin.id);
  const active   = save.activeSkin === skin.id;
  const canBuy   = !unlocked && save.coins >= skin.price;
  const tooExp   = !unlocked && !canBuy;

  let btnLabel: string;
  let btnStyle: React.CSSProperties;

  if (active) {
    btnLabel = "Equipado";
    btnStyle = { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", cursor: "default" };
  } else if (unlocked) {
    btnLabel = "Equipar";
    btnStyle = { background: `linear-gradient(135deg, ${skin.bodyColor}, ${skin.glowColor})`, color: "#0a0a14", cursor: "pointer" };
  } else if (canBuy) {
    btnLabel = `Comprar · ${skin.price} M`;
    btnStyle = { background: "linear-gradient(135deg, #ff6b35, #f7c500)", color: "#1a0533", cursor: "pointer" };
  } else {
    btnLabel = `${skin.price} M`;
    btnStyle = { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", cursor: "default" };
  }

  return (
    <div
      style={{
        borderRadius: "0.85rem",
        padding: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
        border: `1px solid ${active ? skin.bodyColor : "rgba(255,255,255,0.08)"}`,
        background: active
          ? `color-mix(in srgb, ${skin.bodyColor} 12%, transparent)`
          : "rgba(255,255,255,0.04)",
        transition: "border-color 0.2s",
      }}
    >
      {/* Preview del auto */}
      <div
        className={skin.animStyle === "rainbow" && !tooExp ? "car-holo-wrap" : ""}
        style={{
          height: 110,
          borderRadius: "0.55rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          background: tooExp
            ? "rgba(255,255,255,0.03)"
            : `radial-gradient(ellipse at 50% 60%, ${skin.bodyColor}22 0%, transparent 70%)`,
        }}
      >
        {skin.imageSrc ? (
          <img
            src={skin.imageSrc}
            alt={skin.name}
            className={skin.animStyle === "rainbow" && !tooExp ? "car-holo-img" : ""}
            style={{
              height: "100%",
              width: "auto",
              objectFit: "contain",
              opacity: tooExp ? 0.35 : 1,
              filter: tooExp
                ? "grayscale(0.6)"
                : skin.animStyle !== "rainbow"
                ? `drop-shadow(0 0 6px ${skin.glowColor})`
                : undefined,
              transition: "opacity 0.2s",
            }}
          />
        ) : (
          <svg width="22" height="40" viewBox="0 0 22 40" fill="none"
            style={{ opacity: tooExp ? 0.35 : 1 }}>
            <rect x="1" y="1" width="20" height="38" rx="4" fill={skin.bodyColor} />
            <rect x="4" y="4" width="14" height="14" rx="2" fill={skin.glowColor} opacity="0.45" />
            <rect x="4" y="5" width="14" height="3.5" rx="1" fill="rgba(220,240,255,0.32)" />
            <rect x="2"  y="31" width="5" height="3" rx="1" fill="rgba(255,70,70,0.9)" />
            <rect x="15" y="31" width="5" height="3" rx="1" fill="rgba(255,70,70,0.9)" />
          </svg>
        )}

        {/* Badge "Equipado" */}
        {active && (
          <div style={{
            position:     "absolute",
            top:          6,
            right:        6,
            background:   skin.bodyColor,
            color:        "#0a0a14",
            fontSize:     "0.6rem",
            fontWeight:   800,
            padding:      "2px 6px",
            borderRadius: 999,
            letterSpacing: "0.04em",
          }}>
            ON
          </div>
        )}
      </div>

      <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.8rem", lineHeight: 1.2 }}>
        {skin.name}
      </span>
      <span style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.7rem" }}>
        {skin.description}
      </span>

      <button
        onClick={() => !active && !tooExp && onAction(skin)}
        style={{
          marginTop: "auto",
          padding: "0.38rem 0.4rem",
          borderRadius: 999,
          border: "none",
          fontWeight: 700,
          fontSize: "0.72rem",
          letterSpacing: "0.01em",
          transition: "opacity 0.15s",
          ...btnStyle,
        }}
      >
        {btnLabel}
      </button>
    </div>
  );
}

export default function Shop({ save, onSaveChange, onClose }: Props) {
  function handleAction(skin: Skin) {
    let updated: Save;
    if (save.unlocked.includes(skin.id)) {
      updated = { ...save, activeSkin: skin.id };
    } else if (save.coins >= skin.price) {
      updated = {
        ...save,
        coins: save.coins - skin.price,
        unlocked: [...save.unlocked, skin.id],
        activeSkin: skin.id,
      };
    } else {
      return;
    }
    persistSave(updated);
    onSaveChange(updated);
  }

  return (
    <>
      <style>{ANIM_STYLES}</style>
    <div
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         200,
        background:     "rgba(0,0,0,0.78)",
        backdropFilter: "blur(10px)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "1rem",
      }}
    >
      <div
        style={{
          background:    "linear-gradient(160deg, rgba(18,8,36,0.97) 0%, rgba(8,14,30,0.97) 100%)",
          border:        "1px solid rgba(255,255,255,0.1)",
          borderRadius:  "1.25rem",
          padding:       "1.25rem",
          width:         "100%",
          maxWidth:      400,
          maxHeight:     "88dvh",
          display:       "flex",
          flexDirection: "column",
          gap:           "1rem",
        }}
      >
        {/* Cabecera */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.05rem" }}>
            Tienda de Skins
          </span>
          <span
            style={{
              background:   "rgba(255,215,0,0.12)",
              border:       "1px solid rgba(255,215,0,0.3)",
              borderRadius: 999,
              padding:      "0.22rem 0.75rem",
              color:        "#ffd700",
              fontWeight:   700,
              fontSize:     "0.82rem",
            }}
          >
            {save.coins} M
          </span>
        </div>

        {/* Nota de monedas */}
        <p style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.7rem", margin: 0, flexShrink: 0 }}>
          Ganas 1 moneda por cada 10 m recorridos.
        </p>

        {/* Grid de skins */}
        <div
          style={{
            overflowY:           "auto",
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 "0.65rem",
            flex:                1,
          }}
        >
          {SKINS.map(skin => (
            <SkinCard key={skin.id} skin={skin} save={save} onAction={handleAction} />
          ))}
        </div>

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          style={{
            flexShrink:   0,
            padding:      "0.7rem",
            borderRadius: 999,
            border:       "1px solid rgba(255,255,255,0.14)",
            background:   "rgba(255,255,255,0.05)",
            color:        "rgba(255,255,255,0.65)",
            fontWeight:   600,
            cursor:       "pointer",
            fontSize:     "0.85rem",
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
    </>
  );
}
