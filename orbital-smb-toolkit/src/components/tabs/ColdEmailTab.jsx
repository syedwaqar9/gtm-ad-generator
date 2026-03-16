import React, { useState } from 'react'
import { callClaude } from '../../api/claude'
import SkeletonLoader from '../SkeletonLoader'
import OrbitalCTA from '../OrbitalCTA'
import CopyButton from '../CopyButton'

const EMAIL_TYPES = [
  'First touch cold email',
  'Follow-up #1 (no reply)',
  'Follow-up #2 (still no reply)',
  'Breakup email (final attempt)',
  'Re-engagement (after weeks of silence)',
]

const EMAIL_ANGLES = [
  'Pain-point focused',
  'ROI/savings focused',
  'Social proof focused',
  'Curiosity/question focused',
  'Direct ask',
]

const VARIATION_LABELS = [
  'Pain-Point Focused',
  'Value-Driven',
  'Curiosity-Based',
]

export default function ColdEmailTab({ config, onMissingKey }) {
  const [emailType, setEmailType] = useState(EMAIL_TYPES[0])
  const [emailAngle, setEmailAngle] = useState(EMAIL_ANGLES[0])
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const vertical = config.vertical === 'Custom' ? config.customVertical : config.vertical

  const generate = async () => {
    if (!config.anthropicKey) { onMissingKey(); return }
    if (!vertical || (!config.productDescription && !config.companyContext)) {
      setError('Please fill in your vertical and product description (or company website) in the setup section above.')
      return
    }
    setError('')
    setLoading(true)
    setResults(null)
    const productContext = config.companyContext
      ? `Company intelligence (from website research):\n${config.companyContext}`
      : config.productDescription
    try {
      const data = await callClaude({
        apiKey: config.anthropicKey,
        systemPrompt: `You are an expert SDR who has spent 10 years selling software to small businesses. You write cold emails that sound human, specific, and genuinely helpful. You never sound like a robot or a marketing template. You understand that small business owners are busy, skeptical of sales emails, and get spammed constantly. Your emails are short (under 100 words), specific to the vertical, and always lead with their world, not yours.`,
        userPrompt: `Write 3 cold email variations for this context:
- My product: ${productContext}
- Target vertical: ${vertical}
- Email type: ${emailType}
- Angle: ${emailAngle}
- Additional context: ${detail || 'None'}

For each variation, provide:
1. A subject line (under 8 words, no clickbait)
2. Email body (under 100 words, conversational, no jargon)
3. A one-line note explaining the psychology behind this variation

Use language that a ${vertical} business owner would actually use. Reference their real daily problems. Never use words like "synergy", "leverage", "streamline", or "solution". Write like a helpful human, not a sales robot.

Return as JSON array: [{"subject": "...", "body": "...", "psychology_note": "..."}, ...]`,
        maxTokens: 1800,
      })
      setResults(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Something went wrong. Please check your API key and try again.')
    } finally {
      setLoading(false)
    }
  }

  const allText = results
    ? results.map((r, i) => `VARIATION ${i + 1}\nSubject: ${r.subject}\n\n${r.body}\n\nPsychology: ${r.psychology_note}`).join('\n\n---\n\n')
    : ''

  return (
    <div>
      {/* Input Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Email Parameters</h3>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="field-group">
            <label className="label">Email Type</label>
            <select className="input-field" value={emailType} onChange={e => setEmailType(e.target.value)}>
              {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label">Email Angle</label>
            <select className="input-field" value={emailAngle} onChange={e => setEmailAngle(e.target.value)}>
              {EMAIL_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="field-group" style={{ marginBottom: 20 }}>
          <label className="label">Any specific detail to mention? <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
          <input
            className="input-field"
            type="text"
            placeholder="e.g., I noticed they have 3 locations and 4.2 stars on Google"
            value={detail}
            onChange={e => setDetail(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : '✉️ Generate 3 Email Variations'}
        </button>
      </div>

      {/* Error */}
      {error && <div className="error-card" style={{ marginBottom: 24 }}>⚠️ {error}</div>}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <SkeletonLoader label="Generating your email variations..." />
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <>
          {results.map((variation, i) => (
            <div key={i} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                  Variation {i + 1} — {VARIATION_LABELS[i] || emailAngle}
                </span>
                <CopyButton text={`Subject: ${variation.subject}\n\n${variation.body}`} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <span className="label">Subject Line</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{variation.subject}</div>
              </div>

              <div style={{
                borderLeft: '3px solid var(--accent)',
                paddingLeft: 16,
                marginBottom: 12,
                backgroundColor: 'rgba(94,106,210,0.05)',
                borderRadius: '0 8px 8px 0',
                padding: '12px 16px',
              }}>
                <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{variation.body}</p>
              </div>

              {variation.psychology_note && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🧠</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{variation.psychology_note}</span>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <CopyButton text={allText} label="Copy All Variations" />
            <button className="btn btn-secondary" onClick={generate}>↺ Regenerate</button>
          </div>

          <OrbitalCTA vertical={vertical} />
        </>
      )}
    </div>
  )
}
