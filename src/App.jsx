import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import AdCanvas from './components/AdCanvas'
import {
  fetchPageContent,
  extractBrandIdentity,
  extractColorsWithClaude,
  generateAdsWithClaude,
  loadGoogleFont,
  DEFAULT_COLORS,
} from './lib/brandExtractor'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_HEADLINE = 'Ship faster than\never before.'
const DEFAULT_PARAGRAPH =
  'The modern workflow for engineering teams. Plan, build, and track work without the overhead — so your team can focus on what matters.'
const DEFAULT_CTA   = 'Start for free'
const DEFAULT_BRAND = { name: 'YourBrand', logoSrc: null, fontFamily: null, description: '' }

const ENV_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || ''
const LS_KEY      = 'anthropic_api_key'

const COLOR_FIELDS = [
  { key: 'background',    label: 'Background' },
  { key: 'headline',      label: 'Headline'   },
  { key: 'paragraph',     label: 'Paragraph'  },
  { key: 'ctaBackground', label: 'CTA'        },
  { key: 'ctaText',       label: 'CTA Text'   },
  { key: 'accent',        label: 'Accent'     },
]

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++ } else inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else current += ch
  }
  result.push(current.trim()); return result
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase())
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line)
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] ?? '' }), {})
  })
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function slugify(t) { return (t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) }
function pad(n) { return String(n).padStart(3, '0') }
function getApiKey() { return ENV_API_KEY || localStorage.getItem(LS_KEY) || '' }

async function captureCanvas(el) {
  await document.fonts.ready
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  return html2canvas(el, {
    scale: 1, useCORS: true, allowTaint: true,
    backgroundColor: null, width: 1080, height: 1080, logging: false,
  })
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, multiline, placeholder }) {
  const s = {
    value, onChange: e => onChange(e.target.value), placeholder,
    style: {
      width: '100%', background: '#111113', border: '1px solid #1E1E24',
      borderRadius: 8, color: '#FFF', fontSize: 14, fontFamily: 'Inter, sans-serif',
      padding: '10px 12px', outline: 'none', resize: 'vertical',
      transition: 'border-color 0.15s', lineHeight: 1.5,
    },
    onFocus: e => (e.target.style.borderColor = '#5E6AD2'),
    onBlur:  e => (e.target.style.borderColor = '#1E1E24'),
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ color: '#8A8F98', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</label>}
      {multiline ? <textarea {...s} rows={4} /> : <input {...s} type="text" />}
    </div>
  )
}

function SectionLabel({ children }) {
  return <p style={{ color: '#3D4148', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14 }}>{children}</p>
}

function Divider() { return <div style={{ borderTop: '1px solid #1A1A1F' }} /> }

function Btn({ children, onClick, disabled, primary, danger, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: small ? '9px 12px' : '11px 12px',
      background: disabled ? '#151520' : danger ? 'rgba(220,60,60,0.12)' : primary ? '#5E6AD2' : 'transparent',
      border: primary ? 'none' : danger ? '1px solid rgba(220,60,60,0.3)' : '1px solid #1E1E24',
      borderRadius: 8, color: disabled ? '#3D4148' : danger ? '#e05252' : primary ? '#fff' : '#8A8F98',
      fontSize: small ? 13 : 14, fontWeight: primary ? 600 : 500, fontFamily: 'Inter, sans-serif',
      cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: '-0.1px',
      transition: 'background 0.15s', textAlign: 'center',
    }}>{children}</button>
  )
}

