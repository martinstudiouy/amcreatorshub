import * as AvatarPrimitive from '@radix-ui/react-avatar'
import type * as React from 'react'
import { cn, initials } from '@/lib/utils'

export function Avatar({ name, src, className }: { name?: string | null; src?: string | null; className?: string }) {
  return (
    <AvatarPrimitive.Root className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}>
      {src ? <AvatarPrimitive.Image src={src} alt={name ?? ''} className="aspect-square size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center bg-primary text-xs font-semibold text-primary-foreground">
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
export type AvatarProps = React.ComponentProps<typeof Avatar>
