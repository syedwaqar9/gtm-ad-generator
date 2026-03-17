import React, { useState } from 'react'
import { callClaude } from '../../api/claude'
import { callPerplexity } from '../../api/perplexity'
import SkeletonLoader from '../SkeletonLoader'
import OrbitalCTA from '../OrbitalCTA'
import CopyButton from '../CopyButton'

export default function CompetitiveIntelTab({ config, onMissingKey, onOutputGenerated }) {
  const [competitorName, setCompetitorName] = useState('')
  const [competitorWebsite, setCompetitorWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const vertical = config.vertical === 'Custom' ? config.customVertical : config.vertical

  const analyze = async () => {
    if (!config.anthropicKey) { onMissingKey(); return }
    if (!competitorName.trim()) {
      setError('Please enter a competitor name.')
      return
    }
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
      let search1 = ''
      let search2 = ''
      let search3 = ''

      if (config.perplexityKey) {
        setLoadingStep('Researching competitor features, reviews, and weaknesses...')
        try {
          const [r1, r2, r3] = await Promise.all([
            callPerplexity({
              apiKey: config.perplexityKey,
              query: `${competitorName} features pricing reviews`,
            }),
            callPerplexity({
              apiKey: config.perplexityKey,
              query: `${competitorName} vs alternatives complaints switching`,
            }),
            callPerplexity({
              apiKey: config.perplexityKey,
              query: `${competitorName} ${vertical} problems limitations`,
            }),
          ])
          search1 = r1 || ''
          search2 = r2 || ''
          search3 = r3 || ''
        } catch {
          search1 = ''
          search2 = ''
          search3 = ''
        }
      }

      setLoadingStep('Building your competitive intel brief...')
      const data = await callClaude({
        apiKey: config.anthropicKey,
        systemPrompt: `You are a competitive intelligence analyst helping a sales rep sell to small businesses. You give honest, specific, and immediately usable competitive analysis — not fluff.`,
        userPrompt: `You are a competitive intelligence analyst helping a sales rep sell ${productContext} to ${vertical} businesses. The rep's prospect is currently using or evaluating ${competitorName}${competitorWebsite ? ` (${competitorWebsite})` : ''}.

${search1 ? `Research 1 — Features, Pricing & Reviews:\n${search1}\n` : ''}
${search2 ? `Research 2 — Alternatives, Complaints & Switching:\n${search2}\n` : ''}
${search3 ? `Research 3 — ${vertical} Problems & Limitations:\n${search3}\n` : ''}

Based on the research above, generate a Competitive Intelligence Brief with exactly these sections as JSON fields:

1. competitor_overview: Object with:
   - what_they_do: 2 sentences max on what ${competitorName} does
   - pricing_model: their pricing model if found in research, or null
   - target_customer: who they primarily serve

2. where_strong: Array of 3 things customers genuinely like about ${competitorName}. Be honest — reps lose credibility if they trash a product the prospect already likes.

3. where_weak: Array of 3 objects with:
   - complaint: the specific limitation or complaint
   - source: where this was found (e.g., "G2 reviews mention...", "Reddit users complain about...")

4. how_you_win: Array of 3 objects with:
   - talking_point: a complete sentence a rep could say on a call
   - competitor_weakness: the specific ${competitorName} weakness being addressed
   - your_strength: the specific capability of the seller's product that wins here

5. already_using_scripts: Array of 3 objects with:
   - approach: one of "acknowledge_and_bridge", "curiosity_question", "social_proof"
   - script: the full response script written in natural, conversational language for a ${vertical} owner

6. elevator_pitch: A 30-second pitch positioning the seller's product against ${competitorName}, focused on the single most important differentiator for ${vertical} businesses. Written in the language ${vertical} owners actually use. No SaaS jargon.

Return ONLY valid JSON:
{
  "competitor_overview": {
    "what_they_do": "...",
    "pricing_model": "..." or null,
    "target_customer": "..."
  },
  "where_strong": ["...", "...", "..."],
  "where_weak": [
    {"complaint": "...", "source": "..."},
    {"complaint": "...", "source": "..."},
    {"complaint": "...", "source": "..."}
  ],
  "how_you_win": [
    {"talking_point": "...", "competitor_weakness": "...", "your_strength": "..."},
    {"talking_point": "...", "competitor_weakness": "...", "your_strength": "..."},
    {"talking_point": "...", "competitor_weakness": "...", "your_strength": "..."}
  ],
  "already_using_scripts": [
    {"approach": "acknowledge_and_bridge", "script": "..."},
    {"approach": "curiosity_question", "script": "..."},
    {"approach": "social_proof", "script": "..."}
  ],
  "elevator_pitch": "..."
}`,
        maxTokens: 2500,
      })

      const parsed = typeof data === 'object' ? data : {}
      setResults(parsed)
      if (onOutputGenerated) onOutputGenerated(buildFullText(parsed, competitorName, vertical))
    } catch (e) {
      setError(e.message || 'Something went wrong. Please check your API key and try again.')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const buildFullText = (r, name, vert) => {
    if (!r) return ''
    const comp = name || competitorName
    const v = vert || vertical
    return [
      `COMPETITIVE INTEL BRIEF — ${comp.toUpperCase()} vs YOUR PRODUCT`,
      `Vertical: ${v}`,
      r.competitor_overview ? `\nCOMPETITOR OVERVIEW:\n${r.competitor_overview.what_they_do}${r.competitor_overview.pricing_model ? `\nPricing: ${r.competitor_overview.pricing_model}` : ''}\nTarget customer: ${r.competitor_overview.target_customer}` : '',
      r.where_strong?.length ? `\nWHERE THEY'RE STRONG:\n${r.where_strong.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '',
      r.where_weak?.length ? `\nWHERE THEY'RE WEAK:\n${r.where_weak.map((w, i) => `${i + 1}. ${w.complaint} (${w.source})`).join('\n')}` : '',
      r.how_you_win?.length ? `\nHOW YOU WIN:\n${r.how_you_win.map((h, i) => `${i + 1}. ${h.talking_point}`).join('\n')}` : '',
      r.already_using_scripts?.length ? `\nWHEN THEY SAY "WE ALREADY USE ${comp.toUpperCase()}":\n${r.already_using_scripts.map((s, i) => `${i + 1}. [${s.approach.replace(/_/g, ' ').toUpperCase()}]\n"${s.script}"`).join('\n\n')}` : '',
      r.elevator_pitch ? `\n30-SECOND ELEVATOR PITCH:\n"${r.elevator_pitch}"` : '',
    ].filter(Boolean).join('\n')
  }

  const approachLabels = {
    acknowledge_and_bridge: { label: 'Acknowledge & Bridge', color: '#3B8AE0' },
    curiosity_question: { label: 'Curiosity Question', color: 'var(--warning)' },
    social_proof: { label: 'Social Proof', color: 'var(--success)' },
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Competitor Details</h3>
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="field-group">
            <label className="label">Competitor Name <span style={{ color: 'var(--error)', fontSize: 12 }}>*</span></label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g., Dentrix, Toast, Mindbody"
              value={competitorName}
              onChange={e => setCompetitorName(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="label">Competitor Website <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g., https://dentrix.com"
              value={competitorWebsite}
              onChange={e => setCompetitorWebsite(e.target.value)}
            />
          </div>
        </div>

        {!config.perplexityKey && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(229,169,27,0.1)', border: '1px solid rgba(229,169,27,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--warning)' }}>
            💡 Add your Perplexity API key above to unlock real competitor research from reviews, Reddit, and the web
          </div>
        )}

        <button className="btn btn-primary" onClick={analyze} disabled={loading}>
          {loading ? loadingStep || 'Analyzing...' : '🔎 Analyze Competitor'}
        </button>
      </div>

      {error && <div className="error-card" style={{ marginBottom: 24 }}>⚠️ {error}</div>}

      {loading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <SkeletonLoader label={loadingStep || 'Analyzing competitor...'} />
        </div>
      )}

      {results && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18 }}>🔎 {competitorName} — Competitive Intel</h3>
            <CopyButton text={buildFullText(results)} label="Copy Full Intel Brief" />
          </div>

          {/* Competitor Overview */}
          {results.competitor_overview && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🏢</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Competitor Overview</span>
              </div>
              <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: results.competitor_overview.pricing_model || results.competitor_overview.target_customer ? 12 : 0 }}>
                {results.competitor_overview.what_they_do}
              </p>
              {(results.competitor_overview.pricing_model || results.competitor_overview.target_customer) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
                  {results.competitor_overview.pricing_model && (
                    <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pricing: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{results.competitor_overview.pricing_model}</span>
                    </div>
                  )}
                  {results.competitor_overview.target_customer && (
                    <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Target: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{results.competitor_overview.target_customer}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Where Strong + Where Weak side by side */}
          <div className="grid-2" style={{ marginBottom: 0 }}>
            {results.where_strong?.length > 0 && (
              <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--success)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Where They're Strong</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(69,179,107,0.15)', color: 'var(--success)',
                    border: '1px solid rgba(69,179,107,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>Be Honest</span>
                </div>
                <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {results.where_strong.map((s, i) => (
                    <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {results.where_weak?.length > 0 && (
              <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--warning)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Where They're Weak</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(229,169,27,0.15)', color: 'var(--warning)',
                    border: '1px solid rgba(229,169,27,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>Ammunition</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {results.where_weak.map((w, i) => (
                    <div key={i} style={{ padding: '10px 14px', background: 'rgba(229,169,27,0.06)', borderRadius: 8 }}>
                      <div style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 4 }}>{w.complaint}</div>
                      <div style={{ fontSize: 12, color: 'var(--warning)', fontStyle: 'italic' }}>{w.source}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* How You Win */}
          {results.how_you_win?.length > 0 && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 18 }}>🏆</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>How You Win</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(15,110,86,0.15)', color: 'var(--accent)',
                  border: '1px solid rgba(15,110,86,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>Say This</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {results.how_you_win.map((h, i) => (
                  <div key={i} style={{ padding: '14px 16px', background: 'rgba(15,110,86,0.06)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
                      "{h.talking_point}"
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(229,83,75,0.1)', color: 'var(--error)', border: '1px solid rgba(229,83,75,0.2)' }}>
                        Their gap: {h.competitor_weakness}
                      </span>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(15,110,86,0.1)', color: 'var(--accent)', border: '1px solid rgba(15,110,86,0.2)' }}>
                        Your edge: {h.your_strength}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Already Using Scripts */}
          {results.already_using_scripts?.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 18 }}>💬</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>When They Say "We Already Use {competitorName}"</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {results.already_using_scripts.map((s, i) => {
                  const meta = approachLabels[s.approach] || { label: s.approach, color: 'var(--text-secondary)' }
                  return (
                    <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, borderLeft: `3px solid ${meta.color}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: meta.color, marginBottom: 8 }}>
                        {meta.label}
                      </div>
                      <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic' }}>
                        "{s.script}"
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <CopyButton text={s.script} label="Copy" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Elevator Pitch */}
          {results.elevator_pitch && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>30-Second Pitch vs {competitorName}</span>
                </div>
                <CopyButton text={results.elevator_pitch} />
              </div>
              <div style={{ borderLeft: '3px solid var(--accent)', padding: '14px 18px', background: 'rgba(15,110,86,0.05)', borderRadius: '0 8px 8px 0' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.8, fontStyle: 'italic' }}>
                  "{results.elevator_pitch}"
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <button className="btn btn-secondary" onClick={analyze}>↺ Regenerate</button>
          </div>

          <OrbitalCTA vertical={vertical} />
        </>
      )}
    </div>
  )
}