function Spinner() {
  return (
    <div style={{ width: 13, height: 13, flexShrink: 0, borderRadius: '50%', border: '2px solid #1E1E24', borderTopColor: '#5E6AD2', animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Color editor ──────────────────────────────────────────────────────────────

function ColorEditor({ colors, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>Colors</SectionLabel>
        <button onClick={() => onChange(DEFAULT_COLORS)}
          style={{ background: 'none', border: 'none', color: '#3D4148', cursor: 'pointer', fontSize: 12, marginBottom: 14 }}>
          Reset
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {COLOR_FIELDS.map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', position: 'relative' }}>
            <div style={{
              width: '100%', height: 32, borderRadius: 7,
              background: colors[key],
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
            }} />
            <input type="color" value={colors[key]}
              onChange={e => onChange({ ...colors, [key]: e.target.value })}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
            <span style={{ color: '#3D4148', fontSize: 10, fontWeight: 500, textAlign: 'center' }}>{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Brand badge ───────────────────────────────────────────────────────────────

function BrandBadge({ brand, colors }) {
  return (
    <div style={{ background: '#0D0D0F', border: '1px solid #1E1E24', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      {brand.logoSrc ? (
        <img src={brand.logoSrc} alt={brand.name} style={{ height: 28, width: 'auto', maxWidth: 80, objectFit: 'contain', borderRadius: 4 }} />
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg, ${colors.accent}, #8B5CF6)`, flexShrink: 0 }} />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ color: '#D0D3DA', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brand.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: colors.accent, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
          <span style={{ color: '#3D4148', fontSize: 11, fontFamily: 'monospace' }}>{colors.accent}</span>
          {!colors.isDark && <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 600, letterSpacing: '0.3px' }}>LIGHT</span>}
          {colors.isDark  && <span style={{ color: '#6366f1', fontSize: 10, fontWeight: 600, letterSpacing: '0.3px' }}>DARK</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 4px rgba(34,197,94,0.6)' }} />
        <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 500 }}>Detected</span>
      </div>
    </div>
  )
}

// ── Settings modal ────────────────────────────────────────────────────────────

function SettingsModal({ onClose }) {
  const [value, setValue] = useState(localStorage.getItem(LS_KEY) || '')
  const save = () => { value.trim() ? localStorage.setItem(LS_KEY, value.trim()) : localStorage.removeItem(LS_KEY); onClose() }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111113', border: '1px solid #1E1E24', borderRadius: 12, padding: 28, width: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>API Key Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8A8F98', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: '#8A8F98', fontSize: 13, lineHeight: 1.6 }}>
          Paste your Anthropic API key. Saved to localStorage.{' '}
          <code style={{ color: '#5E6AD2' }}>VITE_ANTHROPIC_API_KEY</code> in <code style={{ color: '#5E6AD2' }}>.env</code> takes priority.
        </p>
        {ENV_API_KEY && (
          <div style={{ background: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.2)', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ color: '#5E6AD2', fontSize: 12, fontWeight: 500 }}>✓ Key loaded from .env</p>
          </div>
        )}
        <input type="password" value={value} onChange={e => setValue(e.target.value)} placeholder="sk-ant-api03-..."
          style={{ background: '#0A0A0B', border: '1px solid #1E1E24', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn primary onClick={save}>Save Key</Btn>
          <Btn danger onClick={() => { localStorage.removeItem(LS_KEY); setValue(''); onClose() }}>Clear</Btn>
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // Single ad
  const [headline, setHeadline] = useState(DEFAULT_HEADLINE)
  const [paragraph, setParagraph] = useState(DEFAULT_PARAGRAPH)
  const [cta, setCta] = useState(DEFAULT_CTA)
  const [exporting, setExporting] = useState(false)
  const adRef = useRef(null)

  // Brand
  const [brand, setBrand] = useState(DEFAULT_BRAND)
  const [colors, setColors] = useState(DEFAULT_COLORS)

  // Bulk
  const [csvRows, setCsvRows] = useState([])
  const [csvError, setCsvError] = useState('')
  const [bulkData, setBulkData] = useState({ headline: '', paragraph: '', cta: '' })
  const [progress, setProgress] = useState({ current: 0, total: 0, running: false })
  const hiddenRef    = useRef(null)
  const fileInputRef = useRef(null)

  // Generation
  const [genUrl, setGenUrl] = useState('')
  const [genCount, setGenCount] = useState(20)
  const [generating, setGenerating] = useState(false)
  const [genSteps, setGenSteps] = useState([])   // array of { text, done, error }
  const [genError, setGenError] = useState('')

  const [showSettings, setShowSettings] = useState(false)

  const hasBrand = brand !== DEFAULT_BRAND
  const hasRows  = csvRows.length > 0

  const pushStep = (text, done = false, error = false) =>
    setGenSteps(s => [...s, { text, done, error }])
  const resolveLastStep = (done = true, error = false) =>
    setGenSteps(s => s.map((step, i) => i === s.length - 1 ? { ...step, done, error } : step))

  // ── Single export ──────────────────────────────────────────────────────────

  const handleExportSingle = async () => {
    if (!adRef.current || exporting) return
    setExporting(true)
    try {
      const canvas = await captureCanvas(adRef.current)
      const link = document.createElement('a')
      link.download = `${slugify(headline) || 'ad'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally { setExporting(false) }
  }

  // ── CSV upload ─────────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setCsvError('')
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result)
      if (!rows.length) { setCsvError('No rows found.'); setCsvRows([]); return }
      const missing = ['headline', 'paragraph', 'cta'].filter(k => !(k in rows[0]))
      if (missing.length) { setCsvError(`Missing columns: ${missing.join(', ')}`); setCsvRows([]); return }
      setCsvRows(rows); setGenError('')
    }
    reader.readAsText(file); e.target.value = ''
  }

  // ── Bulk export ────────────────────────────────────────────────────────────

  const handleExportAll = async () => {
    if (!csvRows.length || progress.running) return
    const zip = new JSZip()
    setProgress({ current: 0, total: csvRows.length, running: true })
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i]
      flushSync(() => setBulkData({ headline: row.headline, paragraph: row.paragraph, cta: row.cta }))
      const canvas = await captureCanvas(hiddenRef.current)
      const blob   = await new Promise(r => canvas.toBlob(r, 'image/png'))
      zip.file(`${pad(i + 1)}-${slugify(row.headline) || 'ad'}.png`, blob)
      setProgress(p => ({ ...p, current: i + 1 }))
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url  = URL.createObjectURL(zipBlob)
    const link = document.createElement('a')
    link.href = url; link.download = 'ads-export.zip'; link.click()
    URL.revokeObjectURL(url)
    setProgress(p => ({ ...p, running: false }))
  }

  // ── AI generation (3 sequential steps with visible status) ─────────────────

  const handleGenerate = async () => {
    if (generating) return
    setGenError(''); setGenSteps([])
    const apiKey = getApiKey()
    if (!apiKey) { setGenError('No API key found. Click ⚙ to add one.'); return }
    if (!genUrl.trim()) { setGenError('Please enter a website URL.'); return }
    setGenerating(true)

    try {
      // Step 1: Fetch page
      pushStep('Fetching website content…')
      const { doc, text } = await fetchPageContent(genUrl.trim())
      resolveLastStep()

      // Step 2: Brand identity + color extraction (both need the page)
      pushStep('Extracting brand identity…')
      const identity = await extractBrandIdentity(doc, genUrl.trim())
      if (identity.fontFamily) loadGoogleFont(identity.fontFamily)
      setBrand({ name: identity.name, logoSrc: identity.logoSrc, fontFamily: identity.fontFamily, description: identity.description })
      resolveLastStep()

      // Step 3: Colors via Claude
      pushStep('Analyzing brand colors with Claude…')
      let detectedColors = DEFAULT_COLORS
      try {
        detectedColors = await extractColorsWithClaude(identity.metadata, identity.name, apiKey)
        setColors(detectedColors)
        resolveLastStep()
      } catch (colorErr) {
        resolveLastStep(true, true)
        pushStep(`Color detection failed (${colorErr.message}) — using defaults`, true, true)
        // Don't abort — continue with default colors
      }

      // Step 4: Ad copy
      pushStep(`Generating ${genCount} ads with Claude…`)
      const ads = await generateAdsWithClaude(text, genCount, apiKey, identity)
      setCsvRows(ads); setCsvError('')
      resolveLastStep()
      pushStep(`✓ ${ads.length} ads ready — review below, then export.`, true)
    } catch (err) {
      resolveLastStep(false, true)
      setGenError(err.message || 'Something went wrong.')
    } finally {
      setGenerating(false)
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0A0A0B' }}>

      {/* Off-screen canvas for bulk export */}
      <div style={{ position: 'fixed', left: -1200, top: 0, pointerEvents: 'none' }}>
        <AdCanvas ref={hiddenRef} headline={bulkData.headline} paragraph={bulkData.paragraph} cta={bulkData.cta}
          brandName={brand.name} logoSrc={brand.logoSrc} colors={colors} brandFont={brand.fontFamily} />
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #1A1A1F', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #5E6AD2 0%, #8B5CF6 100%)' }} />
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: '-0.2px' }}>Ad Generator</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#3D4148', fontSize: 13 }}>1080 × 1080 px · Facebook & Instagram</span>
          <button onClick={() => setShowSettings(true)} title="API Key Settings"
            style={{ background: 'none', border: '1px solid #1E1E24', borderRadius: 7, color: '#3D4148', cursor: 'pointer', padding: '5px 7px', display: 'flex', alignItems: 'center', transition: 'color 0.15s, border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#8A8F98'; e.currentTarget.style.borderColor = '#2E3138' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#3D4148'; e.currentTarget.style.borderColor = '#1E1E24' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{ width: 320, borderRight: '1px solid #1A1A1F', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>

          {/* ① Generate with AI */}
          <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel>Generate with AI</SectionLabel>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#5E6AD2', background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.2)', borderRadius: 100, padding: '2px 8px', marginBottom: 14 }}>Claude</span>
            </div>

            <Field label="Website URL" value={genUrl} onChange={setGenUrl} placeholder="https://example.com" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ color: '#8A8F98', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>How many</label>
              <input type="number" min={1} max={100} value={genCount}
                onChange={e => setGenCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                style={{ width: 70, background: '#111113', border: '1px solid #1E1E24', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: 'Inter, sans-serif', padding: '9px 10px', outline: 'none', textAlign: 'center' }} />
              <Btn primary onClick={handleGenerate} disabled={generating}>{generating ? 'Working…' : 'Generate'}</Btn>
            </div>

            {/* Step-by-step status log */}
            {genSteps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {genSteps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {step.error ? (
                      <span style={{ color: '#e05252', fontSize: 13, flexShrink: 0 }}>✕</span>
                    ) : step.done ? (
                      <span style={{ color: '#22c55e', fontSize: 13, flexShrink: 0 }}>✓</span>
                    ) : (
                      <Spinner />
                    )}
                    <span style={{ color: step.error ? '#e05252' : step.done ? '#8A8F98' : '#D0D3DA', fontSize: 12, lineHeight: 1.5 }}>
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {genError && <p style={{ color: '#e05252', fontSize: 12, lineHeight: 1.5 }}>{genError}</p>}
            {hasBrand && !generating && <BrandBadge brand={brand} colors={colors} />}
          </div>

          <Divider />

          {/* ② Color editor */}
          <div style={{ padding: '18px 20px' }}>
            <ColorEditor colors={colors} onChange={setColors} />
          </div>

          <Divider />

          {/* ③ Row preview + export */}
          {hasRows && (
            <>
              <div style={{ padding: '18px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <SectionLabel>{csvRows.length} ads ready</SectionLabel>
                  <button onClick={() => { setCsvRows([]); setGenSteps([]); setProgress({ current: 0, total: 0, running: false }) }}
                    style={{ background: 'none', border: 'none', color: '#3D4148', cursor: 'pointer', fontSize: 12, marginBottom: 14 }}>Clear</button>
                </div>
                <div style={{ border: '1px solid #1E1E24', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                  {csvRows.map((row, i) => (
                    <div key={i}
                      onClick={() => { setHeadline(row.headline); setParagraph(row.paragraph); setCta(row.cta) }}
                      style={{ padding: '10px 12px', borderBottom: i < csvRows.length - 1 ? '1px solid #1A1A1F' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#141418')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ color: '#3D4148', fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{pad(i + 1)}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: '#D0D3DA', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.headline || '—'}</p>
                        <p style={{ color: '#3D4148', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{row.cta || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ color: '#3D4148', fontSize: 11, marginTop: 6 }}>Click a row to preview it.</p>
              </div>
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Btn primary onClick={handleExportAll} disabled={progress.running}>
                  {progress.running ? `Exporting ${progress.current} / ${progress.total}…` : `Export All ${csvRows.length} PNGs`}
                </Btn>
                {progress.running && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 4, background: '#1A1A1F', borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #5E6AD2, #8B5CF6)', borderRadius: 100, transition: 'width 0.2s ease' }} />
                    </div>
                    <p style={{ color: '#3D4148', fontSize: 11, textAlign: 'right' }}>{pct}%</p>
                  </div>
                )}
                {!progress.running && progress.current > 0 && progress.current === progress.total && (
                  <p style={{ color: '#5E6AD2', fontSize: 12, fontWeight: 500 }}>✓ {progress.total} ads exported as ads-export.zip</p>
                )}
              </div>
              <Divider />
            </>
          )}

          {/* ④ CSV upload */}
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionLabel>Or upload CSV</SectionLabel>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
            <Btn onClick={() => fileInputRef.current?.click()} small>{hasRows ? 'Replace with CSV' : '↑ Upload CSV'}</Btn>
            {csvError && <p style={{ color: '#e05252', fontSize: 12, lineHeight: 1.5 }}>{csvError}</p>}
            {!hasRows && !csvError && <p style={{ color: '#3D4148', fontSize: 12, lineHeight: 1.6 }}>Columns: <code style={{ color: '#5E6AD2' }}>headline, paragraph, cta</code></p>}
          </div>

          <Divider />

          {/* ⑤ Single ad editor */}
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionLabel>Edit single ad</SectionLabel>
            <Field label="Headline" value={headline} onChange={setHeadline} multiline />
            <Field label="Paragraph" value={paragraph} onChange={setParagraph} multiline />
            <Field label="CTA Button" value={cta} onChange={setCta} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <Btn primary onClick={handleExportSingle} disabled={exporting}>{exporting ? 'Exporting…' : 'Export PNG'}</Btn>
              <Btn onClick={() => { setHeadline(DEFAULT_HEADLINE); setParagraph(DEFAULT_PARAGRAPH); setCta(DEFAULT_CTA) }}>Reset</Btn>
            </div>
          </div>
        </div>

        {/* ── Preview ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, background: '#070708' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 540, height: 540, overflow: 'hidden', borderRadius: 12, flexShrink: 0, boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.6)' }}>
              <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 1080, height: 1080 }}>
                <AdCanvas ref={adRef} headline={headline} paragraph={paragraph} cta={cta}
                  brandName={brand.name} logoSrc={brand.logoSrc} colors={colors} brandFont={brand.fontFamily} />
              </div>
            </div>
            <span style={{ color: '#2E3138', fontSize: 12 }}>Live preview — 50% scale</span>
          </div>
        </div>
      </div>
    </div>
  )
}
