// PDF de presupuestos y recibos con la identidad de AM Creators:
// isotipo en degradé azul royal → negro, Montserrat, azul #0300FF.
// Este archivo se carga solo cuando alguien descarga un PDF (no pesa en la app).
import { Document, Font, LinearGradient, Page, Path, Stop, StyleSheet, Svg, Text, View, Defs, pdf } from '@react-pdf/renderer'
import montserrat400 from '@expo-google-fonts/montserrat/400Regular/Montserrat_400Regular.ttf?url'
import montserrat500 from '@expo-google-fonts/montserrat/500Medium/Montserrat_500Medium.ttf?url'
import montserrat600 from '@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf?url'
import montserrat700 from '@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf?url'
import { ISOTIPO_PATH } from '@/components/layout/wordmark'
import type { Settings } from '@/data/types'
import { formatDate, formatMoney, type Currency } from '@/lib/format'

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: montserrat400, fontWeight: 400 },
    { src: montserrat500, fontWeight: 500 },
    { src: montserrat600, fontWeight: 600 },
    { src: montserrat700, fontWeight: 700 },
  ],
})
Font.registerHyphenationCallback((w) => [w]) // sin cortar palabras con guiones

const BLUE = '#0300FF'
const NAVY = '#020061'
const INK = '#0A0A0A'
const MUTED = '#6B6B73'
const LINE = '#E6E6EA'
const SOFT = '#F5F5F7'

const s = StyleSheet.create({
  page: { fontFamily: 'Montserrat', fontSize: 9.5, color: INK, paddingTop: 40, paddingBottom: 64, paddingHorizontal: 44 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { flexDirection: 'row', alignItems: 'center' },
  logoText: { marginLeft: 8 },
  creators: { fontSize: 15, fontWeight: 400, letterSpacing: -0.2 },
  tagline: { fontSize: 5.2, letterSpacing: 1.6, marginTop: 1 },
  docType: { fontSize: 20, fontWeight: 700, color: BLUE, textAlign: 'right', letterSpacing: 0.5 },
  docMeta: { textAlign: 'right', color: MUTED, marginTop: 3, fontSize: 9 },
  docNumber: { textAlign: 'right', fontWeight: 600, fontSize: 10.5, marginTop: 4 },
  rule: { height: 2, backgroundColor: BLUE, marginTop: 18, marginBottom: 18, width: 48 },
  parties: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  party: { width: '47%' },
  label: { fontSize: 7, fontWeight: 600, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 },
  partyName: { fontSize: 11, fontWeight: 600, marginBottom: 2 },
  partyLine: { color: MUTED, lineHeight: 1.45 },
  tHead: { flexDirection: 'row', borderBottomWidth: 1.2, borderBottomColor: INK, paddingBottom: 6 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: LINE, paddingVertical: 8 },
  th: { fontSize: 7, fontWeight: 600, color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase' },
  cDesc: { flex: 1, paddingRight: 10 },
  cQty: { width: 44, textAlign: 'right' },
  cPrice: { width: 86, textAlign: 'right' },
  cAmount: { width: 92, textAlign: 'right' },
  totals: { marginTop: 14, marginLeft: 'auto', width: 230 },
  tLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  tLabel: { color: MUTED },
  grand: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: BLUE, color: '#FFFFFF', borderRadius: 6, paddingVertical: 9, paddingHorizontal: 12, marginTop: 6 },
  grandText: { fontSize: 12, fontWeight: 700, color: '#FFFFFF' },
  status: { marginTop: 18, padding: 10, borderRadius: 6, backgroundColor: SOFT },
  notes: { marginTop: 18 },
  footer: { position: 'absolute', bottom: 28, left: 44, right: 44, borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MUTED },
})

export interface PdfLine {
  description: string
  quantity: number
  unit_price: number
}

export interface PdfDoc {
  kind: 'presupuesto' | 'recibo'
  number: string | null
  issue_date: string
  due_date?: string | null
  valid_until?: string | null
  currency: Currency
  items: PdfLine[]
  subtotal: number
  discount?: number
  vat_rate: number
  total: number
  notes?: string | null
  status?: string
  paid_at?: string | null
  payment_method?: string | null
  cfe_number?: string | null
  fx_rate?: number
  client: { brand_name: string; name?: string | null; email?: string | null; whatsapp?: string | null }
  project_name?: string | null
}

function Isotipo({ size = 28 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 328 207" style={{ width: (size * 328) / 207, height: size }}>
      <Defs>
        <LinearGradient id="amc" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BLUE} />
          <Stop offset="1" stopColor="#000000" />
        </LinearGradient>
      </Defs>
      <Path d={ISOTIPO_PATH} fill="url(#amc)" fillRule="evenodd" />
    </Svg>
  )
}

const money = (n: number, c: Currency) => formatMoney(n, c, { decimals: true })

