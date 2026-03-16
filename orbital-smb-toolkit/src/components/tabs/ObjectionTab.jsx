import React, { useState } from 'react'
import { callClaude } from '../../api/claude'
import SkeletonLoader from '../SkeletonLoader'
import OrbitalCTA from '../OrbitalCTA'
import CopyButton from '../CopyButton'

const PRESET_OBJECTIONS = [
  "We don't have budget for this",
  "We already use [competitor/pen and paper]",
  "I'm too busy to look at this right now",
  "Call me back next quarter",
  "I need to talk to my [partner/spouse/manager]",
  "We're too small for software",
  "I've been burned by software before",
  "Just send me an email",
  "We're locked into a contract",
  "Custom objection (type your own)",
]

const APPROACH_COLORS = {
  'Empathy First': 'var(--success)',
  'Reframe the Problem': 'var(--accent)',
  'Proof-Based Challenge': 'var(--warning)',
}

const APPROACH_ICONS = {
  'Empathy First': '🤝',
  'Reframe the Problem': '🔄',
  'Proof-Based Challenge': '📊',
}

export default function ObjectionTab({ config, onMissingKey }) {
  const [objection, setObjection] = useState(PRESET_OBJECTIONS[0])
  const [customObjection, setCustomObjection] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const vertical = config.vertical === 'Custom' ? config.customVertical : config.vertical
  const isCustom = objection === 'Custom objection (type your own)'
  const finalObjection = isCustom ? customObjection : objection

  const generate = async () => {
    if (!config.anthropicKey) { onMissingKey(); return }
    if (!vertical || (!config.productDescription && !config.companyContext)) {
      setError('Please fill in your vertical and product description (or company website) in the setup section above.')
      return
    }
    if (isCustom && !customObjection.trim()) {
      setError('Please enter your custom objection.')
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
        systemPrompt: `You are a sales coach who trains reps to handle objections from small business owners. You know that SMB owners give objections because they're busy and protective of their time, not because they're not interested. Your responses are empathetic, never pushy, and always redirect to the business owner's interests.`,
        userPrompt: `Generate 3 response scripts for this objection:
- Objection: ${finalObjection}
- My product: ${productContext}
- Target vertical: ${vertical}
- Decision maker type: small business owner

Three approaches:
1. Empathy First: Acknowledge their concern genuinely, relate to their situation, then redirect with a question.
2. Reframe: Change how they see the objection. Turn the objection into a reason to meet.
3. Proof-Based Challenge: Use a specific (realistic, not made up) data point or story about a similar business to gently challenge the objection.

Each response must be 2-4 sentences max. Sound like a human conversation, not a sales playbook. Include a one-line psychology note explaining why each approach works.

Return as JSON: [{"approach_name": "Empathy First", "response": "...", "psychology_note": "..."}, {"approach_name": "Reframe the Problem", "response": "...", "psychology_note": "..."}, {"approach_name": "Proof-Based Challenge", "response": "...", "psychology_note": "..."}]`,
        maxTokens: 1500,
      })
      setResults(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Something went wrong. Please check your API key and try again.')
    } finally {
      setLoading(false)
    }
  }

  const allText = results
    ? `OBJECTION: "${finalObjection}"\n\n` + results.map(r => `${r.approach_name.toUpperCase()}:\n${r.response}\n\nWhy it works: ${r.psychology_note}`).join('\n\n---\n\n')
    : ''

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Select the Objection</h3>
        <div className="field-group" style={{ marginBottom: isCustom ? 12 : 20 }}>
          <label className="label">Common Objections</label>
          <select className="input-field" value={objection} onChange={e => setObjection(e.target.value)}>
            {PRESET_OBJECTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        {isCustom && (
          <div className="field-group" style={{ marginBottom: 20 }}>
            <label className="label">Your objection</label>
            <input
              className="input-field"
              type="text"
              placeholder="Type the exact words they said..."
              value={customObjection}
              onChange={e => setCustomObjection(e.target.value)}
            />
          </div>
        )}

        {!isCustom && finalObjection && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: '3px solid var(--warning)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Handling: </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--warning)' }}>"{finalObjection}"</span>
          </div>
        )}

        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : '🛡️ Generate 3 Responses'}
        </button>
      </div>

      {error && <div className="error-card" style={{ marginBottom: 24 }}>⚠️ {error}</div>}

      {loading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <SkeletonLoader label="Crafting your objection responses..." />
        </div>
      )}

      {results && results.length > 0 && (
        <>
          {results.map((item, i) => {
            const color = APPROACH_COLORS[item.approach_name] || 'var(--accent)'
            const icon = APPROACH_ICONS[item.approach_name] || '💬'
            return (
              <div key={i} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span className="badge" style={{
                      background: `${color}20`,
                      color: color,
                      border: `1px solid ${color}50`,
                    }}>{item.approach_name}</span>
                  </div>
                  <CopyButton text={item.response} />
                </div>
                <div style={{
                  borderLeft: `3px solid ${color}`,
                  padding: '12px 16px',
                  backgroundColor: `${color}08`,
                  borderRadius: '0 8px 8px 0',
                  color: 'var(--text-primary)',
                  lineHeight: 1.7,
                  marginBottom: 10,
                  fontSize: 14,
                }}>{item.response}</div>
                {item.psychology_note && (
                  <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <span style={{ fontSize: 12 }}>🧠</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{item.psychology_note}</span>
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <CopyButton text={allText} label="Copy All Responses" />
            <button className="btn btn-secondary" onClick={generate}>↺ Regenerate</button>
          </div>

          <OrbitalCTA vertical={vertical} />
        </>
      )}
    </div>
  )
}
