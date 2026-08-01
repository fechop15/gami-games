import type { Metadata } from 'next'
import BubblePopGame from './BubblePopGame'

export const metadata: Metadata = {
  title: 'Bubble Pop — Gami Game',
}

export default function Page() {
  return <BubblePopGame />
}
