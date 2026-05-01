"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, FileText, Sparkles, Download } from "lucide-react"
import { InsightChart } from "@/components/insight-chart"
import jsPDF from "jspdf"

interface OnePagerProps {
  analysis: any
  datasetName: string
  rowCount: number
  columns: string[]
  data: Record<string, unknown>[] | undefined
}

export function BusinessOnePager(props: OnePagerProps) {
  const { analysis, datasetName, rowCount } = props
  const [open, setOpen] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)

  // Minimal manual inputs for MVP
  const [company, setCompany] = React.useState("")
  const [whatWeDo, setWhatWeDo] = React.useState("")
  const [targetCustomer, setTargetCustomer] = React.useState("")
  const [businessModel, setBusinessModel] = React.useState("")
  const [stage, setStage] = React.useState("")
  const [contact, setContact] = React.useState("")
  const [team, setTeam] = React.useState("")
  const [fundingAsk, setFundingAsk] = React.useState("")
  const [logoDataUrl, setLogoDataUrl] = React.useState<string | null>(null)

  // Compute safe capabilities from validated analysis
  const kpis = analysis?.business_analysis?.kpis
  const detected = analysis?.business_analysis?.detectedColumns

  const revenueAvailable = !!detected?.revenueColumn && kpis?.totalRevenue !== null && kpis?.totalRevenue !== undefined
  // Consider cost available only with detected column and numeric KPI presence
  const costAvailable = !!detected?.costColumn && (kpis?.totalCost !== null && kpis?.totalCost !== undefined || kpis?.profitReliability === 'verified')
  const profitAvailable = revenueAvailable && (costAvailable || (kpis?.profitReliability === 'derived' && kpis?.profitMargin !== null && kpis?.totalProfit !== null))

  const openModal = () => setOpen(true)

  const closeModal = () => {
    setOpen(false)
    setGenerating(false)
  }

  const handleGenerate = () => {
    setGenerating(true)
    // MVP: client-side render only
    setTimeout(() => setGenerating(false), 300)
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const exportPdf = () => {
    // Basic one-pager PDF reflecting current preview
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14
    let y = 18

    // Branded Header band
    const headerH = 28
    doc.setFillColor(24, 24, 27)
    doc.rect(0, 0, pageWidth, headerH, 'F')
    // Title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.text(company || datasetName, margin, 14)
    // Subtitle (elevatorPitch)
    if (elevatorPitch) {
      doc.setFontSize(10)
      doc.setTextColor(209, 213, 219)
      const sub = doc.splitTextToSize(elevatorPitch, pageWidth - margin * 2 - 26)
      doc.text(sub, margin, 20)
    }
    // Logo block (top-right)
    if (logoDataUrl) {
      try {
        const imgW = 20
        const imgH = 20
        doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - imgW, 6, imgW, imgH, undefined, 'FAST')
      } catch {}
    } else {
      // Placeholder box to balance header
      doc.setDrawColor(55, 65, 81)
      doc.rect(pageWidth - margin - 20, 6, 20, 20)
    }
    // Rows meta intentionally omitted for Business One-Pager header

    // Accent divider and light content background
    doc.setDrawColor(167, 139, 250)
    doc.setLineWidth(0.6)
    doc.line(0, headerH, pageWidth, headerH)
    const contentBgH = doc.internal.pageSize.getHeight() - headerH
    doc.setFillColor(248, 250, 252)
    doc.rect(0, headerH, pageWidth, contentBgH, 'F')

    // Structured content below header
    y = headerH + 10

    // Utility to draw a simple card with title and body, returns height
    const drawCard = (x: number, yStart: number, w: number, title: string, body: string): number => {
      const pad = 5
      const titleH = 6
      const lineH = 5
      const innerW = w - pad * 2
      const lines = doc.splitTextToSize(body, innerW)
      const bodyH = lines.length * lineH
      const h = pad + titleH + 2 + bodyH + pad
      // Card box with subtle fill
      doc.setDrawColor(229, 231, 235)
      doc.setFillColor(245, 247, 250)
      doc.roundedRect(x, yStart, w, h, 2, 2, 'FD')
      // Title
      doc.setFontSize(12)
      doc.setTextColor(24, 24, 27)
      doc.text(title, x + pad, yStart + pad + titleH)
      // Body
      doc.setFontSize(9.5)
      doc.setTextColor(75, 85, 99)
      doc.text(lines, x + pad, yStart + pad + titleH + 2 + lineH)
      return h
    }

    const gutter = 6
    const twoW = (pageWidth - 2 * margin - gutter) / 2

    // Row 1: Problem | Solution
    const probBody = whatWeDo ? `Opportunity: ${whatWeDo}` : ''
    const solBody = whatWeDo || ''
    let rowH = 0
    if (probBody.trim()) rowH = Math.max(rowH, drawCard(margin, y, twoW, 'Problem / Opportunity', probBody))
    if (solBody.trim()) rowH = Math.max(rowH, drawCard(margin + twoW + gutter, y, twoW, 'Solution', solBody))
    if (rowH > 0) y += rowH + 6

    // Row 2: Target | Model | Stage
    const threeGutter = 6
    const threeW = (pageWidth - 2 * margin - 2 * threeGutter) / 3
    let row2H = 0
    const row2 = [
      { t: 'Target Market', b: targetCustomer || '' },
      { t: 'Business Model', b: businessModel || '' },
      { t: 'Stage', b: stage || '' },
    ]
    row2.forEach((c, i) => {
      if (!c.b.trim()) return
      const x = margin + i * (threeW + threeGutter)
      row2H = Math.max(row2H, drawCard(x, y, threeW, c.t, c.b))
    })
    if (row2H > 0) y += row2H + 6

    // Compact visual: Revenue by Region (Top 5) if available
    if (regionChartData.length > 0) {
      const boxW = pageWidth - 2 * margin
      const pad = 5
      const titleH = 6
      // Chart sizing with stable rows and padding
      const topPad = 6
      const bottomPad = 6
      const barGap = 5
      const barH = 7
      const rows = regionChartData.length
      const chartH = topPad + rows * (barH + barGap) - barGap + bottomPad
      const boxH = pad + titleH + 2 + chartH + pad

      // Card frame with subtle fill
      doc.setDrawColor(229, 231, 235)
      doc.setFillColor(245, 247, 250)
      doc.roundedRect(margin, y, boxW, boxH, 2, 2, 'FD')
      // Title
      doc.setFontSize(12)
      doc.setTextColor(24, 24, 27)
      doc.text('Revenue by Region (Top 5)', margin + pad, y + pad + titleH)

      // Chart area
      const chartY = y + pad + titleH + 2
      const chartX = margin + pad
      const chartW = boxW - pad * 2
      const maxVal = Math.max(...regionChartData.map(d => Math.abs(d.value)), 1)

      // Label and value columns
      const maxNameLen = Math.max(...regionChartData.map(d => d.name.length))
      const labelW = Math.min(62, Math.max(34, maxNameLen * 3.6))
      const valueW = 28
      const barAreaW = chartW - labelW - valueW - 10

      regionChartData.forEach((item, idx) => {
        const yRowTop = chartY + topPad + idx * (barH + barGap)
        // Label (left column)
        doc.setFontSize(9)
        doc.setTextColor(75, 85, 99)
        const label = item.name.length > 20 ? item.name.slice(0, 18) + '..' : item.name
        doc.text(label, chartX, yRowTop + barH - 1.5)
        // Bar (middle column)
        const width = (Math.abs(item.value) / maxVal) * barAreaW
        doc.setFillColor(168, 85, 247) // purple tone
        doc.roundedRect(chartX + labelW + 4, yRowTop, Math.max(1, width), barH, 1, 1, 'F')
        // Value (right column, right-aligned)
        doc.setFontSize(9)
        doc.setTextColor(24, 24, 27)
        const valStr = item.value >= 100 ? `${item.value.toFixed(0)}` : `${item.value.toFixed(1)}`
        doc.text(valStr, chartX + labelW + 4 + barAreaW + valueW, yRowTop + barH - 1.5, { align: 'right' })
      })

      // Spacing after chart card
      y += boxH + 8
    }

    // Key Metrics tiles (validated only), 2 columns grid
    if (revenueAvailable || costAvailable || profitAvailable) {
      const tiles: Array<{ label: string; value: string; color: [number, number, number] }> = []
      if (revenueAvailable && typeof kpis?.totalRevenue === 'number') tiles.push({ label: 'Revenue', value: formatCurrency(kpis.totalRevenue), color: [34, 211, 238] })
      if (costAvailable && typeof kpis?.totalCost === 'number') tiles.push({ label: 'Expenses', value: formatCurrency(kpis.totalCost), color: [167, 139, 250] })
      if (profitAvailable && typeof kpis?.totalProfit === 'number') tiles.push({ label: 'Net Profit', value: formatCurrency(kpis.totalProfit), color: [16, 185, 129] })
      if (profitAvailable && typeof kpis?.profitMargin === 'number') tiles.push({ label: 'Margin', value: `${kpis.profitMargin.toFixed(1)}%`, color: [59, 130, 246] })
      if (tiles.length > 0) {
        const pad = 6
        const titleH = 7
        const gutter = 6
        const cols = 2
        const tileW = (pageWidth - 2 * margin - (cols - 1) * gutter - pad * 2)
          / cols
        const tileH = 18
        const rows = Math.ceil(tiles.length / cols)
        const boxH = pad + titleH + 2 + rows * tileH + (rows - 1) * gutter + pad
        const boxW = pageWidth - 2 * margin

        // Frame
        doc.setDrawColor(229, 231, 235)
        doc.roundedRect(margin, y, boxW, boxH, 2, 2)
        // Title
        doc.setFontSize(12)
        doc.setTextColor(24, 24, 27)
        doc.text('Key Metrics / Financial Snapshot', margin + pad, y + pad + titleH)

        // Tiles
        let tx = margin + pad
        let ty = y + pad + titleH + 2
        tiles.forEach((t, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          tx = margin + pad + col * (tileW + gutter)
          ty = y + pad + titleH + 2 + row * (tileH + gutter)
          // Tile card
          doc.setDrawColor(t.color[0], t.color[1], t.color[2])
          doc.setFillColor(24, 24, 27)
          doc.roundedRect(tx, ty, tileW, tileH, 2, 2)
          // Label
          doc.setFontSize(9)
          doc.setTextColor(t.color[0], t.color[1], t.color[2])
          doc.text(t.label.toUpperCase(), tx + 3, ty + 6)
          // Value
          doc.setFontSize(13)
          doc.setTextColor(255, 255, 255)
          doc.text(t.value, tx + 3, ty + 14)
        })

        y += boxH + 10
      }
    }

    // Traction (validated only)
    if (revenueAvailable || profitAvailable) {
      const lines: string[] = []
      if (revenueAvailable && typeof kpis?.totalRevenue === 'number') lines.push(`Revenue to date: ${formatCurrency(kpis.totalRevenue)}`)
      if (profitAvailable && typeof kpis?.profitMargin === 'number') lines.push(`Margin: ${kpis.profitMargin.toFixed(1)}%`)
      if (lines.length > 0) {
        const body = lines.join('\n')
        const h = drawCard(margin, y, pageWidth - 2 * margin, 'Traction / Highlights', body)
        y += h + 8
      }
    }

    // Expense visual block (validated cost): horizontal single-bar snapshot
    if (costAvailable && typeof kpis?.totalCost === 'number') {
      const boxW = pageWidth - 2 * margin
      const pad = 6
      const titleH = 7
      const contentH = 18
      const boxH = pad + titleH + 2 + contentH + pad
      // Frame
      doc.setDrawColor(229, 231, 235)
      doc.roundedRect(margin, y, boxW, boxH, 2, 2)
      // Title
      doc.setFontSize(12)
      doc.setTextColor(24, 24, 27)
      doc.text('Expenses Snapshot', margin + pad, y + pad + titleH)
      // Bar area
      const areaX = margin + pad
      const areaY = y + pad + titleH + 4
      const areaW = boxW - pad * 2
      const barH = 8
      const totalRev = revenueAvailable && typeof kpis?.totalRevenue === 'number' ? kpis.totalRevenue : kpis?.totalCost || 1
      const maxBase = Math.max(Math.abs(totalRev), Math.abs(kpis.totalCost)) || 1
      const expBarW = Math.max(1, (Math.abs(kpis.totalCost) / maxBase) * areaW)
      // Background track
      doc.setDrawColor(229, 231, 235)
      doc.roundedRect(areaX, areaY, areaW, barH, 2, 2)
      // Fill
      doc.setFillColor(167, 139, 250)
      doc.roundedRect(areaX, areaY, expBarW, barH, 2, 2, 'F')
      // Value label
      doc.setFontSize(10)
      doc.setTextColor(75, 85, 99)
      doc.text(`Total Expenses: ${formatCurrency(kpis.totalCost)}`, areaX, areaY + barH + 6)
      y += boxH + 10
    }

    // Team | Contact row
    const teamBody = team || ''
    const contactBody = contact || ''
    rowH = 0
    if (teamBody.trim()) rowH = Math.max(rowH, drawCard(margin, y, twoW, 'Team', teamBody))
    if (contactBody.trim()) rowH = Math.max(rowH, drawCard(margin + twoW + gutter, y, twoW, 'Contact', contactBody))
    if (rowH > 0) y += rowH + 8

    // Funding Ask (optional)
    if (fundingAsk && fundingAsk.trim()) {
      const h = drawCard(margin, y, pageWidth - 2 * margin, 'Funding Ask', fundingAsk)
      y += h + 8
    }

    // Footer-like bar
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 10, 2, 2)
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(company || datasetName, margin + 3, y + 6)
    doc.text(contact || 'add contact', pageWidth - margin - 3, y + 6, { align: 'right' })

    doc.save(`${(company || datasetName).replace(/[^a-z0-9]/gi, '_')}_one_pager.pdf`)
  }

  const Section: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
    <Card className="bg-gradient-to-br from-neutral-900/80 to-neutral-900/60 border border-neutral-800/80 shadow-[0_0_30px_rgba(124,58,237,0.05)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] tracking-wide text-white flex items-center gap-2">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-[13px] leading-relaxed text-neutral-300 whitespace-pre-line">{children}</CardContent>
    </Card>
  )

  const formatCurrency = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
    return `$${v.toFixed(0)}`
  }

  const elevatorPitch = React.useMemo(() => {
    const name = company || datasetName
    const what = whatWeDo.trim()
    const who = targetCustomer.trim()
    if (what && who) return `${name} helps ${who} ${what}.`
    if (what) return `${name}: ${what}.`
    return `${name}`
  }, [company, datasetName, whatWeDo, targetCustomer])

  // Derived safe texts for richer sections (no invention beyond inputs)
  const solutionText = React.useMemo(() => {
    const what = whatWeDo.trim()
    const who = targetCustomer.trim()
    if (what && who) return `${what}. Built for ${who}.`
    if (what) return what
    return ''
  }, [whatWeDo, targetCustomer])

  const targetMarketText = React.useMemo(() => {
    const who = targetCustomer.trim()
    return who ? `Primary clientele: ${who}.` : ''
  }, [targetCustomer])

  const businessModelText = React.useMemo(() => {
    const bm = businessModel.trim()
    return bm ? `Monetization: ${bm}.` : ''
  }, [businessModel])

  const stageText = React.useMemo(() => {
    const st = stage.trim()
    return st ? `Stage: ${st}.` : ''
  }, [stage])

  // Compact visual support: revenue by region (validated only)
  const regionChartData = React.useMemo(() => {
    const regions = kpis?.topRegions as Array<{ name: string; percentage?: number; value?: number }> | undefined
    if (!revenueAvailable || !regions || regions.length === 0) return [] as { name: string; value: number }[]
    // Prefer percentage if available, else value
    return regions.slice(0, 5).map(r => ({
      name: r.name,
      value: typeof r.percentage === 'number' ? Math.max(0, r.percentage) : Math.max(0, Number(r.value || 0))
    }))
  }, [revenueAvailable, kpis])

  return (
    <>
      <Button 
        onClick={openModal}
        variant="outline"
        className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
      >
        {generating ? <Sparkles className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Generate Business One-Pager
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-[96vw] max-w-[1440px] h-[92vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 text-white font-semibold text-base">
                <FileText className="h-4 w-4 text-cyan-400" /> Business One-Pager (MVP)
              </div>
              <button onClick={closeModal} className="text-neutral-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid md:grid-cols-[380px,1fr] gap-0 h-[calc(92vh-52px)]">
              {/* Left: Inputs */}
              <div className="p-5 border-r border-neutral-800 space-y-3 overflow-y-auto">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Company / Startup Name</label>
                  <input value={company} onChange={e=>setCompany(e.target.value)} className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white" placeholder={datasetName} />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">What do you do? (short)</label>
                  <textarea value={whatWeDo} onChange={e=>setWhatWeDo(e.target.value)} className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white h-16" placeholder="e.g., AI-driven financial insights for SMBs" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Target Customer</label>
                  <input value={targetCustomer} onChange={e=>setTargetCustomer(e.target.value)} className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white" placeholder="e.g., ecommerce founders" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Business Model</label>
                  <input value={businessModel} onChange={e=>setBusinessModel(e.target.value)} className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white" placeholder="e.g., SaaS subscription" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Stage</label>
                    <input value={stage} onChange={e=>setStage(e.target.value)} className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white" placeholder="e.g., pre-seed" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Website / Contact</label>
                    <input value={contact} onChange={e=>setContact(e.target.value)} className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white" placeholder="e.g., useclevr.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Team / Founder line (optional)</label>
                  <input value={team} onChange={e=>setTeam(e.target.value)} className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white" placeholder="e.g., Jane Doe (ex-Stripe), John Roe (ex-Shopify)" />
                </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Funding Ask (optional)</label>
                <input value={fundingAsk} onChange={e=>setFundingAsk(e.target.value)} className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white" placeholder="e.g., Raising $500k" />
              </div>

              <div className="pt-2">
                <Button onClick={handleGenerate} disabled={generating} className="bg-cyan-600 hover:bg-cyan-700 text-white w-full">
                  {generating ? (<><Sparkles className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : (<><Sparkles className="mr-2 h-4 w-4" />Generate Preview</>)}
                </Button>
                <p className="text-[11px] text-neutral-500 mt-2">Only validated KPIs will be included. No financials are invented.</p>
                <div className="mt-3">
                  <label className="block text-xs text-neutral-400 mb-1">Logo or Startup Image (optional)</label>
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="block w-full text-xs text-neutral-400" />
                </div>
                <div className="mt-3">
                  <Button onClick={exportPdf} className="w-full border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-white" variant="outline">
                    <Download className="mr-2 h-4 w-4" /> Download PDF
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: One-Pager Preview (document canvas) */}
            <div className="p-6 bg-neutral-950/40 overflow-y-auto">
                <div className="mx-auto w-full max-w-[980px] min-w-[820px] space-y-4">
                {/* Branded Header/Hero */}
                <div className="relative rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-neutral-800/80 p-6 overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.12),transparent_40%),radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.10),transparent_40%)]" />
                  <div className="relative z-10 flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div className="text-[11px] tracking-wider text-purple-300 uppercase mb-1">Business One-Pager</div>
                      <h3 className="text-3xl md:text-4xl font-extrabold text-white leading-tight truncate max-w-[46rem] md:max-w-[56rem]">
                        {company || datasetName}
                      </h3>
                      {elevatorPitch && (
                        <p className="mt-3 text-[15px] md:text-base text-neutral-300 max-w-[70ch] leading-relaxed">{elevatorPitch}</p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="rounded-xl bg-neutral-800/70 border border-neutral-700 p-2 shadow-[0_0_24px_rgba(167,139,250,0.15)]">
                        {logoDataUrl ? (
                          <img src={logoDataUrl} alt="logo" className="h-16 w-16 md:h-20 md:w-20 object-contain" />
                        ) : (
                          <div className="h-16 w-16 md:h-20 md:w-20 flex items-center justify-center text-neutral-500 text-xs">Logo</div>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
                {/* Editorial two-column composition: wide narrative | analysis */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left narrative (wider by content) */}
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-3">
                      <Section title="Problem / Opportunity">{whatWeDo ? `Opportunity: ${whatWeDo}` : 'Add a short description of the customer pain or opportunity.'}</Section>
                      <Section title="Solution">{solutionText || 'Describe your product/service in one line.'}</Section>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Section title="Target Market / Clientele">{targetMarketText || 'Who are your customers?'}</Section>
                      <Section title="Business Model">{businessModelText || 'e.g., SaaS, usage-based, marketplace'}</Section>
                      <Section title="Stage">{stageText || 'Add your current stage'}</Section>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Section title="Team">{team || 'Add founders / key team members (optional)'}</Section>
                      <Section title="Contact">{contact || 'Add website or contact email'}</Section>
                    </div>
                    {fundingAsk && (<Section title="Funding Ask">{fundingAsk}</Section>)}
                    <Section title="Differentiation / USP">{"What makes you different? (brief bullet/line)"}</Section>
                  </div>

                  {/* Right analysis (metrics) */}
                  <div className="space-y-4">
                    {(revenueAvailable || costAvailable || profitAvailable) && (
                      <Card className="bg-gradient-to-br from-neutral-900 to-neutral-900/70 border border-neutral-800 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm tracking-wide text-white">Executive Metrics Snapshot</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2 pb-3">
                          <div className="grid grid-cols-2 gap-4">
                            {revenueAvailable && typeof kpis?.totalRevenue === 'number' && (
                              <div className="rounded-xl bg-neutral-800/60 border border-cyan-500/30 p-4 shadow-[0_0_18px_rgba(34,211,238,0.10)]">
                                <div className="text-[10px] text-cyan-300/90 uppercase tracking-wider">Revenue</div>
                                <div className="text-2xl font-bold text-neutral-100 mt-0.5">{formatCurrency(kpis.totalRevenue)}</div>
                              </div>
                            )}
                            {costAvailable && typeof kpis?.totalCost === 'number' && (
                              <div className="rounded-xl bg-neutral-800/60 border border-purple-500/30 p-4 shadow-[0_0_18px_rgba(167,139,250,0.10)]">
                                <div className="text-[10px] text-purple-300/90 uppercase tracking-wider">Expenses</div>
                                <div className="text-2xl font-bold text-neutral-100 mt-0.5">{formatCurrency(kpis.totalCost)}</div>
                              </div>
                            )}
                            {profitAvailable && typeof kpis?.totalProfit === 'number' && (
                              <div className="rounded-xl bg-neutral-800/60 border border-emerald-500/30 p-4 shadow-[0_0_18px_rgba(16,185,129,0.10)]">
                                <div className="text-[10px] text-emerald-300/90 uppercase tracking-wider">Net Profit</div>
                                <div className="text-2xl font-bold text-neutral-100 mt-0.5">{formatCurrency(kpis.totalProfit)}</div>
                              </div>
                            )}
                            {profitAvailable && typeof kpis?.profitMargin === 'number' && (
                              <div className="rounded-xl bg-neutral-800/60 border border-blue-500/30 p-4 shadow-[0_0_18px_rgba(59,130,246,0.10)]">
                                <div className="text-[10px] text-blue-300/90 uppercase tracking-wider">Margin</div>
                                <div className="text-2xl font-bold text-neutral-100 mt-0.5">{kpis.profitMargin.toFixed(1)}%</div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Removed duplicate small Revenue by Region chart to avoid competing visuals */}

                    {(revenueAvailable || profitAvailable) && (
                      <Section title="Traction / Highlights">
                        {revenueAvailable && typeof kpis?.totalRevenue === 'number' ? `Revenue to date: ${formatCurrency(kpis.totalRevenue)}` : ''}
                        {profitAvailable && typeof kpis?.profitMargin === 'number' ? `\nMargin: ${kpis.profitMargin.toFixed(1)}%` : ''}
                      </Section>
                    )}
                  </div>
                </div>

                {/* Full-width analysis visual for clarity */}
                {regionChartData.length > 0 && (
                  <Card className="bg-neutral-900/60 border border-neutral-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[13px] tracking-wide text-white">Revenue by Region (Top 5)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="h-64">
                        <InsightChart data={regionChartData} chartType="bar" height={240} compact />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-neutral-900/60 border border-neutral-800">
                  <CardContent className="py-3 text-[12px] text-neutral-400 flex items-center justify-between">
                    <span>{company || datasetName}</span>
                    <span>{contact || 'add contact'}</span>
                  </CardContent>
                </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
