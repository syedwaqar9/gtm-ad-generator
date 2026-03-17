import React, { useState } from 'react'
import { callClaude } from '../../api/claude'
import { callPerplexity } from '../../api/perplexity'
import SkeletonLoader from '../SkeletonLoader'
import OrbitalCTA from '../OrbitalCTA'
import CopyButton from '../CopyButton'

const approachLabels = {
  acknowledge_and_bridge: { label: 'Acknowledge & Bridge', color: '#3B8AE0' },
  curiosity_question: { label: 'Curiosity Question', color: 'var(--warning)' },
  social_proof: { label: 'Social Proof', color: 'var(--success)' },
}

async function analyzeOneCompetitor({ apiKey, perplexityKey, competitorName, vertical, productContext }) {
  let search1 = ''
  let search2 = ''
  let search3 = ''

  if (perplexityKey) {
    try {
      const [r1, r2, r3] = await Promise.all([
        callPerplexity({ apiKey: perplexityKey, query: `${competitorName} features pricing reviews` }),
        callPerplexity({ apiKey: perplexityKey, query: `${competitorName} vs alternatives complaints switching` }),
        callPerplexity({ apiKey: perplexityKey, query: `${competitorName} ${vertical} problems limitations` }),
      ])
      search1 = r1 || ''
      search2 = r2 || ''
      search3 = r3 || ''
    } catch { /* use empty strings */ }
  }

  const data = await callClaude({
    apiKey,
    systemPrompt: `You are a competitive intelligence analyst helping a sales rep sell to small businesses. You give honest, specific, and immediately usable competitive analysis — not fluff.`,
    userPrompt: `You are a competitive intelligence analyst helping a sales rep sell ${productContext} to ${vertical} businesses. The rep's prospect is currently using or evaluating ${competitorName}.

${search1 ? `Research 1 — Features, Pricing & Reviews:\n${search1}\n` : ''}
${search2 ? `Research 2 — Alternatives, Complaints & Switching:\n${search2}\n` : ''}
${search3 ? `Research 3 — ${vertical} Problems & Limitations:\n${search3}\n` : ''}

Generate a Competitive Intelligence Brief as JSON:
{
  "competitor_overview": {
    "what_they_do": "2 sentences max on what ${competitorName} does",
    "pricing_model": "their pricing model if found, or null",
    "target_customer": "who they primarily serve"
  },
  "where_strong": ["3 things customers genuinely like — be honest"],
  "where_weak": [
    {"complaint": "specific limitation", "source": "where found, e.g. G2 reviews mention..."},
    {"complaint": "...", "source": "..."},
    {"complaint": "...", "source": "..."}
  ],
  "how_you_win": [
    {"talking_point": "complete sentence a rep could say on a call", "competitor_weakness": "the gap being addressed", "your_strength": "your product capability that wins here"},
    {"talking_point": "...", "competitor_weakness": "...", "your_strength": "..."},
    {"talking_point": "...", "competitor_weakness": "...", "your_strength": "..."}
  ],
  "already_using_scripts": [
    {"approach": "acknowledge_and_bridge", "script": "full conversational response for a ${vertical} owner"},
    {"approach": "curiosity_question", "script": "..."},
    {"approach": "social_proof", "script": "..."}
  ],
  "elevator_pitch": "30-second pitch vs ${competitorName} focused on the #1 differentiator for ${vertical} businesses. No SaaS jargon."
}

Return ONLY valid JSON.`,
    maxTokens: 2000,
  })

  return typeof data === 'object' ? data : {}
}

