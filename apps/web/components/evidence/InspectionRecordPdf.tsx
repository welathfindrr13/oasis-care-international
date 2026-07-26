import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { InspectionRecordDocument } from '../../lib/inspection-records'
import {
  formatDateTime,
  formatStoredCalendarDate,
} from '../../lib/time'

interface InspectionRecordPdfProps {
  record: InspectionRecordDocument
}

function formatRecordDate(value: string): string {
  return formatStoredCalendarDate(value)
}

function formatInstant(value?: string | null): string {
  return value ? formatDateTime(value) : 'Not set'
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    color: '#17211f',
    backgroundColor: '#ffffff',
    fontSize: 10,
    lineHeight: 1.5,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#d7dcd8',
    paddingBottom: 14,
    marginBottom: 18,
  },
  product: {
    fontSize: 9,
    color: '#0f766e',
    marginBottom: 5,
    fontWeight: 700,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 7,
  },
  body: {
    color: '#52615d',
    fontSize: 10,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: '#d7dcd8',
    paddingBottom: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 110,
    color: '#52615d',
  },
  value: {
    flex: 1,
    fontWeight: 700,
  },
  includedRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f0eb',
    paddingTop: 7,
    paddingBottom: 7,
  },
  footer: {
    marginTop: 16,
    color: '#52615d',
    fontSize: 8,
  },
})

export function InspectionRecordPdf({ record }: InspectionRecordPdfProps) {
  return (
    <Document
      title={`Inspection records for ${record.clientName}`}
      author="Oasis Care"
      subject="Records for inspection preparation"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.product}>Oasis Care</Text>
          <Text style={styles.title}>Inspection records</Text>
          <Text style={styles.body}>
            Prepared records for {record.clientName}. These records support
            inspection preparation but do not guarantee an inspection outcome.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Record details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.value}>{record.clientName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{record.status}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Covered period</Text>
            <Text style={styles.value}>
              {formatRecordDate(record.periodStart)} to{' '}
              {formatRecordDate(record.periodEnd)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Created</Text>
            <Text style={styles.value}>
              {formatInstant(record.generatedAt)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Published</Text>
            <Text style={styles.value}>
              {formatInstant(record.publishedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Included records</Text>
          {record.includedRecords.length === 0 ? (
            <Text style={styles.body}>No records have been included yet.</Text>
          ) : (
            record.includedRecords.map((group) => (
              <View key={group.sourceType} style={styles.includedRow}>
                <Text>{group.label}</Text>
                <Text>{group.count}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          This download contains record types, counts, dates, and status only.
          Raw care notes, Family content, actor details, and internal identifiers
          are not included.
        </Text>
      </Page>
    </Document>
  )
}
