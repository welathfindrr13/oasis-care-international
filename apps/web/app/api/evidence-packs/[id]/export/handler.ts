import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { InspectionRecordPdf } from '../../../../../components/evidence/InspectionRecordPdf'
import { hasAccessCapability } from '../../../../../lib/auth/capabilities'
import { getServerAuthContext } from '../../../../../lib/auth/server-auth'
import {
  INSPECTION_RECORD_CLIENT_QUERY,
  INSPECTION_RECORD_EXPORT_QUERY,
  RECORD_EVIDENCE_PACK_EXPORT_MUTATION,
  type InspectionRecordClientQueryResponse,
  type InspectionRecordExportQueryResponse,
} from '../../../../../lib/graphql/queries'
import { buildInspectionRecordDocument } from '../../../../../lib/inspection-records'

function safeFilename(value: string): string {
  return value
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
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
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
) {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql'
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  if (!response.ok) {
    return {
      status:
        response.status === 401 || response.status === 403
          ? response.status
          : 500,
      body: null as T | null,
    }
  }

  const body = (await response.json()) as {
    data?: T
    errors?: any[]
  }
  if (body.errors?.length) {
    return {
      status: statusFromGraphQLError(body.errors[0]),
      body: null as T | null,
    }
  }
  return body.data
    ? { status: 200 as const, body: body.data }
    : { status: 404 as const, body: null }
}

const defaultDependencies = {
  getAuthContext: getServerAuthContext,
  executeGraphQL: executeBackendGraphQL,
  renderPdf: async (record: ReturnType<typeof buildInspectionRecordDocument>) =>
    renderToBuffer(
      React.createElement(InspectionRecordPdf, { record }) as any,
    ),
}

export function createInspectionRecordExportHandler(
  overrides: Partial<typeof defaultDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides }

  return async function inspectionRecordExport(
    _request: NextRequest,
    props: { params: Promise<{ id: string }> },
  ) {
    const { id } = await props.params
    try {
      const authContext = await dependencies.getAuthContext()
      if (!authContext.authenticated || !authContext.accessToken) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
      if (
        !hasAccessCapability(
          authContext.accessSnapshot.capabilities,
          'TENANT_ADMIN',
        )
      ) {
        return new NextResponse('Forbidden', { status: 403 })
      }

      const packResult =
        await dependencies.executeGraphQL<InspectionRecordExportQueryResponse>(
          authContext.accessToken,
          INSPECTION_RECORD_EXPORT_QUERY,
          { id },
        )
      if (packResult.status !== 200 || !packResult.body?.getEvidencePack) {
        const status = packResult.status === 404 ? 404 : packResult.status
        return new NextResponse(
          status === 404
            ? 'Inspection record not found'
            : 'Inspection record export failed',
          { status },
        )
      }

      const pack = packResult.body.getEvidencePack
      const clientResult =
        await dependencies.executeGraphQL<InspectionRecordClientQueryResponse>(
          authContext.accessToken,
          INSPECTION_RECORD_CLIENT_QUERY,
          { id: pack.clientId },
        )
      if (clientResult.status !== 200 || !clientResult.body?.client) {
        return new NextResponse('Inspection record not found', {
          status: clientResult.status === 404 ? 404 : clientResult.status,
        })
      }

      const safeRecord = buildInspectionRecordDocument(
        pack,
        clientResult.body.client.fullName,
      )
      const pdfBuffer = await dependencies.renderPdf(safeRecord)
      const auditResult = await dependencies.executeGraphQL(
        authContext.accessToken,
        RECORD_EVIDENCE_PACK_EXPORT_MUTATION,
        { id: pack.id },
      )
      if (auditResult.status !== 200) {
        return new NextResponse('Inspection record export audit failed', {
          status: auditResult.status,
        })
      }

      const filename = `oasis-inspection-records-${safeFilename(
        pack.periodStart,
      )}-${safeFilename(pack.periodEnd)}.pdf`
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch {
      return new NextResponse('Inspection record export failed', {
        status: 500,
      })
    }
  }
}