export default function CompetitiveIntelTab({ config, onMissingKey, onOutputGenerated }) {
  const [specificCompetitor, setSpecificCompetitor] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [results, setResults] = useState(null) // Array<{name, brief}>
  const [error, setError] = useState('')

  const vertical = config.vertical === 'Custom' ? config.customVertical : config.vertical

  const analyze = async () => {
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
      let competitorNames = []

      if (specificCompetitor.trim()) {
        // Manual mode: analyze just this one
        competitorNames = [specificCompetitor.trim()]
      } else {
        // Auto-detect mode: find top 3 competitors
        setLoadingStep('Identifying top competitors in your space...')
        let landscapeResearch = ''
        if (config.perplexityKey) {
          try {
            landscapeResearch = await callPerplexity({
              apiKey: config.perplexityKey,
              query: `${config.productDescription || vertical} competitors alternatives ${vertical} software`,
            }) || ''
          } catch { /* fallback to Claude only */ }
        }

        setLoadingStep('Selecting top 3 competitors to analyze...')
        const detected = await callClaude({
          apiKey: config.anthropicKey,
          systemPrompt: 'You are a competitive intelligence analyst. Return only valid JSON.',
          userPrompt: `A sales rep sells this product to ${vertical} businesses:
${productContext}

${landscapeResearch ? `Web research on the competitive landscape:\n${landscapeResearch}\n` : ''}

Based on this, identify the top 3 most relevant direct competitors that ${vertical} businesses are most likely to use or consider instead of this product. Focus on software/tools used by ${vertical} owners specifically.

Return ONLY this JSON (no other text):
{"competitors": ["Competitor Name 1", "Competitor Name 2", "Competitor Name 3"]}`,
          maxTokens: 200,
        })

        if (detected?.competitors?.length) {
          competitorNames = detected.competitors.slice(0, 3)
        } else {
          throw new Error('Could not auto-detect competitors. Try entering a competitor name manually.')
        }
      }

      // Analyze all competitors (sequentially to avoid rate limits, with step updates)
      const allResults = []
      for (let i = 0; i < competitorNames.length; i++) {
        const name = competitorNames[i]
        setLoadingStep(`Analyzing ${name} (${i + 1} of ${competitorNames.length})...`)
        const brief = await analyzeOneCompetitor({
          apiKey: config.anthropicKey,
          perplexityKey: config.perplexityKey,
          competitorName: name,
          vertical,
          productContext,
        })
        allResults.push({ name, brief })
      }

      setResults(allResults)
      if (onOutputGenerated) onOutputGenerated(buildFullText(allResults, vertical))
    } catch (e) {
      setError(e.message || 'Something went wrong. Please check your API key and try again.')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const buildFullText = (allResults, vert) => {
    if (!allResults?.length) return ''
    const v = vert || vertical
    const sections = [`COMPETITIVE INTEL BRIEF — ${v?.toUpperCase()}\n`]
    allResults.forEach(({ name, brief: r }) => {
      sections.push(`\n${'='.repeat(50)}`)
      sections.push(`COMPETITOR: ${name.toUpperCase()}`)
      sections.push('='.repeat(50))
      if (r.competitor_overview) {
        sections.push(`\nOVERVIEW:\n${r.competitor_overview.what_they_do}`)
        if (r.competitor_overview.pricing_model) sections.push(`Pricing: ${r.competitor_overview.pricing_model}`)
        if (r.competitor_overview.target_customer) sections.push(`Target: ${r.competitor_overview.target_customer}`)
      }
      if (r.where_strong?.length) sections.push(`\nWHERE THEY'RE STRONG:\n${r.where_strong.map((s, i) => `${i + 1}. ${s}`).join('\n')}`)
      if (r.where_weak?.length) sections.push(`\nWHERE THEY'RE WEAK:\n${r.where_weak.map((w, i) => `${i + 1}. ${w.complaint} (${w.source})`).join('\n')}`)
      if (r.how_you_win?.length) sections.push(`\nHOW YOU WIN:\n${r.how_you_win.map((h, i) => `${i + 1}. ${h.talking_point}`).join('\n')}`)
      if (r.already_using_scripts?.length) sections.push(`\nWHEN THEY SAY "WE ALREADY USE ${name.toUpperCase()}":\n${r.already_using_scripts.map((s, i) => `${i + 1}. [${s.approach.replace(/_/g, ' ').toUpperCase()}]\n"${s.script}"`).join('\n\n')}`)
      if (r.elevator_pitch) sections.push(`\n30-SECOND PITCH VS ${name.toUpperCase()}:\n"${r.elevator_pitch}"`)
    })
    return sections.join('\n')
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Competitive Landscape Analysis</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Leave blank to auto-detect the top 3 competitors in your space, or enter a specific competitor to analyze.
        </p>
        <div className="field-group" style={{ marginBottom: 20 }}>
          <label className="label">Add a specific competitor <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
          <input
            className="input-field"
            type="text"
            placeholder="Leave blank to auto-detect top 3 competitors"
            value={specificCompetitor}
            onChange={e => setSpecificCompetitor(e.target.value)}
          />
        </div>

        {!config.perplexityKey && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(229,169,27,0.1)', border: '1px solid rgba(229,169,27,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--warning)' }}>
            💡 Add your Perplexity API key above to unlock real competitor research from reviews, Reddit, and the web
          </div>
        )}

        <button className="btn btn-primary" onClick={analyze} disabled={loading}>
          {loading ? loadingStep || 'Analyzing...' : '🔎 Analyze Competitors'}
        </button>
      </div>

      {error && <div className="error-card" style={{ marginBottom: 24 }}>⚠️ {error}</div>}

      {loading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <SkeletonLoader label={loadingStep || 'Analyzing competitors...'} />
        </div>
      )}

      {results && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18 }}>
              🔎 Competitive Intel — {results.length === 1 ? results[0].name : `${results.length} Competitors`}
            </h3>
            <CopyButton text={buildFullText(results)} label="Copy Full Intel Brief" />
          </div>

          {results.map(({ name, brief: r }, idx) => (
            <CompetitorSection
              key={idx}
              name={name}
              r={r}
              isMultiple={results.length > 1}
              idx={idx}
            />
          ))}

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <button className="btn btn-secondary" onClick={analyze}>↺ Regenerate</button>
          </div>

          <OrbitalCTA vertical={vertical} />
        </>
      )}
    </div>
  )
}

