// app/campanhas/[id]/dashboard/page.tsx
import DashboardClient from './dashboard-client'

export default async function DashboardPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const campaignId = params.id

  return <DashboardClient campaignId={campaignId} />
}