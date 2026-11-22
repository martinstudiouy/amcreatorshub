import { Wordmark } from '@/components/layout/wordmark'

/** Política de privacidad pública (la pide Google para publicar la app de OAuth). */
export function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Política de privacidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">AM Creators Hub · Última actualización: 22/11/2026</p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          <p>
            AM Creators Hub es la herramienta interna de gestión de AM Creators, estudio de diseño y marketing digital de Montevideo, Uruguay.
            La usan únicamente el equipo del estudio y, en modo de solo lectura, los clientes del estudio.
          </p>

          <h2>Qué datos usamos</h2>
          <ul>
            <li>Datos de clientes y proyectos que carga el propio equipo (nombres, contactos, tareas, archivos de marca).</li>
            <li>
              Si un administrador conecta Google Calendar: los eventos del calendario conectado (título, fecha y hora, lugar, descripción y link de videollamada),
              para mostrarlos en la agenda del CRM y para crear o actualizar en Google los eventos que se agendan desde el CRM.
            </li>
            <li>El email de la cuenta de Google conectada, para mostrar qué cuenta está sincronizada.</li>
          </ul>

          <h2>Cómo usamos los datos de Google</h2>
          <p>
            El uso y la transferencia de información recibida de las APIs de Google cumplen con la{' '}
            <a className="text-brand underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Política de datos de usuario de los servicios de API de Google
            </a>
            , incluidos los requisitos de Uso Limitado. Los datos del calendario se usan solo para sincronizar la agenda del estudio. No se venden,
            no se comparten con terceros, no se usan para publicidad y no se usan para entrenar modelos de inteligencia artificial.
          </p>

          <h2>Dónde se guardan</h2>
          <p>
            Los datos se guardan en una base de datos privada en Supabase. El permiso de acceso a Google se guarda cifrado en el servidor y nunca se envía al navegador.
            El acceso a la información está restringido por usuario y por rol.
          </p>

          <h2>Cómo revocar el acceso</h2>
          <p>
            Un administrador puede desconectar Google Calendar en cualquier momento desde Configuración → Integraciones, lo que borra el permiso guardado.
            También se puede quitar el acceso desde{' '}
            <a className="text-brand underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
          </p>

          <h2>Contacto</h2>
          <p>Por cualquier consulta sobre estos datos, escribinos al email de contacto de AM Creators.</p>
        </div>
      </main>
    </div>
  )
}