function CompetitorSection({ name, r, isMultiple, idx }) {
  const approachMeta = (approach) =>
    approachLabels[approach] || { label: approach, color: 'var(--text-secondary)' }

  return (
    <div style={isMultiple ? {
      marginBottom: 32,
      padding: '20px',
      background: 'rgba(255,255,255,0.015)',
      border: '1px solid var(--border-light)',
      borderRadius: 14,
    } : { marginBottom: 0 }}>
      {isMultiple && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)',
          }}>{idx + 1}</div>
          <h4 style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>{name}</h4>
        </div>
      )}

      {/* Overview */}
      {r.competitor_overview && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🏢</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Competitor Overview</span>
          </div>
          <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: (r.competitor_overview.pricing_model || r.competitor_overview.target_customer) ? 12 : 0 }}>
            {r.competitor_overview.what_they_do}
          </p>
          {(r.competitor_overview.pricing_model || r.competitor_overview.target_customer) && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
              {r.competitor_overview.pricing_model && (
                <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Pricing: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{r.competitor_overview.pricing_model}</span>
                </div>
              )}
              {r.competitor_overview.target_customer && (
                <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Target: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{r.competitor_overview.target_customer}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Strong + Weak */}
      <div className="grid-2" style={{ marginBottom: 0 }}>
        {r.where_strong?.length > 0 && (
          <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Where They're Strong</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(69,179,107,0.15)', color: 'var(--success)', border: '1px solid rgba(69,179,107,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Be Honest</span>
            </div>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.where_strong.map((s, i) => (
                <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {r.where_weak?.length > 0 && (
          <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--warning)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Where They're Weak</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(229,169,27,0.15)', color: 'var(--warning)', border: '1px solid rgba(229,169,27,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ammunition</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {r.where_weak.map((w, i) => (
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
      {r.how_you_win?.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>🏆</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>How You Win</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(15,110,86,0.15)', color: 'var(--accent)', border: '1px solid rgba(15,110,86,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Say This</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {r.how_you_win.map((h, i) => (
              <div key={i} style={{ padding: '14px 16px', background: 'rgba(15,110,86,0.06)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>"{h.talking_point}"</div>
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
      {r.already_using_scripts?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>💬</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>When They Say "We Already Use {name}"</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {r.already_using_scripts.map((s, i) => {
              const meta = approachMeta(s.approach)
              return (
                <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, borderLeft: `3px solid ${meta.color}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: meta.color, marginBottom: 8 }}>{meta.label}</div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic' }}>"{s.script}"</div>
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
      {r.elevator_pitch && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>30-Second Pitch vs {name}</span>
            </div>
            <CopyButton text={r.elevator_pitch} />
          </div>
          <div style={{ borderLeft: '3px solid var(--accent)', padding: '14px 18px', background: 'rgba(15,110,86,0.05)', borderRadius: '0 8px 8px 0' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.8, fontStyle: 'italic' }}>"{r.elevator_pitch}"</p>
          </div>
        </div>
      )}
    </div>
  )
}
