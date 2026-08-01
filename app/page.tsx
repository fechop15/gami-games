import Link from "next/link";
import { GAMES } from "./lib/games";

export default function Home() {
  return (
    <main
      className="min-h-dvh flex flex-col items-center py-14 px-4"
      style={{
        background:
          "radial-gradient(ellipse 140% 50% at 50% -5%, rgba(100,160,255,.18) 0%, transparent 65%), linear-gradient(180deg, #0c0818 0%, #140d24 50%, #0a0f1e 100%)",
      }}
    >
      {/* Header */}
      <header className="text-center mb-14">
        <h1
          className="text-6xl font-black tracking-tight"
          style={{
            background: "linear-gradient(90deg, #ffd700 0%, #ff6b35 55%, #e74c3c 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 32px rgba(255,200,0,.3))",
          }}
        >
          Gami Game
        </h1>
        <p className="text-white/40 mt-3 text-sm tracking-wide">
          Colección de juegos custom — {GAMES.length} disponible{GAMES.length !== 1 ? "s" : ""}
        </p>
      </header>

      {/* Catalog */}
      <section className="w-full max-w-3xl">
        <p className="text-white/25 text-xs uppercase tracking-widest mb-6 font-semibold">
          Catálogo
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES.map((game) => (
            <article
              key={game.id}
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              {/* Thumbnail */}
              <div
                className="h-36 relative flex items-center justify-center"
                style={{ background: game.gradient }}
              >
                <span
                  className="absolute top-3 left-3 text-xs font-mono font-bold px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  #{game.id}
                </span>
                {game.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.icon}
                    alt={game.title}
                    className="h-24 w-24 select-none pointer-events-none"
                    style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" }}
                  />
                ) : (
                  <span
                    className="text-6xl font-black select-none"
                    style={{
                      color: "rgba(255,255,255,0.12)",
                      lineHeight: 1,
                    }}
                  >
                    {game.slug.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4 flex flex-col gap-2 flex-1">
                <h2 className="text-white font-bold text-lg leading-tight">
                  {game.title}
                </h2>
                <p className="text-white/45 text-sm flex-1 leading-relaxed">
                  {game.description}
                </p>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {game.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={game.route}
                  className="mt-3 text-center py-2.5 rounded-full font-bold text-sm cursor-pointer transition-opacity hover:opacity-90 active:opacity-75"
                  style={{
                    background: `linear-gradient(135deg, #ff6b35 0%, ${game.accentColor} 100%)`,
                    color: "#1a0533",
                  }}
                >
                  Jugar
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
