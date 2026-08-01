import type { Metadata } from 'next'
import SnakeEvoGame from './SnakeEvoGame'

export const metadata: Metadata = {
  title: 'Snake Evo — Gami Game',
}

export default function Page() {
  return <SnakeEvoGame />
}
