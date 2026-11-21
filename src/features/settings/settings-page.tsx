import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRole } from '@/features/auth/auth-context'
import { ExchangeRatesTab } from './exchange-rates-tab'
import { IntegrationsTab } from './integrations-tab'
import { ProfileTab } from './profile-tab'
import { StudioTab } from './studio-tab'
import { TeamTab } from './team-tab'
import { TemplatesTab } from './templates-tab'

export function SettingsPage() {
  const role = useRole()
  const isAdmin = role === 'admin'
  const [params, setParams] = useSearchParams()
  const tabs = [
    { id: 'perfil', label: 'Mi perfil', show: true },
    { id: 'estudio', label: 'Estudio', show: isAdmin },
    { id: 'equipo', label: 'Equipo y roles', show: isAdmin },
    { id: 'plantillas', label: 'Plantillas de proyecto', show: true },
    { id: 'tipo-de-cambio', label: 'Tipo de cambio', show: true },
    { id: 'integraciones', label: 'Integraciones', show: isAdmin },
  ].filter((t) => t.show)
  const requested = params.get('tab')
  const current = tabs.some((t) => t.id === requested) ? requested! : isAdmin ? 'estudio' : 'perfil'

  return (
    <>
      <PageHeader title="Configuración" description={isAdmin ? 'Datos del estudio, equipo y conexiones.' : 'Tu perfil, las plantillas de proyecto y el tipo de cambio.'} />
      <Tabs value={current} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="max-w-full">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="perfil"><ProfileTab /></TabsContent>
        {isAdmin && <TabsContent value="estudio"><StudioTab /></TabsContent>}
        {isAdmin && <TabsContent value="equipo"><TeamTab /></TabsContent>}
        <TabsContent value="plantillas"><TemplatesTab /></TabsContent>
        <TabsContent value="tipo-de-cambio"><ExchangeRatesTab canEdit={isAdmin} /></TabsContent>
        {isAdmin && <TabsContent value="integraciones"><IntegrationsTab /></TabsContent>}
      </Tabs>
    </>
  )
}
