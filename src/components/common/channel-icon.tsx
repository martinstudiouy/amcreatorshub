import { MessageCircle } from 'lucide-react'
import type { Channel } from '@/data/types'
import { cn } from '@/lib/utils'

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  )
}

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  return channel === 'instagram' ? (
    <InstagramGlyph className={cn('size-4', className)} />
  ) : (
    <MessageCircle className={cn('size-4', className)} />
  )
}

export const channelLabel: Record<Channel, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram' }
