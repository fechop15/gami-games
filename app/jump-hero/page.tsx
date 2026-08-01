import type { Metadata } from 'next'
import JumpHeroGame from './JumpHeroGame'

export const metadata: Metadata = {
  title: 'Jump Hero — Gami Game',
}

export default function Page() {
  return <JumpHeroGame />
}
