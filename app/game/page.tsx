import Link from "next/link";
import GameCanvas from "./GameCanvas";
import "./game.css";
import "./intro.css";

export const metadata = {
  title: "Candy Fiesta — Gami Game",
};

export default function GamePage() {
  return (
    <>
      <Link
        href="/"
        aria-label="Volver al inicio"
        style={{
          position: "fixed",
          top: "0.75rem",
          left: "0.75rem",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "999px",
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "rgba(255,255,255,0.65)",
          fontSize: "0.8rem",
          fontWeight: 700,
          textDecoration: "none",
          backdropFilter: "blur(8px)",
          letterSpacing: "0.02em",
          transition: "opacity 0.15s",
        }}
      >
        ← Inicio
      </Link>
      <GameCanvas />
    </>
  );
}
