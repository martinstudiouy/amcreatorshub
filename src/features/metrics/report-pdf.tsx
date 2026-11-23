// Reporte mensual de Instagram en PDF, con la identidad de AM Creators.
// Se carga solo cuando alguien genera un reporte.
import { Document, Page, Path, Rect, StyleSheet, Svg, Text, View, pdf } from '@react-pdf/renderer'
import type { SocialAccount, PostMetric } from '@/data/instagram'
import type { Settings } from '@/data/types'
import { formatDate, formatNumber } from '@/lib/format'
import { BLUE, INK, Isotipo, LINE, MUTED, NAVY, SOFT } from '@/features/finance/pdf/finance-pdf'
import { SLOTS, pctChange, postInteractions, type BestTimes, type Summary } from './metrics-calc'

export interface ReportInput {
  account: SocialAccount
  month: string
  monthLabel: string
  prevLabel: string
  now: Summary
  before: Summary
  followers: { date: string; value: number | null }[]
  reach: { date: string; value: number | null }[]
  top: PostMetric[]
  times: BestTimes | null
  studio: Settings
}

const s = StyleSheet.create({
  page: { fontFamily: 'Montserrat', fontSize: 9, color: INK, paddingTop: 30, paddingBottom: 52, paddingHorizontal: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { flexDirection: 'row', alignItems: 'center' },
  creators: { fontSize: 15, letterSpacing: -0.2, marginLeft: 8 },
  tagline: { fontSize: 5.2, letterSpacing: 1.6, marginTop: 1, marginLeft: 8 },
  docType: { fontSize: 18, fontWeight: 700, color: BLUE, textAlign: 'right', letterSpacing: 0.5 },
  meta: { textAlign: 'right', color: MUTED, marginTop: 3 },
  rule: { height: 2, backgroundColor: BLUE, marginTop: 12, marginBottom: 12, width: 48 },
  account: { fontSize: 16, fontWeight: 700 },
  sub: { color: MUTED, marginTop: 2 },
  label: { fontSize: 7, fontWeight: 600, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginHorizontal: -4 },
  kpi: { width: '33.333%', padding: 4 },
  kpiBox: { backgroundColor: SOFT, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10 },
  kpiLabel: { fontSize: 7.5, color: MUTED },
  kpiValue: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  up: { color: '#15803D', fontSize: 7.5, marginTop: 2, fontWeight: 600 },
  down: { color: '#B91C1C', fontSize: 7.5, marginTop: 2, fontWeight: 600 },
  flat: { color: MUTED, fontSize: 7.5, marginTop: 2 },
  section: { marginTop: 14 },
  row2: { flexDirection: 'row', justifyContent: 'space-between' },
  half: { width: '48.5%' },
  tHead: { flexDirection: 'row', borderBottomWidth: 1.2, borderBottomColor: INK, paddingBottom: 5 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: LINE, paddingVertical: 4.5 },
  th: { fontSize: 6.8, fontWeight: 600, color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase' },
  num: { width: 58, textAlign: 'right' },
  callout: { backgroundColor: BLUE, borderRadius: 6, padding: 10, color: '#FFFFFF', marginBottom: 8 },
  footer: { position: 'absolute', bottom: 26, left: 40, right: 40, borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MUTED },
})

const n = (v: number | null | undefined) => (v == null ? '—' : formatNumber(v))
const pct = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('es-UY', { maximumFractionDigits: 1 })}%`)

function Change({ c, points }: { c: number | null; points?: boolean }) {
  if (c == null) return <Text style={s.flat}>Sin comparación</Text>
  return <Text style={c >= 0 ? s.up : s.down}>{`${c >= 0 ? '+' : ''}${c.toLocaleString('es-UY')}${points ? ' pts' : '%'} vs. mes anterior`}</Text>
}

function LinePdf({ points, width, height }: { points: { value: number | null }[]; width: number; height: number }) {
  const data = points.map((p) => p.value).filter((v): v is number => v != null)
  if (data.length < 2) return <Text style={{ color: MUTED }}>Sin datos suficientes.</Text>
  let min = Math.min(...data)
  let max = Math.max(...data)
  if (min === max) {
    min -= 1
    max += 1
  }
  const x = (i: number) => (i / (data.length - 1)) * width
  const y = (v: number) => height - 4 - ((v - min) / (max - min)) * (height - 8)
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <Svg width={width} height={height}>
      <Path d={`${d} L${width} ${height} L0 ${height} Z`} fill={BLUE} fillOpacity={0.08} />
      <Path d={d} stroke={BLUE} strokeWidth={2} fill="none" />
    </Svg>
  )
}

function BarsPdf({ points, width, height }: { points: { value: number | null }[]; width: number; height: number }) {
  const max = Math.max(1, ...points.map((p) => p.value ?? 0))
  const w = width / Math.max(1, points.length)
  return (
    <Svg width={width} height={height}>
      {points.map((p, i) => {
        const h = ((p.value ?? 0) / max) * height
        return <Rect key={i} x={i * w + 0.6} y={height - h} width={Math.max(1, w - 1.2)} height={h} fill={i % 2 ? BLUE : NAVY} />
      })}
    </Svg>
  )
}

function Report({ r }: { r: ReportInput }) {
  const { now, before } = r
  const er = now.engagementRate != null && before.engagementRate != null ? Math.round((now.engagementRate - before.engagementRate) * 10) / 10 : null
  const kpis = [
    { label: 'Seguidores', value: n(now.followersEnd), change: <Text style={now.followersDelta == null ? s.flat : now.followersDelta >= 0 ? s.up : s.down}>{now.followersDelta == null ? 'Sin datos del inicio' : `${now.followersDelta >= 0 ? '+' : ''}${formatNumber(now.followersDelta)} en el mes`}</Text> },
    { label: 'Alcance', value: n(now.reach), change: <Change c={pctChange(now.reach, before.reach)} /> },
    { label: 'Visualizaciones', value: n(now.views), change: <Change c={pctChange(now.views, before.views)} /> },
    { label: 'Interacciones', value: n(now.interactions), change: <Change c={pctChange(now.interactions, before.interactions)} /> },
    { label: 'Engagement (interacciones ÷ alcance)', value: pct(now.engagementRate), change: <Change c={er} points /> },
    { label: 'Clics al link del perfil', value: n(now.linkClicks), change: <Change c={pctChange(now.linkClicks, before.linkClicks)} /> },
  ]
  const owner = r.account.client_name ?? r.studio.studio_name
  return (
    <Document title={`Reporte ${r.monthLabel} · @${r.account.username}`} author={r.studio.studio_name} creator="AM Creators Hub">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <View style={s.logo}>
              <Isotipo />
              <View>
                <Text style={s.creators}>creators</Text>
                <Text style={s.tagline}>estudio creativo</Text>
              </View>
            </View>
          </View>
          <View>
            <Text style={s.docType}>REPORTE MENSUAL</Text>
            <Text style={s.meta}>Instagram · {r.monthLabel}</Text>
          </View>
        </View>
        <View style={s.rule} />
        <Text style={s.account}>{owner}</Text>
        <Text style={s.sub}>@{r.account.username} · {now.posts} publicaciones en el mes · comparado con {r.prevLabel}</Text>

        <View style={s.kpis}>
          {kpis.map((k) => (
            <View key={k.label} style={s.kpi}>
              <View style={s.kpiBox}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={s.kpiValue}>{k.value}</Text>
                {k.change}
              </View>
            </View>
          ))}
        </View>

        <View style={[s.section, s.row2]}>
          <View style={s.half}>
            <Text style={s.label}>Evolución de seguidores</Text>
            <LinePdf points={r.followers} width={245} height={72} />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Alcance por día</Text>
            <BarsPdf points={r.reach} width={245} height={72} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Las 5 publicaciones con más interacciones</Text>
          {r.top.length ? (
            <>
              <View style={s.tHead}>
                <Text style={[s.th, { width: 16 }]}>#</Text>
                <Text style={[s.th, { flex: 1 }]}>Publicación</Text>
                <Text style={[s.th, s.num]}>Alcance</Text>
                <Text style={[s.th, s.num]}>Me gusta</Text>
                <Text style={[s.th, s.num]}>Coment.</Text>
                <Text style={[s.th, s.num]}>Guardados</Text>
                <Text style={[s.th, s.num]}>Interacc.</Text>
              </View>
              {r.top.map((p, i) => (
                <View key={p.ig_media_id} style={s.tRow} wrap={false}>
                  <Text style={{ width: 16, fontWeight: 700, color: BLUE }}>{i + 1}</Text>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontWeight: 500 }}>{(p.caption ?? 'Sin texto').replace(/\s+/g, ' ').slice(0, 70)}{(p.caption?.length ?? 0) > 70 ? '…' : ''}</Text>
                    <Text style={{ color: MUTED, fontSize: 7.5, marginTop: 1 }}>{p.media_product_type === 'REELS' ? 'Reel' : p.media_type === 'CAROUSEL_ALBUM' ? 'Carrusel' : 'Foto'} · {formatDate(p.posted_at)}</Text>
                  </View>
                  <Text style={s.num}>{n(p.reach)}</Text>
                  <Text style={s.num}>{n(p.likes)}</Text>
                  <Text style={s.num}>{n(p.comments)}</Text>
                  <Text style={s.num}>{n(p.saves)}</Text>
                  <Text style={[s.num, { fontWeight: 700 }]}>{n(postInteractions(p))}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={{ color: MUTED }}>No hubo publicaciones este mes.</Text>
          )}
        </View>

        <View style={[s.section, s.row2]} wrap={false}>
          <View style={s.half}>
            <Text style={s.label}>Mejor momento para publicar</Text>
            {r.times?.best ? (
              <>
                <View style={s.callout}>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados', 'Domingos'][r.times.best.weekday]} de {SLOTS[r.times.best.slot].label} h
                  </Text>
                  <Text style={{ fontSize: 7.5, color: '#FFFFFF', marginTop: 2 }}>Según las interacciones de las últimas {r.times.sample} publicaciones (90 días).</Text>
                </View>
                {r.times.bestSlot && <Text style={{ color: MUTED }}>Franja que mejor funciona en general: {SLOTS[r.times.bestSlot.slot].label} h.</Text>}
                {r.times.bestDay && <Text style={{ color: MUTED, marginTop: 2 }}>Mejor día en general: {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][r.times.bestDay.weekday]}.</Text>}
              </>
            ) : (
              <Text style={{ color: MUTED }}>Todavía no hay publicaciones suficientes.</Text>
            )}
          </View>
          <View style={s.half}>
            <Text style={s.label}>Comparativa con {r.prevLabel}</Text>
            {[
              ['Alcance', n(now.reach), n(before.reach)],
              ['Visualizaciones', n(now.views), n(before.views)],
              ['Interacciones', n(now.interactions), n(before.interactions)],
              ['Engagement', pct(now.engagementRate), pct(before.engagementRate)],
              ['Seguidores ganados', n(now.followersDelta), n(before.followersDelta)],
              ['Publicaciones', n(now.posts), n(before.posts)],
            ].map(([label, a, b]) => (
              <View key={label} style={[s.tRow, { paddingVertical: 4 }]}>
                <Text style={{ flex: 1 }}>{label}</Text>
                <Text style={[s.num, { fontWeight: 600 }]}>{a}</Text>
                <Text style={[s.num, { color: MUTED }]}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>Datos de Instagram (Meta) guardados por AM Creators Hub. El alcance es la suma de los alcances diarios.</Text>
          <Text render={({ pageNumber, totalPages }) => `${r.studio.studio_name} · ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function downloadMetricsReport(r: ReportInput) {
  const blob = await pdf(<Report r={r} />).toBlob()
  const slug = (r.account.client_name ?? r.account.username ?? 'cuenta').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Reporte-Instagram-${slug}-${r.month}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
