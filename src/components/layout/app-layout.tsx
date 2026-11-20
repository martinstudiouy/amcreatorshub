import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CommandMenu } from './command-menu'
import { MobileNav } from './mobile-nav'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false)
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onSearch={() => setSearchOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
