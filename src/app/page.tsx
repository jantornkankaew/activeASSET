import { cookies } from 'next/headers'
import { AppShell } from '@/components/activeasset/AppShell'
import { AuthGate } from '@/components/auth/AuthGate'
import type { SidebarPage } from '@/components/activeasset/Sidebar'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = await cookies()
  const hasAuth = cookieStore.has('activeasset_auth')
  const initialPage = (cookieStore.get('activeasset_page')?.value as SidebarPage) || 'overview'
  const initialCreateLoan = cookieStore.get('activeasset_create_loan')?.value === '1'

  return (
    <AuthGate initialIsAuthenticated={hasAuth}>
      <AppShell
        initialPage={initialPage}
        initialCreateLoanOpen={initialCreateLoan}
      />
    </AuthGate>
  )
}
