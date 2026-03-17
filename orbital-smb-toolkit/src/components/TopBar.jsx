import React from 'react'

export default function TopBar() {
  return (
    <div style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(10,10,11,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          {/* Logo + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0F6E56, #16A87F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0,
              boxShadow: '0 0 12px rgba(15,110,86,0.4)'
            }}>O</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>SMB Sales Toolkit</div>
            </div>
          </div>

          {/* Right side */}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Powered by{' '}
            <a href="https://www.withorbital.com/?utm_source=smb-toolkit&utm_medium=tool&utm_campaign=topbar" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 500 }}>
              Orbital
            </a>
            {' '}— SMB Account Intelligence
          </div>
        </div>
      </div>

      {/* Subtitle bar */}
      <div style={{ borderTop: '1px solid var(--border)', backgroundColor: 'rgba(20,20,22,0.5)', padding: '8px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
          Free AI-powered tools for sales teams selling to small businesses
        </div>
      </div>
    </div>
  )
}
