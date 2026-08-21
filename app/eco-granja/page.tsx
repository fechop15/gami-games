import type { Metadata } from "next"
import EcoGranjaGame from "./EcoGranjaGame"

export const metadata: Metadata = {
  title: "EcoGranja — Gami Game",
}

export default function EcoGranjaPage() {
  return <EcoGranjaGame />
}