import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '../../../auth/[...nextauth]/authOptions'
import {
  EVIDENCE_PACK_QUERY,
  RECORD_EVIDENCE_PACK_EXPORT_MUTATION,
  type EvidencePackQueryResponse,
} from '../../../../../lib/graphql/queries'
import { EvidencePackPdf } from '../../../../../components/evidence/EvidencePackPdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

function statusFromError(error: unknown): number {
  const message = String((error as any)?.message || '')
  if (/unauthori[sz]ed/i.test(message)) return 401
  if (/forbidden/i.test(message)) return 403
  if (/not found/i.test(message)) return 404
  return 500
}

function statusFromGraphQLError(error: any): number {
  const code = String(error?.extensions?.code || '')
  const message = String(error?.message || '')
  if (code === 'UNAUTHENTICATED' || /unauthori[sz]ed/i.test(message)) return 401
  if (code === 'FORBIDDEN' || /forbidden/i.test(message)) return 403
  if (/not found/i.test(message)) return 404
  return 500
}

async function executeBackendGraphQL<T>(
  request: NextRequest,
  query: string,
  variables: Record<string, unknown>,
) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql'
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  const session = await getServerSession(authOptions)
  const accessToken =
    (token as any)?.accessToken ||
    (session as any)?.accessToken ||
    (token as any)?.idToken ||
    (session as any)?.idToken

  if (!accessToken) {
    return { status: 401 as const, body: null as T | null }
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    return { status: response.status === 401 || response.status === 403 ? response.status : 500, body: null as T | null }
  }

  const body = (await response.json()) as {
    data?: T
    errors?: any[]
  }
  if (body.errors?.length) {
    return { status: statusFromGraphQLError(body.errors[0]), body: null as T | null }
  }

  if (!body.data) {
    return { status: 404 as const, body: null }
  }

  return { status: 200 as const, body: body.data }
}

async function fetchEvidencePack(request: NextRequest, id: string) {
  const result = await executeBackendGraphQL<EvidencePackQueryResponse>(
    request,
    EVIDENCE_PACK_QUERY,
    { id },
  )
  if (result.status === 200 && !result.body?.getEvidencePack) {
    return { status: 404 as const, body: null }
  }
  return result
}

async function recordEvidencePackExport(request: NextRequest, id: string) {
  return executeBackendGraphQL(
    request,
    RECORD_EVIDENCE_PACK_EXPORT_MUTATION,
    { id },
  )
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await fetchEvidencePack(request, params.id)
    if (result.status !== 200 || !result.body) {
      const message =
        result.status === 401
          ? 'Unauthorized'
          : result.status === 403
            ? 'Forbidden'
            : result.status === 404
              ? 'Evidence pack not found'
              : 'Evidence pack export failed'

      return new NextResponse(message, { status: result.status })
    }

    const data = result.body
    const pack = data.getEvidencePack
    const pdfBuffer = await renderToBuffer(React.createElement(EvidencePackPdf, { pack }) as any)
    const auditResult = await recordEvidencePackExport(request, pack.id)
    if (auditResult.status !== 200) {
      return new NextResponse('Evidence pack export audit failed', { status: auditResult.status })
    }
    const filename = `oasis-evidence-pack-${safeFilename(pack.kind)}-${safeFilename(pack.id)}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const status = statusFromError(error)
    const message =
      status === 401
        ? 'Unauthorized'
        : status === 403
          ? 'Forbidden'
          : status === 404
            ? 'Evidence pack not found'
            : 'Evidence pack export failed'

    if (status === 500) {
      console.error('Evidence pack export failed:', error)
    }
    return new NextResponse(message, { status })
  }
}
