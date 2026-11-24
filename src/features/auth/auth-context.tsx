import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getMyProfile, setDemoRole } from '@/data/api'
import { DEMO_USER_ID } from '@/data/demo'
import type { Profile, Role } from '@/data/types'
import { safeStorage } from '@/lib/storage'
import { isDemo, sb } from '@/lib/supabase'

type Status = 'loading' | 'signed_out' | 'signed_in'

interface AuthState {
  status: Status
  userId: string | null
  email: string | null
  profile: Profile | null
  /** true cuando el usuario llegó desde el link de "olvidé mi contraseña" */
  recovering: boolean
  /** true si entró con una contraseña temporal (acceso al portal) y tiene que elegir la suya */
  mustChangePassword: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInDemo: (role: Role) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)
const DEMO_KEY = 'amc-demo-role'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recovering, setRecovering] = useState(false)

  const loadProfile = useCallback(async (userId: string) => {
    try {
      setProfile(await getMyProfile(userId))
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    if (isDemo) {
      const saved = safeStorage.get('session', DEMO_KEY) as Role | null
      if (saved) {
        setDemoRole(saved)
        void loadProfile(DEMO_USER_ID).then(() => setStatus('signed_in'))
      } else setStatus('signed_out')
      return
    }
    const client = sb()
    void client.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setStatus(data.session ? 'signed_in' : 'signed_out')
    })
    const { data: sub } = client.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setStatus('signed_out')
      }
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && s) {
        // Fuera del callback para no bloquear a supabase-js
        setTimeout(() => {
          void loadProfile(s.user.id).then(() => setStatus('signed_in'))
        }, 0)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const value: AuthState = {
    status,
    userId: isDemo ? (status === 'signed_in' ? DEMO_USER_ID : null) : (session?.user.id ?? null),
    email: isDemo ? 'martin@amcreators.uy' : (session?.user.email ?? null),
    profile,
    recovering,
    mustChangePassword: !isDemo && session?.user.user_metadata?.must_change_password === true,
    async signIn(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signInDemo(role) {
      safeStorage.set('session', DEMO_KEY, role)
      setDemoRole(role)
      await loadProfile(DEMO_USER_ID)
      setStatus('signed_in')
    },
    async signOut() {
      if (isDemo) {
        safeStorage.remove('session', DEMO_KEY)
        setProfile(null)
        setStatus('signed_out')
        return
      }
      await sb().auth.signOut()
    },
    async sendPasswordReset(email) {
      if (isDemo) return
      const { error } = await sb().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/restablecer-contrasena`,
      })
      if (error) throw error
    },
    async updatePassword(password) {
      if (isDemo) return
      const { data, error } = await sb().auth.updateUser({ password, data: { must_change_password: false } })
      if (error) throw error
      if (data.user) setSession((s) => (s ? { ...s, user: data.user } : s))
      setRecovering(false)
    },
    async refreshProfile() {
      const uid = isDemo ? DEMO_USER_ID : session?.user.id
      if (uid) await loadProfile(uid)
    },
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRole(): Role | null {
  return useAuth().profile?.role ?? null
}
