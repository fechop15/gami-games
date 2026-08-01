import type { Metadata } from 'next'
import StackTowerGame from './StackTowerGame'

export const metadata: Metadata = {
  title: 'Stack Tower — Gami Game',
}

export default function Page() {
  return <StackTowerGame />
}
