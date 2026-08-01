import type { Metadata } from 'next'
import Merge2048Game from './Merge2048Game'

export const metadata: Metadata = {
  title: 'Merge 2048 — Gami Game',
}

export default function Page() {
  return <Merge2048Game />
}
