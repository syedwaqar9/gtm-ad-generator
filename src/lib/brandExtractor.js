// ── Shared ────────────────────────────────────────────────────────────────────

const PROXY = (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`

export const DEFAULT_COLORS = {
  background:    '#0A0A0B',
  headline:      '#FFFFFF',
  paragraph:     '#8A8F98',
  ctaBackground: '#5E6AD2',
  ctaText:       '#FFFFFF',
  accent:        '#5E6AD2',
  isDark:        true,
}

export function hexToRgba(hex, alpha) {
  let h = (hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null
  return `rgba(${r},${g},${b},${alpha})`
}

function resolveUrl(href, base) {
  try { return new URL(href, base).href } catch { return null }
}

function isValidHex(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim())
}

// ── Font ──────────────────────────────────────────────────────────────────────

export function loadGoogleFont(family) {
  if (!family) return
  const id = 'dyn-brand-font'
  const existing = document.getElementById(id)
  if (existing?.dataset.family === family) return
  if (existing) existing.remove()
  const link = document.createElement('link')
  link.id = id
  link.dataset.family = family
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700;800&display=swap`
  document.head.appendChild(link)
}

// ── Step 1: Fetch page ────────────────────────────────────────────────────────

export async function fetchPageContent(url) {
  const res = await fetch(PROXY(url))
  if (!res.ok) throw new Error(`Failed to fetch website (HTTP ${res.status})`)
  const html = await res.text()
  if (!html.trim()) throw new Error('Website returned empty content.')

  const parser = new DOMParser()
  const doc    = parser.parseFromString(html, 'text/html')

  // Clean doc for text extraction
  const clone = doc.cloneNode(true)
  ;['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'svg', 'form', 'button'].forEach(tag =>
    clone.querySelectorAll(tag).forEach(el => el.remove())
  )
  const text = (clone.body?.innerText || clone.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000)

  return { html, doc, text }
}

// ── Step 2: Extract brand identity ───────────────────────────────────────────

export async function extractBrandIdentity(doc, url) {
  const base = new URL(url)
  const getMeta = (attr, val) => doc.querySelector(`meta[${attr}="${val}"]`)?.getAttribute('content')?.trim() || ''

  // Brand name
  const name = (
    getMeta('property', 'og:site_name') ||
    getMeta('name', 'application-name') ||
    getMeta('name', 'twitter:site')?.replace('@', '') ||
    doc.title?.split(/\s*[-|·—]\s*/)[0]?.trim() ||
    base.hostname.replace('www.', '').split('.')[0]
  )

  // Font
  let fontFamily = null
  for (const link of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
    const href = link.getAttribute('href')
    if (!href?.includes('fonts.googleapis.com') && !href?.includes('fonts.bunny.net')) continue
    const m = href.match(/family=([^:&|]+)/)
    if (m) {
      const f = decodeURIComponent(m[1]).replace(/\+/g, ' ').split(',')[0].trim()
      if (f && f !== 'Inter') { fontFamily = f; break }
    }
  }

  // Logo
  const logoSelectors = [
    'link[rel="apple-touch-icon"][href]',
    'link[rel="icon"][type="image/svg+xml"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="icon"][href]',
  ]
  let logoUrl = null
  for (const sel of logoSelectors) {
    const href = doc.querySelector(sel)?.getAttribute('href')
    if (href) { logoUrl = resolveUrl(href, base.href); break }
  }
  if (!logoUrl) logoUrl = resolveUrl('/favicon.ico', base.href)

  let logoSrc = null
  if (logoUrl) {
    try {
      const r = await fetch(PROXY(logoUrl))
      if (r.ok) {
        const blob = await r.blob()
        if (blob.size > 100) {
          logoSrc = await new Promise(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
          })
        }
      }
    } catch { /* logo is optional */ }
  }

  // Metadata bundle for Claude color extraction
  const getMeta2 = (attr, val) => doc.querySelector(`meta[${attr}="${val}"]`)?.getAttribute('content')?.trim() || ''
  const metadata = {
    url,
    title:      doc.title || '',
    description: getMeta2('name', 'description') || getMeta2('property', 'og:description'),
    themeColor:  getMeta2('name', 'theme-color'),
    faviconUrl:  logoUrl || '',
    ogImage:     getMeta2('property', 'og:image'),
    // CSS hints: first 3 style blocks, looking for color-related lines only
    cssHints: Array.from(doc.querySelectorAll('style'))
      .slice(0, 3)
      .map(s => s.textContent
        .split('\n')
        .filter(l => /color|background|#[0-9a-fA-F]{3,6}|rgb|hsl/i.test(l))
        .slice(0, 30)
        .join('\n')
      )
      .join('\n')
      .slice(0, 1500),
  }

  return { name, logoSrc, fontFamily, description: metadata.description, metadata }
}

