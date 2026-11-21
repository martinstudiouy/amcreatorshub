import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, FileText, ImagePlus, LoaderCircle, Palette, Plus, Trash2, Type, Upload } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { addAssetValue, assetUrl, deleteAsset, listAssets, uploadAsset, type ClientAsset } from '@/data/crm'
import { cn } from '@/lib/utils'

const MAX_MB = 50

export function BrandKitTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient()
  const key = ['assets', clientId]
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => listAssets(clientId) })
  const [toDelete, setToDelete] = useState<ClientAsset | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: key })

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading || !data)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    )

  const by = (k: ClientAsset['kind']) => data.filter((a) => a.kind === k)

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6">
      <LogosSection clientId={clientId} items={by('logo')} onChange={refresh} onDelete={setToDelete} />
      <ColorsSection clientId={clientId} items={by('color')} onChange={refresh} onDelete={setToDelete} />
      <FontsSection clientId={clientId} items={by('font')} onChange={refresh} onDelete={setToDelete} />
      <FilesSection clientId={clientId} items={by('file')} onChange={refresh} onDelete={setToDelete} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Borrar "${toDelete?.name}"?`}
        description={toDelete?.storage_path ? 'El archivo se borra para siempre.' : undefined}
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          try {
            await deleteAsset(toDelete!)
            await refresh()
            toast.success('Borrado.')
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      />
    </div>
  )
}

type SectionProps = { clientId: string; items: ClientAsset[]; onChange: () => void; onDelete: (a: ClientAsset) => void }

function useUploader(clientId: string, kind: 'logo' | 'file', onChange: () => void) {
  const input = useRef<HTMLInputElement>(null)
  const up = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) {
        if (f.size > MAX_MB * 1024 * 1024) throw new Error(`"${f.name}" pesa más de ${MAX_MB} MB.`)
        await uploadAsset(clientId, kind, f)
      }
    },
    onSuccess: (_d, files) => {
      toast.success(files.length > 1 ? `${files.length} archivos subidos.` : 'Archivo subido.')
      onChange()
    },
    onError: (e) => {
      toast.error(friendlyError(e))
      onChange()
    },
  })
  const pick = () => input.current?.click()
  const el = (
    <input
      ref={input}
      type="file"
      multiple
      hidden
      accept={kind === 'logo' ? 'image/*,.svg' : undefined}
      onChange={(e) => {
        const files = Array.from(e.target.files ?? [])
        e.target.value = ''
        if (files.length) up.mutate(files)
      }}
    />
  )
  return { pick, el, busy: up.isPending, upload: (files: File[]) => up.mutate(files) }
}

function Section({ icon: Icon, title, action, children }: { icon: typeof Palette; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-brand" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function DropZone({ onFiles, children, className }: { onFiles: (f: File[]) => void; children: React.ReactNode; className?: string }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onFiles(files)
      }}
      className={cn('rounded-lg transition-colors', over && 'bg-accent ring-2 ring-primary/40', className)}
    >
      {children}
    </div>
  )
}

function LogosSection({ clientId, items, onChange, onDelete }: SectionProps) {
  const u = useUploader(clientId, 'logo', onChange)
  return (
    <Section
      icon={ImagePlus}
      title="Logos"
      action={
        <Button variant="outline" size="sm" onClick={u.pick} disabled={u.busy}>
          {u.busy ? <LoaderCircle className="animate-spin" /> : <Upload />} Subir
        </Button>
      }
    >
      {u.el}
      <DropZone onFiles={u.upload}>
        {items.length === 0 ? (
          <button onClick={u.pick} className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <ImagePlus className="size-5" />
            Arrastrá los logos acá o hacé clic para subirlos
            <span className="text-xs">PNG, JPG o SVG · hasta {MAX_MB} MB</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((a) => (
              <LogoThumb key={a.id} asset={a} onDelete={() => onDelete(a)} />
            ))}
          </div>
        )}
      </DropZone>
    </Section>
  )
}

function LogoThumb({ asset, onDelete }: { asset: ClientAsset; onDelete: () => void }) {
  const { data: url } = useQuery({ queryKey: ['asset-url', asset.id], queryFn: () => assetUrl(asset), staleTime: 50 * 60_000 })
  return (
    <div className="group relative overflow-hidden rounded-lg border">
      <div className="flex aspect-square items-center justify-center bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-3">
        {url ? <img src={url} alt={asset.name} className="max-h-full max-w-full object-contain" /> : <Skeleton className="size-full" />}
      </div>
      <p className="truncate border-t px-2 py-1.5 text-xs">{asset.name}</p>
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <DownloadButton asset={asset} />
        <Button size="icon" variant="secondary" className="size-7" onClick={onDelete} aria-label={`Borrar ${asset.name}`}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function DownloadButton({ asset }: { asset: ClientAsset }) {
  return (
    <Button
      size="icon"
      variant="secondary"
      className="size-7"
      aria-label={`Descargar ${asset.name}`}
      onClick={async () => {
        try {
          const url = await assetUrl(asset, true)
          if (url) window.open(url, '_blank', 'noopener')
        } catch (e) {
          toast.error(friendlyError(e))
        }
      }}
    >
      <Download className="size-3.5" />
    </Button>
  )
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${text} copiado.`)
  } catch {
    toast.message(text)
  }
}

