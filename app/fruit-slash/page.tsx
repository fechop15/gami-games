import type { Metadata } from 'next'
import FruitSlashGame from './FruitSlashGame'

export const metadata: Metadata = {
  title: 'Fruit Slash — Gami Game',
}

export default function Page() {
  return <FruitSlashGame />
}
