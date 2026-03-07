import { forwardRef } from 'react'
import { hexToRgba, DEFAULT_COLORS } from '../lib/brandExtractor'

const AdCanvas = forwardRef(function AdCanvas(
  { headline, paragraph, cta, brandName = 'YourBrand', logoSrc = null, colors: colorsProp, brandFont = null },
  ref,
) {
  const c    = { ...DEFAULT_COLORS, ...colorsProp }
  const font = brandFont ? `'${brandFont}', Inter, sans-serif` : "'Inter', sans-serif"
  const dark = c.isDark !== false

  // Accent rgba helpers
  const a = (opacity) => hexToRgba(c.accent, opacity) || `rgba(94,106,210,${opacity})`

  // In light mode glows are much subtler; grid uses dark lines
  const glowScale  = dark ? 1 : 0.45
  const gridColor  = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.045)'
  const footerLine = dark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.08)'
  const footerText = dark ? hexToRgba(c.headline, 0.18) : hexToRgba(c.headline, 0.35)

  return (
    <div
      ref={ref}
      style={{
        width: 1080, height: 1080,
        background: c.background,
        position: 'relative', overflow: 'hidden',
        fontFamily: font,
        display: 'flex', flexDirection: 'column',
        padding: '80px', boxSizing: 'border-box',
      }}
    >
      {/* Glow — top right */}
      <div style={{
        position: 'absolute', top: -180, right: -180,
        width: 720, height: 720, borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${a(0.28 * glowScale)} 0%, ${a(0.08 * glowScale)} 45%, transparent 70%)`,
      }} />

      {/* Glow — bottom left */}
      <div style={{
        position: 'absolute', bottom: -160, left: -160,
        width: 580, height: 580, borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${a(0.18 * glowScale)} 0%, ${a(0.04 * glowScale)} 50%, transparent 70%)`,
      }} />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(${gridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
        `,
        backgroundSize: '72px 72px',
      }} />

      {/* Top border glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1, pointerEvents: 'none',
        background: `linear-gradient(90deg, transparent, ${a(0.7)} 40%, ${a(0.7)} 60%, transparent)`,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Header: logo or wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoSrc ? (
            <img src={logoSrc} alt={brandName}
              style={{ height: 36, width: 'auto', maxWidth: 140, objectFit: 'contain', display: 'block' }} />
          ) : (
            <>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: `linear-gradient(135deg, ${c.accent} 0%, ${c.ctaBackground} 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2"  y="2"  width="6" height="6" rx="1.5" fill={c.ctaText} opacity="0.9" />
                  <rect x="10" y="2"  width="6" height="6" rx="1.5" fill={c.ctaText} opacity="0.5" />
                  <rect x="2"  y="10" width="6" height="6" rx="1.5" fill={c.ctaText} opacity="0.5" />
                  <rect x="10" y="10" width="6" height="6" rx="1.5" fill={c.ctaText} opacity="0.9" />
                </svg>
              </div>
              <span style={{ color: c.headline, fontSize: 18, fontWeight: 600, letterSpacing: '-0.3px', fontFamily: font }}>
                {brandName}
              </span>
            </>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 32 }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            alignSelf: 'flex-start', marginBottom: 44,
            padding: '7px 16px', borderRadius: 100,
            border: `1px solid ${a(0.4)}`,
            background: a(dark ? 0.1 : 0.07),
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: c.accent,
              boxShadow: `0 0 6px ${a(0.8)}`,
            }} />
            <span style={{
              color: c.paragraph, fontSize: 13, fontWeight: 500,
              letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: font,
            }}>
              Now Available
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            color: c.headline,
            fontSize: 72, fontWeight: 800,
            lineHeight: 1.07, letterSpacing: '-2.5px',
            margin: '0 0 36px 0', maxWidth: 860, fontFamily: font,
          }}>
            {headline}
          </h1>

          {/* Paragraph */}
          <p style={{
            color: c.paragraph,
            fontSize: 22, fontWeight: 400,
            lineHeight: 1.65, margin: '0 0 60px 0', maxWidth: 620, fontFamily: font,
          }}>
            {paragraph}
          </p>

          {/* CTA button */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '18px 36px',
              background: c.ctaBackground,
              borderRadius: 10,
              color: c.ctaText,
              fontSize: 18, fontWeight: 600, letterSpacing: '-0.2px', fontFamily: font,
              boxShadow: `0 0 40px ${a(0.4)}`,
            }}>
              {cta}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke={c.ctaText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${footerLine}`,
          paddingTop: 28,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: footerText, fontSize: 15, fontWeight: 500, fontFamily: font }}>
            {brandName.toLowerCase().replace(/\s+/g, '')}.com
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: footerText }} />
            <span style={{ color: footerText, fontSize: 15, fontFamily: font }}>Trusted by 10,000+ teams</span>
          </div>
        </div>
      </div>
    </div>
  )
})

export default AdCanvas
