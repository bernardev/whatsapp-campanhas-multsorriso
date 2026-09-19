// app/campanhas/[id]/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getVerifiedUser } from '@/lib/auth'
import DashboardClient from './dashboard-client'

export default async function DashboardPage(props: { params: Promise<{ id: string }> }) {
  const user = await getVerifiedUser()
  if (!user) {
    redirect('/login')
  }

  const params = await props.params
  const campaignId = params.id

  return <DashboardClient campaignId={campaignId} />
}