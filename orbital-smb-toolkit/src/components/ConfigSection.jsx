import React, { useState } from 'react'

const VERTICALS = [
  'Dental Clinics',
  'HVAC & Heating',
  'Restaurants & Food Service',
  'Fitness & Gyms',
  'Salons & Spas',
  'Veterinary Practices',
  'Plumbing',
  'Roofing',
  'Landscaping',
  'Auto Repair',
  'Med Spas',
  'Senior Living',
  'Cannabis Dispensaries',
  'Tattoo Studios',
  'Pet Grooming',
  'Custom',
]

export default function ConfigSection({ config, onChange, configRef }) {
  const [collapsed, setCollapsed] = useState(false)

  const handleVerticalChange = (e) => {
    onChange({ ...config, vertical: e.target.value, customVertical: '' })
  }

  const hasProductContext = config.companyContext || config.productDescription

  return (
    <div ref={configRef} className="card" style={{ marginBottom: 24 }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: collapsed ? 0 : 20 }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: config.anthropicKey ? 'var(--success)' : 'var(--warning)' }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Configure Your Setup</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {config.anthropicKey && (
            <span className="badge badge-success" style={{ fontSize: 10 }}>API Key Set</span>
          )}
          {config.companyContext && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(69,179,107,0.15)', color: 'var(--success)', border: '1px solid rgba(69,179,107,0.3)' }}>
              ✓ Product Detected
            </span>
          )}
          <span style={{ color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1 }}>{collapsed ? '+' : '−'}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Row 1: Vertical + Product Description */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="field-group">
              <label className="label">Select Your Vertical</label>
              <select
                className="input-field"
                value={config.vertical}
                onChange={handleVerticalChange}
              >
                <option value="">— Choose a vertical —</option>
                {VERTICALS.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {config.vertical === 'Custom' && (
                <input
                  className="input-field"
                  style={{ marginTop: 8 }}
                  type="text"
                  placeholder="Describe the vertical (e.g., Food Trucks)"
                  value={config.customVertical}
                  onChange={e => onChange({ ...config, customVertical: e.target.value })}
                />
              )}
            </div>
            <div className="field-group">
              <label className="label">
                What does your product do?
                {config.companyWebsite && (
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>(fallback if no URL)</span>
                )}
              </label>
              <input
                className="input-field"
                type="text"
                placeholder="e.g., Patient scheduling software for dental clinics"
                value={config.productDescription}
                onChange={e => onChange({ ...config, productDescription: e.target.value })}
                style={config.companyContext ? { opacity: 0.5 } : {}}
              />
            </div>
          </div>

          {/* Row 2: Company Website */}
          <div style={{ marginBottom: 16 }}>
            <div className="field-group">
              <label className="label">
                Your Company Website <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional — auto-detects your product)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g., servicetitan.com"
                  value={config.companyWebsite}
                  onChange={e => onChange({ ...config, companyWebsite: e.target.value })}
                  style={{ paddingRight: config.fetchingCompanyContext || config.companyContext ? 140 : 12 }}
                />
                {config.fetchingCompanyContext && (
                  <span style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    Analyzing...
                  </span>
                )}
                {config.companyContext && !config.fetchingCompanyContext && (
                  <span style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 11, fontWeight: 600, color: 'var(--success)',
                  }}>
                    ✓ Product detected
                  </span>
                )}
              </div>
              {config.companyContext && !config.fetchingCompanyContext && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(69,179,107,0.07)', border: '1px solid rgba(69,179,107,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--success)' }}>Auto-detected:</strong> {config.companyContext.slice(0, 180)}{config.companyContext.length > 180 ? '...' : ''}
                </div>
              )}
              {!config.perplexityKey && config.companyWebsite && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--warning)' }}>
                  💡 Add your Perplexity API key to enable auto-detection from your website
                </div>
              )}
            </div>
          </div>

          {/* Row 3: API Keys */}
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field-group">
              <label className="label">Anthropic API Key</label>
              <input
                className="input-field"
                type="password"
                placeholder="sk-ant-..."
                value={config.anthropicKey}
                onChange={e => onChange({ ...config, anthropicKey: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="field-group">
              <label className="label">Perplexity API Key <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional — enables web research)</span></label>
              <input
                className="input-field"
                type="password"
                placeholder="pplx-..."
                value={config.perplexityKey}
                onChange={e => onChange({ ...config, perplexityKey: e.target.value })}
                autoComplete="off"
              />
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: 0.7 }}>
            🔒 Keys held in session memory only. Never stored or transmitted beyond API calls.
          </p>
        </>
      )}
    </div>
  )
}
