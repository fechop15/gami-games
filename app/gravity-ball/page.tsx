import type { Metadata } from 'next'
import GravityBallGame from './GravityBallGame'

export const metadata: Metadata = {
  title: 'Gravity Ball — Gami Game',
}

export default function Page() {
  return <GravityBallGame />
}
