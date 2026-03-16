import React, { useState } from 'react'
import { callClaude } from '../../api/claude'
import SkeletonLoader from '../SkeletonLoader'
import OrbitalCTA from '../OrbitalCTA'
import CopyButton from '../CopyButton'

const CALL_SCENARIOS = [
  'First cold call (never spoken before)',
  'Follow-up call (left voicemail before)',
  'Warm call (they opened my email)',
  'Referral call (someone gave me their name)',
  'Inbound call (they requested info)',
]

const DM_TYPES = [
  'Business owner (solo operator)',
  'Business owner (has small team)',
  'Office/practice manager',
  'Regional/area manager',
  'Operations manager',
]

const SECTION_ICONS = {
  opening: '👋',
  bridge: '🌉',
  discovery_questions: '🔍',
  value_statement: '💡',
  objections: '🛡️',
  close: '🎯',
  voicemail: '📱',
}

const SECTION_LABELS = {
  opening: 'Opening (first 10 seconds)',
  bridge: 'Bridge (why you\'re calling)',
  discovery_questions: 'Discovery Questions',
  value_statement: 'Value Statement (15 seconds)',
  objections: 'Common Objections',
  close: 'Close',
  voicemail: 'Voicemail Script',
}

export default function ColdCallTab({ config, onMissingKey }) {
  const [scenario, setScenario] = useState(CALL_SCENARIOS[0])
  const [dmType, setDmType] = useState(DM_TYPES[0])
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
        systemPrompt: `You are a top-performing SDR who cold calls small business owners every day. You know that small business owners answer their own phones, are interrupted constantly, and will hang up in 5 seconds if you sound like a telemarketer. Your scripts sound like a neighbor asking for advice, not a salesperson reading a script. You use the exact language that people in this specific vertical use.`,
        userPrompt: `Generate a complete cold call script for:
- My product: ${productContext}
- Target vertical: ${vertical}
- Call scenario: ${scenario}
- Decision maker type: ${dmType}

Include these sections:
1. Opening (first 10 seconds): A permission-based opener that sounds human. Do NOT say "How are you today?" or "Did I catch you at a bad time?" — those are burned. Use something specific to their vertical.
2. Bridge: One sentence connecting to their world.
3. Discovery Questions: 5 questions specific to ${vertical} operations. Reference real workflows they deal with daily.
4. Value Statement: Explain the product in 15 seconds using their language.
5. Top 3 Objections: The exact objections a ${vertical} owner gives, with natural responses.
6. Close: How to ask for a meeting or demo.
7. Voicemail: A 30-second voicemail script that makes them curious enough to call back.

Return as JSON: {"opening": "...", "bridge": "...", "discovery_questions": ["...", "..."], "value_statement": "...", "objections": [{"objection": "...", "response": "..."}], "close": "...", "voicemail": "..."}`,
        maxTokens: 2200,
      })
      setResults(data)
    } catch (e) {
      setError(e.message || 'Something went wrong. Please check your API key and try again.')
    } finally {
      setLoading(false)
    }
  }

  const buildFullScript = () => {
    if (!results) return ''
    return [
      `COLD CALL SCRIPT — ${vertical?.toUpperCase()}\n`,
      `OPENING (first 10 seconds):\n${results.opening}`,
      `\nBRIDGE:\n${results.bridge}`,
      `\nDISCOVERY QUESTIONS:\n${(results.discovery_questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
      `\nVALUE STATEMENT:\n${results.value_statement}`,
      `\nOBJECTIONS & RESPONSES:\n${(results.objections || []).map(o => `Objection: ${o.objection}\nResponse: ${o.response}`).join('\n\n')}`,
      `\nCLOSE:\n${results.close}`,
      `\nVOICEMAIL:\n${results.voicemail}`,
    ].join('\n')
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Script Parameters</h3>
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="field-group">
            <label className="label">Call Scenario</label>
            <select className="input-field" value={scenario} onChange={e => setScenario(e.target.value)}>
              {CALL_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label">Decision Maker Type</label>
            <select className="input-field" value={dmType} onChange={e => setDmType(e.target.value)}>
              {DM_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : '📞 Generate Call Script'}
        </button>
      </div>

      {error && <div className="error-card" style={{ marginBottom: 24 }}>⚠️ {error}</div>}

      {loading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <SkeletonLoader label="Building your call script..." />
        </div>
      )}

      {results && (
        <>
          {/* Opening */}
          {results.opening && (
            <ScriptSection icon="👋" title="Opening (first 10 seconds)" content={results.opening} note="Lead with a pattern interrupt — sound like you know their world." />
          )}
          {results.bridge && (
            <ScriptSection icon="🌉" title="Bridge (why you're calling)" content={results.bridge} />
          )}

          {/* Discovery Questions */}
          {results.discovery_questions && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🔍</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Discovery Questions</span>
                </div>
                <CopyButton text={results.discovery_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')} />
              </div>
              <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.discovery_questions.map((q, i) => (
                  <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6, paddingLeft: 4 }}>{q}</li>
                ))}
              </ol>
            </div>
          )}

          {results.value_statement && (
            <ScriptSection icon="💡" title="Value Statement (15 seconds)" content={results.value_statement} note="Use their language, not software language." />
          )}

          {/* Objections */}
          {results.objections && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Common Objections (Top {results.objections.length})</span>
              </div>
              {results.objections.map((obj, i) => (
                <div key={i} style={{ marginBottom: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: '3px solid var(--warning)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--warning)', fontSize: 13, marginBottom: 6 }}>"{obj.objection}"</div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6 }}>{obj.response}</div>
                </div>
              ))}
            </div>
          )}

          {results.close && (
            <ScriptSection icon="🎯" title="Close" content={results.close} />
          )}
          {results.voicemail && (
            <ScriptSection icon="📱" title="Voicemail Script (30 seconds max)" content={results.voicemail} note="Leave them curious, not sold to." />
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <CopyButton text={buildFullScript()} label="Copy Full Script" />
            <button className="btn btn-secondary" onClick={generate}>↺ Regenerate</button>
          </div>

          <OrbitalCTA vertical={vertical} />
        </>
      )}
    </div>
  )
}

function ScriptSection({ icon, title, content, note }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        </div>
        <CopyButton text={content} />
      </div>
      <div style={{
        borderLeft: '3px solid var(--accent)',
        paddingLeft: 16, padding: '12px 16px',
        backgroundColor: 'rgba(94,106,210,0.05)',
        borderRadius: '0 8px 8px 0',
        color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
        marginBottom: note ? 10 : 0,
      }}>{content}</div>
      {note && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>💬</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{note}</span>
        </div>
      )}
    </div>
  )
}
