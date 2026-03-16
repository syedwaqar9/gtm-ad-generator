import React, { useState } from 'react'
import { callClaude } from '../../api/claude'
import SkeletonLoader from '../SkeletonLoader'
import OrbitalCTA from '../OrbitalCTA'
import CopyButton from '../CopyButton'

export default function BattlecardTab({ config, onMissingKey, onBattlecardGenerated }) {
  const [competitors, setCompetitors] = useState('')
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
        systemPrompt: `You are a sales enablement leader who has built sales playbooks for teams selling software to every type of small business. You know the nuances between selling to a dentist vs a plumber vs a gym owner. Your battlecards are practical, specific, and immediately usable by an SDR on their first day.`,
        userPrompt: `Generate a complete sales battlecard for:
- My product: ${productContext}
- Target vertical: ${vertical}
- Known competitors: ${competitors || 'identify likely competitors based on the vertical'}

Include:
1. vertical_overview: 2-3 sentences on the ${vertical} industry, current market dynamics, and digital adoption trends.
2. pain_points: Array of 5 specific operational pain points (not generic business problems) that ${vertical} businesses face that your product solves.
3. why_they_buy: Array of 3 triggers that push a ${vertical} owner to finally invest in software.
4. discovery_questions: Array of 5 questions that uncover real needs, specific to ${vertical} operations.
5. competitive_landscape: A paragraph about what tools they're probably using now (including pen-and-paper, spreadsheets, and specific software competitors). How to position against each.
6. thirty_second_pitch: The 30-second pitch written entirely in ${vertical} language. No jargon.
7. objections: Array of 5 objects with the exact words a ${vertical} owner uses and a natural response. Format: [{objection: "...", response: "..."}]

Return as JSON: {
  "vertical_overview": "...",
  "pain_points": ["...", "..."],
  "why_they_buy": ["...", "..."],
  "discovery_questions": ["...", "..."],
  "competitive_landscape": "...",
  "thirty_second_pitch": "...",
  "objections": [{"objection": "...", "response": "..."}, ...]
}`,
        maxTokens: 2500,
      })
      setResults(typeof data === 'object' ? data : {})
      if (onBattlecardGenerated) onBattlecardGenerated(data)
    } catch (e) {
      setError(e.message || 'Something went wrong. Please check your API key and try again.')
    } finally {
      setLoading(false)
    }
  }

  const buildFullText = () => {
    if (!results) return ''
    return [
      `SALES BATTLECARD — ${vertical?.toUpperCase()}`,
      results.vertical_overview ? `\nVERTICAL OVERVIEW:\n${results.vertical_overview}` : '',
      results.pain_points?.length ? `\nTOP PAIN POINTS:\n${results.pain_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : '',
      results.why_they_buy?.length ? `\nWHY THEY BUY:\n${results.why_they_buy.map((w, i) => `${i + 1}. ${w}`).join('\n')}` : '',
      results.discovery_questions?.length ? `\nDISCOVERY QUESTIONS:\n${results.discovery_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : '',
      results.competitive_landscape ? `\nCOMPETITIVE LANDSCAPE:\n${results.competitive_landscape}` : '',
      results.thirty_second_pitch ? `\nTHE 30-SECOND PITCH:\n${results.thirty_second_pitch}` : '',
      results.objections?.length ? `\nTOP OBJECTIONS + RESPONSES:\n${results.objections.map((o, i) => `${i + 1}. OBJECTION: "${o.objection}"\n   RESPONSE: ${o.response}`).join('\n\n')}` : '',
    ].filter(Boolean).join('\n')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Battlecard Parameters</h3>
        <div className="field-group" style={{ marginBottom: 20 }}>
          <label className="label">Known competitors in this vertical <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
          <input
            className="input-field"
            type="text"
            placeholder="e.g., ServiceTitan, Housecall Pro"
            value={competitors}
            onChange={e => setCompetitors(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : '⚔️ Generate Battlecard'}
        </button>
      </div>

      {error && <div className="error-card" style={{ marginBottom: 24 }}>⚠️ {error}</div>}

      {loading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <SkeletonLoader label="Building your sales battlecard..." />
        </div>
      )}

      {results && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18 }}>⚔️ {vertical} Sales Battlecard</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <CopyButton text={buildFullText()} label="Copy Full Battlecard" />
              <button className="btn btn-secondary no-print" onClick={handlePrint}>🖨️ Print / Save PDF</button>
            </div>
          </div>

          {/* Row 1: Vertical Overview (full width) */}
          {results.vertical_overview && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>🏭</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Vertical Overview</span>
              </div>
              <p style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>{results.vertical_overview}</p>
            </div>
          )}

          {/* Row 2: Pain Points + Why They Buy */}
          <div className="grid-2" style={{ marginBottom: 0 }}>
            {results.pain_points?.length > 0 && (
              <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--error)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>🔴</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Top Pain Points</span>
                </div>
                <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {results.pain_points.map((p, i) => (
                    <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {results.why_they_buy?.length > 0 && (
              <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--success)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Why They Buy</span>
                </div>
                <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {results.why_they_buy.map((w, i) => (
                    <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Row 3: Discovery Questions + Competitive Landscape */}
          <div className="grid-2" style={{ marginBottom: 0 }}>
            {results.discovery_questions?.length > 0 && (
              <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>🔍</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Discovery Questions</span>
                </div>
                <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {results.discovery_questions.map((q, i) => (
                    <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
            {results.competitive_landscape && (
              <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--warning)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>⚔️</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Competitive Landscape</span>
                </div>
                <p style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>{results.competitive_landscape}</p>
              </div>
            )}
          </div>

          {/* Row 4: 30-Second Pitch (full width) */}
          {results.thirty_second_pitch && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>The 30-Second Pitch</span>
                </div>
                <CopyButton text={results.thirty_second_pitch} />
              </div>
              <div style={{ borderLeft: '3px solid var(--success)', padding: '14px 18px', background: 'rgba(69,179,107,0.05)', borderRadius: '0 8px 8px 0' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.8, fontStyle: 'italic' }}>{results.thirty_second_pitch}</p>
              </div>
            </div>
          )}

          {/* Row 5: Objections (full width) */}
          {results.objections?.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 18 }}>🛡️</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Top Objections + Responses</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {results.objections.map((obj, i) => (
                  <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, borderLeft: '3px solid var(--warning)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--warning)', fontSize: 13, marginBottom: 8 }}>"{obj.objection}"</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.7 }}>{obj.response}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <CopyButton text={buildFullText()} label="Copy Full Battlecard" />
            <button className="btn btn-secondary no-print" onClick={handlePrint}>🖨️ Download as PDF</button>
            <button className="btn btn-secondary no-print" onClick={generate}>↺ Regenerate</button>
          </div>

          <OrbitalCTA vertical={vertical} />
        </>
      )}
    </div>
  )
}
