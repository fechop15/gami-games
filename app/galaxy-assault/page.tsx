import type { Metadata } from "next"
import GalaxyAssaultGame from "./GalaxyAssaultGame"

export const metadata: Metadata = {
  title: "Galaxy Assault — Gami Game",
}

export default function GalaxyAssaultPage() {
  return <GalaxyAssaultGame />
}