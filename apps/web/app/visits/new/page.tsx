import NewVisitPageClient from './NewVisitPageClient'

interface NewVisitPageProps {
  searchParams?: Promise<{
    clientId?: string
  }>
}

export default async function NewVisitPage(props: NewVisitPageProps) {
  const searchParams = await props.searchParams
  const initialClientId =
    typeof searchParams?.clientId === 'string' ? searchParams.clientId : ''

  return <NewVisitPageClient initialClientId={initialClientId} />
}
