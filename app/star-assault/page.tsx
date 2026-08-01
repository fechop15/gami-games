import type { Metadata } from "next"
import StarAssaultGame from "./StarAssaultGame"

export const metadata: Metadata = {
  title: "Star Assault — Gami Game",
}

export default function StarAssaultPage() {
  return <StarAssaultGame />
}
