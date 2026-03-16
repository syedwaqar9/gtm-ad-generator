import React from 'react'

export default function OrbitalCTA({ vertical }) {
  const verticalLabel = vertical && vertical !== 'Custom' ? vertical : 'SMB'

  return (
    <div style={{
      background: '#1A1A1E',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginTop: 24,
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, #5E6AD2, #9B6DFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 18, color: '#fff', flexShrink: 0,
        }}>O</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>You have the playbook. Now get the contacts.</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {verticalLabel} businesses in your territory, with verified decision-maker data. Powered by Orbital.
          </div>
        </div>
      </div>
      <a
        href="https://www.withorbital.com/?utm_source=smb-toolkit&utm_medium=tool&utm_campaign=sales-play"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent)', color: '#fff',
          padding: '10px 20px', borderRadius: 8,
          fontWeight: 600, fontSize: 14,
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--accent-hover)'
          e.currentTarget.style.boxShadow = '0 0 20px var(--accent-glow)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--accent)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        Get 100 Free Leads →
      </a>
    </div>
  )
}
