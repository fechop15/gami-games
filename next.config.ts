import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desactivar React Strict Mode — el doble-mount destruye el canvas PixiJS
  // y llama init() dos veces, reseteando el juego mid-session en desarrollo.
  reactStrictMode: false,
};

export default nextConfig;
