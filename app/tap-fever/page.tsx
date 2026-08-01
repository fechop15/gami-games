import type { Metadata } from 'next'
import TapFeverGame from './TapFeverGame'

export const metadata: Metadata = {
  title: 'Tap Fever — Gami Game',
}

export default function Page() {
  return <TapFeverGame />
}
