import type { Metadata } from 'next'
import ColorSwitchGame from './ColorSwitchGame'

export const metadata: Metadata = {
  title: 'Color Switch — Gami Game',
}

export default function Page() {
  return <ColorSwitchGame />
}