function FinanceDocument({ doc, studio }: { doc: PdfDoc; studio: Settings }) {
  const isQuote = doc.kind === 'presupuesto'
  const vat = round2(doc.total - (doc.subtotal - (doc.discount ?? 0)))
  const studioLines = [
    studio.legal_name,
    studio.rut ? `RUT ${studio.rut}` : null,
    studio.address,
    [studio.email, studio.phone].filter(Boolean).join(' · ') || null,
    studio.website,
  ].filter(Boolean) as string[]

  return (
    <Document title={`${isQuote ? 'Presupuesto' : 'Recibo'} ${doc.number ?? ''} · ${doc.client.brand_name}`} author={studio.studio_name} creator="AM Creators Hub">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.logo}>
            <Isotipo />
            <View style={s.logoText}>
              <Text style={s.creators}>creators</Text>
              <Text style={s.tagline}>estudio creativo</Text>
            </View>
          </View>
          <View>
            <Text style={s.docType}>{isQuote ? 'PRESUPUESTO' : 'RECIBO'}</Text>
            <Text style={s.docNumber}>{doc.number ?? ''}</Text>
            <Text style={s.docMeta}>Fecha: {formatDate(doc.issue_date)}</Text>
            {isQuote && doc.valid_until && <Text style={s.docMeta}>Válido hasta: {formatDate(doc.valid_until)}</Text>}
            {!isQuote && doc.due_date && <Text style={s.docMeta}>Vence: {formatDate(doc.due_date)}</Text>}
          </View>
        </View>

        <View style={s.rule} />

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.label}>De</Text>
            <Text style={s.partyName}>{studio.studio_name}</Text>
            {studioLines.map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
          </View>
          <View style={s.party}>
            <Text style={s.label}>Para</Text>
            <Text style={s.partyName}>{doc.client.brand_name}</Text>
            {[doc.client.name, doc.client.email, doc.client.whatsapp].filter(Boolean).map((l) => (
              <Text key={l!} style={s.partyLine}>{l}</Text>
            ))}
            {doc.project_name && <Text style={[s.partyLine, { marginTop: 4, color: NAVY }]}>Proyecto: {doc.project_name}</Text>}
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, s.cDesc]}>Descripción</Text>
          <Text style={[s.th, s.cQty]}>Cant.</Text>
          <Text style={[s.th, s.cPrice]}>Precio unit.</Text>
          <Text style={[s.th, s.cAmount]}>Importe</Text>
        </View>
        {doc.items.map((it, i) => (
          <View key={i} style={s.tRow} wrap={false}>
            <Text style={s.cDesc}>{it.description}</Text>
            <Text style={s.cQty}>{fmtQty(it.quantity)}</Text>
            <Text style={s.cPrice}>{money(it.unit_price, doc.currency)}</Text>
            <Text style={[s.cAmount, { fontWeight: 600 }]}>{money(round2(it.quantity * it.unit_price), doc.currency)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.tLine}>
            <Text style={s.tLabel}>Subtotal</Text>
            <Text>{money(doc.subtotal, doc.currency)}</Text>
          </View>
          {!!doc.discount && doc.discount > 0 && (
            <View style={s.tLine}>
              <Text style={s.tLabel}>Descuento</Text>
              <Text>− {money(doc.discount, doc.currency)}</Text>
            </View>
          )}
          {doc.vat_rate > 0 && (
            <View style={s.tLine}>
              <Text style={s.tLabel}>IVA {fmtQty(doc.vat_rate)}%</Text>
              <Text>{money(vat, doc.currency)}</Text>
            </View>
          )}
          <View style={s.grand}>
            <Text style={s.grandText}>Total</Text>
            <Text style={s.grandText}>{money(doc.total, doc.currency)}</Text>
          </View>
          {doc.currency === 'USD' && doc.fx_rate && doc.fx_rate !== 1 && (
            <Text style={{ color: MUTED, fontSize: 7.5, textAlign: 'right', marginTop: 5 }}>
              Tipo de cambio de referencia: $ {doc.fx_rate.toLocaleString('es-UY', { minimumFractionDigits: 2 })} por US$ 1
            </Text>
          )}
        </View>

        {!isQuote && doc.status && (
          <View style={s.status} wrap={false}>
            <Text style={{ fontWeight: 600, color: doc.status === 'cobrado' ? '#12805C' : NAVY }}>
              {doc.status === 'cobrado'
                ? `Cobrado el ${formatDate(doc.paid_at)}${doc.payment_method ? ` · ${doc.payment_method}` : ''}`
                : doc.status === 'vencido'
                  ? `Pendiente de pago · venció el ${formatDate(doc.due_date)}`
                  : `Pendiente de pago${doc.due_date ? ` · vence el ${formatDate(doc.due_date)}` : ''}`}
            </Text>
          </View>
        )}

        {doc.notes && (
          <View style={s.notes} wrap={false}>
            <Text style={s.label}>Notas</Text>
            <Text style={{ lineHeight: 1.5 }}>{doc.notes}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>
            {isQuote
              ? `Presupuesto sin valor fiscal.${doc.valid_until ? ` Válido hasta el ${formatDate(doc.valid_until)}.` : ''}`
              : doc.cfe_number
                ? `Comprobante interno. Factura electrónica (CFE) N.º ${doc.cfe_number}.`
                : 'Comprobante interno: no es un comprobante fiscal (CFE).'}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${studio.studio_name} · ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

const round2 = (n: number) => Math.round(n * 100) / 100
const fmtQty = (n: number) => new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(n)

/** Arma el PDF y devuelve el archivo. */
export async function renderFinancePdf(doc: PdfDoc, studio: Settings): Promise<Blob> {
  return pdf(<FinanceDocument doc={doc} studio={studio} />).toBlob()
}

export function pdfFileName(doc: PdfDoc) {
  const slug = doc.client.brand_name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${doc.kind === 'presupuesto' ? 'Presupuesto' : 'Recibo'}-${doc.number ?? 'borrador'}-${slug}.pdf`
}