// ── Step 3: Extract colors via Claude ─────────────────────────────────────────

export async function extractColorsWithClaude(metadata, brandName, apiKey) {
  const { url, title, description, themeColor, faviconUrl, ogImage, cssHints } = metadata

  const contextLines = [
    `Website URL: ${url}`,
    `Brand name: ${brandName}`,
    `Page title: ${title}`,
    `Meta description: ${description || '(none)'}`,
    `theme-color meta tag: ${themeColor || '(not set)'}`,
    `Favicon/logo URL: ${faviconUrl || '(not found)'}`,
    `Open Graph image URL: ${ogImage || '(none)'}`,
    cssHints ? `\nCSS color-related lines:\n${cssHints}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Analyze this website content and metadata for ${url}. Determine the brand's exact color palette: primary color, secondary color, accent color, preferred background color (light or dark), text color, and CTA button color.

${contextLines}

Rules:
- If a theme-color meta tag is present, treat it as the primary/accent color — it is the most reliable signal.
- If you recognise the brand (e.g. Stripe, Linear, Notion, Vercel, GitHub), use your knowledge of their actual brand colors.
- The CSS color lines above may contain explicit color variable definitions — use them if present.
- Set isDark to true if the brand predominantly uses a dark background, false for light backgrounds.
- The "text" color must contrast well against the "background" color.
- The "cta" color should be the most distinctive brand color (usually the primary).

Return ONLY valid JSON with hex codes in exactly this format:
{
  "primary": "#hex",
  "secondary": "#hex",
  "accent": "#hex",
  "background": "#hex",
  "text": "#hex",
  "cta": "#hex",
  "isDark": true
}

No markdown fences, no explanation, no extra keys. Just the JSON object.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Color API error ${res.status}: ${err?.error?.message || 'Unknown error'}`)
  }

  const data    = await res.json()
  const rawText = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim()

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error(`Claude returned invalid JSON for colors: ${rawText.slice(0, 200)}`)
  }

  const isDark = parsed.isDark !== false

  // Map Claude's keys → our internal AdCanvas color keys
  const accent = isValidHex(parsed.accent)  ? parsed.accent
               : isValidHex(parsed.primary) ? parsed.primary
               : DEFAULT_COLORS.accent

  return {
    background:    isValidHex(parsed.background) ? parsed.background : (isDark ? '#0A0A0B' : '#FFFFFF'),
    headline:      isValidHex(parsed.text)        ? parsed.text       : (isDark ? '#FFFFFF' : '#111113'),
    paragraph:     isDark ? '#8A8F98' : '#6B7280',
    ctaBackground: isValidHex(parsed.cta)         ? parsed.cta
                 : isValidHex(parsed.primary)      ? parsed.primary
                 : DEFAULT_COLORS.ctaBackground,
    ctaText:       '#FFFFFF',
    accent,
    isDark,
  }
}

// ── Ad copy via Claude ────────────────────────────────────────────────────────

export async function generateAdsWithClaude(text, count, apiKey, brand) {
  const brandCtx = [
    `Brand name: ${brand.name}`,
    brand.description ? `Description: ${brand.description}` : '',
    brand.fontFamily  ? `Font: ${brand.fontFamily}`         : '',
  ].filter(Boolean).join('\n')

  const prompt = `You are an expert ad copywriter for technical/SaaS audiences.

Brand context:
${brandCtx}

Generate exactly ${count} unique Facebook/Instagram ad variations (1080×1080). Rotate evenly through these frameworks:
1. Cialdini Influence – social proof, scarcity, authority, liking, reciprocity
2. Heath Brothers (Made to Stick) – unexpected, concrete, credible, emotional, story-driven
3. Rory Sutherland (Alchemy) – reframe value, counterintuitive angles, perceived vs actual value
4. Ogilvy on Advertising – benefit-driven, extreme specificity, curiosity gap, news angle
5. Thaler & Sunstein (Nudge) – loss aversion, default bias, social norms, choice architecture

Rules:
- Headlines: 5–12 words, match brand voice; use \\n for a dramatic line break
- Paragraphs: 1–2 sentences, 20–40 words, muted supporting copy
- CTAs: 2–5 words, action-oriented, specific to the brand
- No two ads should feel the same

Website content:
---
${text}
---

Return ONLY a raw JSON array with ${count} objects:
[{ "headline": "...", "paragraph": "...", "cta": "..." }, ...]
No markdown fences, no explanation.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e?.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  const ads  = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim())
  if (!Array.isArray(ads)) throw new Error('Claude did not return a JSON array.')
  return ads.map(ad => ({ headline: ad.headline || '', paragraph: ad.paragraph || '', cta: ad.cta || '' }))
}