function ColorsSection({ clientId, items, onChange, onDelete }: SectionProps) {
  const [hex, setHex] = useState('#0300FF')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const add = useMutation({
    mutationFn: () => addAssetValue(clientId, 'color', name.trim() || hex.toUpperCase(), hex.toUpperCase()),
    onSuccess: () => {
      setName('')
      setAdding(false)
      onChange()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  const validHex = /^#[0-9a-fA-F]{6}$/.test(hex)
  return (
    <Section icon={Palette} title="Paleta" action={!adding && <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> Color</Button>}>
      {items.length === 0 && !adding && <p className="py-6 text-center text-sm text-muted-foreground">Sin colores todavía. Agregá los de la marca para tenerlos a mano.</p>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((a) => (
          <div key={a.id} className="group relative">
            <button onClick={() => copy(a.value ?? '')} className="block w-full text-left" title="Copiar HEX">
              <span className="block aspect-square rounded-lg border" style={{ background: a.value ?? undefined }} />
              <span className="mt-1.5 block truncate text-xs font-medium">{a.name}</span>
              <span className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
                {a.value} <Copy className="size-3 opacity-0 group-hover:opacity-100" />
              </span>
            </button>
            <button onClick={() => onDelete(a)} className="absolute right-1 top-1 rounded-md bg-card/90 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={`Borrar ${a.name}`}>
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      {adding && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (validHex) add.mutate()
          }}
        >
          <input type="color" value={validHex ? hex : '#000000'} onChange={(e) => setHex(e.target.value.toUpperCase())} className="size-10 cursor-pointer rounded-lg border bg-card p-1" aria-label="Elegir color" />
          <Input value={hex} onChange={(e) => setHex(e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value)} className="w-28 uppercase" aria-label="HEX" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" className="min-w-32 flex-1" />
          <Button type="submit" size="sm" disabled={!validHex || add.isPending}>Agregar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
        </form>
      )}
    </Section>
  )
}

function FontsSection({ clientId, items, onChange, onDelete }: SectionProps) {
  const [family, setFamily] = useState('')
  const [use, setUse] = useState('')
  const [adding, setAdding] = useState(false)
  const add = useMutation({
    mutationFn: () => addAssetValue(clientId, 'font', use.trim() || 'Tipografía', family.trim()),
    onSuccess: () => {
      setFamily('')
      setUse('')
      setAdding(false)
      onChange()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  return (
    <Section icon={Type} title="Tipografías" action={!adding && <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> Tipografía</Button>}>
      {items.length === 0 && !adding ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Anotá qué tipografías usa la marca y para qué.</p>
      ) : (
        <ul className="divide-y">
          {items.map((a) => (
            <li key={a.id} className="group flex items-center gap-3 py-2.5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-lg font-semibold" style={{ fontFamily: `"${a.value}", serif` }}>Aa</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.value}</p>
                <p className="truncate text-xs text-muted-foreground">{a.name}</p>
              </div>
              <Button size="icon" variant="ghost" className="size-8 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => onDelete(a)} aria-label={`Borrar ${a.value}`}>
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <form
          className="mt-3 flex flex-wrap gap-2 border-t pt-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (family.trim()) add.mutate()
          }}
        >
          <Input value={family} onChange={(e) => setFamily(e.target.value)} placeholder="Familia (ej: Montserrat)" className="min-w-40 flex-1" autoFocus />
          <Input value={use} onChange={(e) => setUse(e.target.value)} placeholder="Uso (ej: Títulos)" className="min-w-32 flex-1" />
          <Button type="submit" size="sm" disabled={!family.trim() || add.isPending}>Agregar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
        </form>
      )}
    </Section>
  )
}

function FilesSection({ clientId, items, onChange, onDelete }: SectionProps) {
  const u = useUploader(clientId, 'file', onChange)
  return (
    <Section
      icon={FileText}
      title="Archivos"
      action={
        <Button variant="outline" size="sm" onClick={u.pick} disabled={u.busy}>
          {u.busy ? <LoaderCircle className="animate-spin" /> : <Upload />} Subir
        </Button>
      }
    >
      {u.el}
      <DropZone onFiles={u.upload}>
        {items.length === 0 ? (
          <button onClick={u.pick} className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <FileText className="size-5" />
            Manual de marca, fuentes, PDFs… arrastralos acá
          </button>
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id} className="group flex items-center gap-3 py-2.5">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                <DownloadButton asset={a} />
                <Button size="icon" variant="ghost" className="size-7" onClick={() => onDelete(a)} aria-label={`Borrar ${a.name}`}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DropZone>
    </Section>
  )
}
