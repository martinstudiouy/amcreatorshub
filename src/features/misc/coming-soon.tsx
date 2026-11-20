import { Hourglass } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/ui/card'
import { NAV } from '@/components/layout/nav'

const WHAT: Record<string, string> = {
  '/clientes': 'Fichas de clientes con brand kit, servicios contratados y pestañas de proyectos, contenido, mensajes, métricas, finanzas y notas.',
  '/proyectos': 'Kanban (Por hacer → Entregado), vista lista y timeline, tareas con checklist, comentarios y adjuntos, y plantillas reutilizables.',
  '/agenda': 'Calendario de reuniones, sesiones de fotos y entregas, sincronizado con Google Calendar.',
  '/finanzas': 'Cobros, fees recurrentes, gastos, presupuestos y recibos en PDF, y reportes simples de ingresos vs. gastos.',
  '/contenidos': 'Calendario de publicaciones con arrastrar y soltar, vista de grilla de Instagram y link de aprobación para el cliente.',
  '/metricas': 'Seguidores, alcance, visualizaciones e interacciones por cuenta, top 5 del mes, mejor horario y reporte mensual en PDF.',
  '/mensajes': 'WhatsApp y mensajes de Instagram en una sola bandeja, con respuestas rápidas y etiquetas.',
}

export function ComingSoon() {
  const { pathname } = useLocation()
  const base = '/' + (pathname.split('/')[1] ?? '')
  const item = NAV.find((n) => n.to === base)
  return (
    <>
      <PageHeader title={item?.label ?? 'Próximamente'} />
      <Card>
        <EmptyState
          icon={item?.icon ?? Hourglass}
          title={item ? `Llega en la Fase ${item.phase}` : 'Esta pantalla todavía no existe'}
          description={WHAT[base] ?? 'La vamos a construir en una próxima fase.'}
        />
      </Card>
    </>
  )
}

export function NotFound() {
  return (
    <Card>
      <EmptyState icon={Hourglass} title="No encontramos esta página" description="Puede que el link esté mal escrito. Volvé al inicio desde el menú." />
    </Card>
  )
}
