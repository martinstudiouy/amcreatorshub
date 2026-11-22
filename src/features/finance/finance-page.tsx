import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { runFinanceJobs } from '@/data/finance'
import { invalidateFinance } from './dialogs'
import { ExpensesTab } from './expenses-tab'
import { FeesTab } from './fees-tab'
import { InvoicesTab } from './invoices-tab'
import { QuotesTab } from './quotes-tab'
import { ReportsTab } from './reports-tab'
import { SummaryTab } from './summary-tab'

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'cobros', label: 'Cobros' },
  { id: 'presupuestos', label: 'Presupuestos' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'fees', label: 'Fees mensuales' },
  { id: 'reportes', label: 'Reportes' },
]

export function FinancePage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const current = TABS.some((t) => t.id === requested) ? requested! : 'resumen'
  const go = (tab: string) => setParams({ tab }, { replace: true })

  // Al entrar: genera los fees y gastos fijos del mes y marca vencidos (por si el cron todavía no corrió)
  useEffect(() => {
    void runFinanceJobs()
      .then(() => invalidateFinance(qc))
      .catch(() => undefined)
  }, [qc])

  return (
    <>
      <PageHeader title="Finanzas" description="Cobros, presupuestos, gastos y cómo viene el mes. Solo lo ves vos." />
      <Tabs value={current} onValueChange={go}>
        <TabsList className="max-w-full">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="resumen"><SummaryTab onGo={go} /></TabsContent>
        <TabsContent value="cobros"><InvoicesTab /></TabsContent>
        <TabsContent value="presupuestos"><QuotesTab /></TabsContent>
        <TabsContent value="gastos"><ExpensesTab /></TabsContent>
        <TabsContent value="fees"><FeesTab /></TabsContent>
        <TabsContent value="reportes"><ReportsTab /></TabsContent>
      </Tabs>
    </>
  )
}
