import NewVisitPageClient from './NewVisitPageClient'

interface NewVisitPageProps {
  searchParams?: {
    clientId?: string
  }
}

export default function NewVisitPage({ searchParams }: NewVisitPageProps) {
  const initialClientId =
    typeof searchParams?.clientId === 'string' ? searchParams.clientId : ''

  return <NewVisitPageClient initialClientId={initialClientId} />
}
