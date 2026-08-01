import type { Metadata } from 'next'
import BrickBlitzGame from './BrickBlitzGame'

export const metadata: Metadata = {
  title: 'Brick Blitz — Gami Game',
}

export default function Page() {
  return <BrickBlitzGame />
}
