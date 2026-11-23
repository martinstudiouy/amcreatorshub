import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { NAV } from '@/components/layout/nav'
import { useAuth } from '@/features/auth/auth-context'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/login-page'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { AgendaPage } from '@/features/agenda/agenda-page'
import { ClientDetailPage } from '@/features/clients/client-detail-page'
import { ClientsPage } from '@/features/clients/clients-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { ApprovalPage } from '@/features/content/approval-page'
import { ContentPage } from '@/features/content/content-page'
import { MetricsPage } from '@/features/metrics/metrics-page'
import { FinancePage } from '@/features/finance/finance-page'
import { ClientPortal } from '@/features/misc/client-portal'
import { ComingSoon, NotFound } from '@/features/misc/coming-soon'
import { ProjectDetailPage } from '@/features/projects/project-detail-page'
import { ProjectsPage } from '@/features/projects/projects-page'
import { PrivacyPage } from '@/features/misc/privacy-page'
import { SettingsPage } from '@/features/settings/settings-page'

/** El rol cliente solo ve su portal; admin y equipo ven el CRM. */
function StaffArea() {
  const { profile } = useAuth()
  if (profile?.role === 'cliente') return <Navigate to="/portal" replace />
  return <AppLayout />
}

export default function App() {
  const { recovering } = useAuth()
  if (recovering) return <ResetPasswordPage />

  return (
    <Routes>
      <Route path="/privacidad" element={<PrivacyPage />} />
      <Route path="/aprobar/:token" element={<ApprovalPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/olvide-mi-contrasena" element={<ForgotPasswordPage />} />
      <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
      <Route path="/portal" element={<RequireAuth><ClientPortal /></RequireAuth>} />

      <Route element={<RequireAuth><StaffArea /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="configuracion" element={<SettingsPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/:id" element={<ClientDetailPage />} />
        <Route path="proyectos" element={<ProjectsPage />} />
        <Route path="proyectos/:id" element={<ProjectDetailPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="contenidos" element={<ContentPage />} />
        <Route path="metricas" element={<MetricsPage />} />
        <Route path="finanzas" element={<RequireRole roles={['admin']}><FinancePage /></RequireRole>} />
        {NAV.filter((n) => n.phase > 6).map((n) => (
          <Route
            key={n.to}
            path={`${n.to.slice(1)}/*`}
            element={<RequireRole roles={n.roles}><ComingSoon /></RequireRole>}
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
