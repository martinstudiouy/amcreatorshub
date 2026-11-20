import { useQuery } from '@tanstack/react-query'
import { CalendarRange, FolderKanban, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { globalSearch } from '@/data/api'
import type { SearchResult } from '@/data/types'
import { useRole } from '@/features/auth/auth-context'
import { navFor } from './nav'

const kindMeta: Record<SearchResult['kind'], { label: string; icon: typeof Users }> = {
  cliente: { label: 'Clientes', icon: Users },
  proyecto: { label: 'Proyectos', icon: FolderKanban },
  publicacion: { label: 'Publicaciones', icon: CalendarRange },
}

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Búsqueda global: Ctrl/Cmd + K */
export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('')
  const term = useDebounced(q)
  const navigate = useNavigate()
  const role = useRole()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const { data = [], isFetching } = useQuery({
    queryKey: ['search', term],
    queryFn: () => globalSearch(term),
    enabled: open && term.trim().length >= 2,
    staleTime: 30_000,
  })

  const go = (to: string) => {
    onOpenChange(false)
    setQ('')
    navigate(to)
  }

  const groups = (Object.keys(kindMeta) as SearchResult['kind'][])
    .map((k) => ({ kind: k, items: data.filter((r) => r.kind === k) }))
    .filter((g) => g.items.length)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0" hideClose aria-describedby={undefined}>
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Buscá clientes, proyectos o publicaciones…" />
          <CommandList>
            {term.trim().length < 2 ? (
              <CommandGroup heading="Ir a">
                {navFor(role).map((n) => (
                  <CommandItem key={n.to} value={n.to} onSelect={() => go(n.to)}>
                    <n.icon />
                    {n.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <>
                {!isFetching && <CommandEmpty>No encontramos nada con "{term}".</CommandEmpty>}
                {groups.map((g) => {
                  const M = kindMeta[g.kind]
                  return (
                    <CommandGroup key={g.kind} heading={M.label}>
                      {g.items.map((r) => (
                        <CommandItem key={r.id} value={`${r.kind}-${r.id}`} onSelect={() => go(r.link)}>
                          <M.icon />
                          <div className="min-w-0">
                            <p className="truncate">{r.title}</p>
                            {r.subtitle && <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )
                })}
              </>
            )}
          </CommandList>
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>↑↓ para moverte · Enter para abrir</span>
            <span>Esc para cerrar</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
