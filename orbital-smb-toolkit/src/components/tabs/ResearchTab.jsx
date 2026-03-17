import React, { useState } from 'react'
import { callClaude } from '../../api/claude'
import { callPerplexity } from '../../api/perplexity'
import SkeletonLoader from '../SkeletonLoader'
import OrbitalCTA from '../OrbitalCTA'
import CopyButton from '../CopyButton'

const VERTICAL_COUNTS = {
  'Dental Clinics': '4,200+',
  'HVAC & Heating': '6,800+',
  'Restaurants & Food Service': '12,500+',
  'Fitness & Gyms': '3,400+',
  'Salons & Spas': '5,100+',
  'Veterinary Practices': '2,900+',
  'Plumbing': '5,600+',
  'Roofing': '4,100+',
  'Auto Repair': '7,200+',
  'Landscaping': '8,300+',
}

const VERTICAL_CONTACTS = {
  'Dental Clinics': [
    { name: 'J████ M██████', title: 'Owner', business: 'Smile Dental Care', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@smile████.com' },
    { name: 'R████ P████', title: 'Practice Manager', business: 'Bright Teeth Dental', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@bright████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'Premier Dental Group', location: 'Houston, TX', phone: '███-███-2190', email: 's████@premier████.com' },
  ],
  'HVAC & Heating': [
    { name: 'J████ M██████', title: 'Owner', business: 'Premier HVAC Solutions', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@premier████.com' },
    { name: 'R████ P████', title: 'Operations Manager', business: 'CoolAir Systems', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@coolair████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'Comfort Zone HVAC', location: 'Houston, TX', phone: '███-███-2190', email: 's████@comfort████.com' },
  ],
  'Restaurants & Food Service': [
    { name: 'J████ M██████', title: 'Owner', business: 'The Corner Bistro', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@corner████.com' },
    { name: 'R████ P████', title: 'General Manager', business: 'Harbor Grill', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@harbor████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'Main Street Kitchen', location: 'Houston, TX', phone: '███-███-2190', email: 's████@mainst████.com' },
  ],
  'Fitness & Gyms': [
    { name: 'J████ M██████', title: 'Owner', business: 'Iron Forge Fitness', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@ironforge████.com' },
    { name: 'R████ P████', title: 'Studio Manager', business: 'Peak Performance Gym', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@peak████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'Elevate Fitness Studio', location: 'Houston, TX', phone: '███-███-2190', email: 's████@elevate████.com' },
  ],
  'Salons & Spas': [
    { name: 'J████ M██████', title: 'Owner', business: 'Luxe Hair Studio', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@luxe████.com' },
    { name: 'R████ P████', title: 'Salon Manager', business: 'The Glow Spa', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@glow████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'Pure Beauty Salon', location: 'Houston, TX', phone: '███-███-2190', email: 's████@pure████.com' },
  ],
  'Veterinary Practices': [
    { name: 'J████ M██████', title: 'Owner', business: 'Paws & Claws Vet Clinic', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@paws████.com' },
    { name: 'R████ P████', title: 'Practice Manager', business: 'Companion Animal Hospital', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@companion████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'Northside Veterinary Clinic', location: 'Houston, TX', phone: '███-███-2190', email: 's████@northside████.com' },
  ],
  'Plumbing': [
    { name: 'J████ M██████', title: 'Owner', business: 'FlowRight Plumbing', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@flowright████.com' },
    { name: 'R████ P████', title: 'Operations Manager', business: 'Reliable Pipe Co.', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@reliable████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'Apex Plumbing Services', location: 'Houston, TX', phone: '███-███-2190', email: 's████@apex████.com' },
  ],
  'Roofing': [
    { name: 'J████ M██████', title: 'Owner', business: 'Summit Roofing Co.', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@summit████.com' },
    { name: 'R████ P████', title: 'Project Manager', business: 'ShieldRoof Solutions', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@shield████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'TopLine Roofing', location: 'Houston, TX', phone: '███-███-2190', email: 's████@topline████.com' },
  ],
  'Auto Repair': [
    { name: 'J████ M██████', title: 'Owner', business: 'ProTech Auto Service', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@protech████.com' },
    { name: 'R████ P████', title: 'Shop Manager', business: 'Precision Auto Care', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@precision████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'Trusted Tire & Auto', location: 'Houston, TX', phone: '███-███-2190', email: 's████@trusted████.com' },
  ],
  'Landscaping': [
    { name: 'J████ M██████', title: 'Owner', business: 'GreenScape Landscaping', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@greenscape████.com' },
    { name: 'R████ P████', title: 'Operations Manager', business: 'Bloom Yard Services', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@bloom████.com' },
    { name: 'S████ K██████', title: 'Owner', business: 'TerraForm Outdoor', location: 'Houston, TX', phone: '███-███-2190', email: 's████@terraform████.com' },
  ],
}

const DEFAULT_CONTACTS = [
  { name: 'J████ M██████', title: 'Owner', business: 'A████ Business Solutions', location: 'Austin, TX', phone: '███-███-4521', email: 'j████@abiz████.com' },
  { name: 'R████ P████', title: 'General Manager', business: 'B████ Services Co.', location: 'Dallas, TX', phone: '███-███-7834', email: 'r████@bserv████.com' },
  { name: 'S████ K██████', title: 'Owner', business: 'C████ Local Group', location: 'Houston, TX', phone: '███-███-2190', email: 's████@clocal████.com' },
]

export default function ResearchTab({ config, onMissingKey }) {
  const [businessName, setBusinessName] = useState('')
  const [website, setWebsite] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const vertical = config.vertical === 'Custom' ? config.customVertical : config.vertical

  const research = async () => {
    if (!config.anthropicKey) { onMissingKey(); return }
    if (!businessName.trim()) {
      setError('Please enter a business name.')
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
      let websiteInfo = ''
      let reviewsResearch = ''
      let customerFeedbackResearch = ''
      let redditResearch = ''

      // Step 1: Website research via Claude
      if (website.trim()) {
        setLoadingStep('Analyzing their website...')
        try {
          websiteInfo = await callClaude({
            apiKey: config.anthropicKey,
            systemPrompt: 'You are a sales researcher. Analyze the provided business website URL and extract key information.',
            userPrompt: `Based on the website URL "${website}", tell me what you know or can reasonably infer about this ${vertical} business called "${businessName}": what services they likely offer, estimated size, any notable features. If you cannot access the URL, make reasonable inferences based on the business name and vertical. Keep it brief (3-4 sentences).`,
            maxTokens: 400,
          })
          if (typeof websiteInfo !== 'string') websiteInfo = JSON.stringify(websiteInfo)
        } catch {
          websiteInfo = `Could not access website. Will use business name and vertical context.`
        }
      }

      // Step 2: Three Perplexity searches in parallel
      if (config.perplexityKey) {
        setLoadingStep('Searching reviews, customer feedback, and Reddit...')
        try {
          const locationStr = location.trim() ? ` ${location.trim()}` : ''
          const [reviewsResult, feedbackResult, redditResult] = await Promise.all([
            callPerplexity({
              apiKey: config.perplexityKey,
              query: `${businessName}${locationStr} reviews`,
            }),
            callPerplexity({
              apiKey: config.perplexityKey,
              query: `${businessName} customer complaints OR customer experience OR patient experience`,
            }),
            callPerplexity({
              apiKey: config.perplexityKey,
              query: `${vertical} owner pain points frustrations software site:reddit.com`,
            }),
          ])
          reviewsResearch = reviewsResult || ''
          customerFeedbackResearch = feedbackResult || ''
          redditResearch = redditResult || ''
        } catch (e) {
          reviewsResearch = ''
          customerFeedbackResearch = ''
          redditResearch = ''
        }
      }

      // Step 3: Synthesize with Claude
      setLoadingStep('Synthesizing your research brief...')
      const brief = await callClaude({
        apiKey: config.anthropicKey,
        systemPrompt: `You are an expert sales researcher who helps SDRs prepare for calls with small business owners. You synthesize business intelligence from multiple sources into actionable pre-call briefs tailored to a specific product and rep.`,
        userPrompt: `Create a pre-call research brief for a sales rep selling to ${vertical} businesses.

Seller's product:
${productContext}

Business being called:
- Name: ${businessName}
- Website: ${website || 'Not provided'}
- Location: ${location || 'Not specified'}
${websiteInfo ? `\nWebsite Analysis:\n${websiteInfo}` : ''}
${reviewsResearch ? `\nGoogle/Web Reviews Research:\n${reviewsResearch}` : ''}
${customerFeedbackResearch ? `\nCustomer Feedback Research:\n${customerFeedbackResearch}` : ''}
${redditResearch ? `\nReddit Research (${vertical} owner discussions):\n${redditResearch}` : ''}

CRITICAL INSTRUCTION — filter everything through the lens of the seller's product:

The seller sells the product described above to ${vertical} businesses. When analyzing all research data:

1. In "customer_reviews" — only highlight complaints and praises that are RELEVANT to what the seller's product solves. If they sell scheduling software, surface complaints about wait times, booking friction, no-shows, rescheduling, and staff coordination. Ignore complaints about product quality, food, décor, or anything the seller's product cannot address.

2. In "vertical_pain_points" — only include pain points from Reddit that the seller's product can actually address. Filter out everything else.

3. In "likely_pain_points" — connect the dots between the reviews/research and the seller's specific product. Show how each pain point maps to a feature or capability the product offers.

4. In "talking_points" — every talking point must reference a specific review finding or Reddit insight AND connect it to the seller's product. Example format: "[Source] shows [specific finding] — this is your opening to show how your product [specific capability]."

5. In "suggested_opening" — reference a specific pain point found in the research that the seller's product directly solves.

The entire brief should read like a sales intelligence report tailored to THIS rep selling THIS product to THIS business. Not a generic company overview.

Generate a structured research brief with these exact fields:

1. business_overview: 2-3 sentences about what this business does, location, services, and estimated size.

2. customer_reviews: ${config.perplexityKey ? `Object with these keys:
   - overall_rating: string like "4.2 stars on Google" if found, or null if not found
   - praises: array of top 3 things customers praise that relate to what the seller's product touches (specific quotes or paraphrases from reviews found)
   - complaints: array of top 3 customer complaints relevant to the seller's product (specific, paraphrased from real reviews)
   - patterns: array of 1-2 notable patterns across multiple reviews relevant to the seller's product
   If no specific reviews were found, set this to null.` : 'null (no Perplexity key)'}

3. vertical_pain_points: ${config.perplexityKey && redditResearch ? `Array of 4-5 pain points that ${vertical} owners discuss on Reddit that the seller's product can address. Filter out unrelated pain points.` : 'null'}

4. likely_pain_points: Array of 3 specific pain points this business probably faces, each explicitly connected to a feature or capability of the seller's product.

5. talking_points: Array of 3 talking points, each referencing a specific finding from the research (reviews or Reddit) AND connecting it to a concrete capability of the seller's product.

6. suggested_opening: One personalized opening line that references a specific pain point from the research that the seller's product directly solves.

7. red_flags: Array of 1-3 red flags suggesting this might not be a good prospect. Empty array if none.

Return as JSON:
{
  "business_overview": "...",
  "customer_reviews": {
    "overall_rating": "..." or null,
    "praises": ["...", "...", "..."],
    "complaints": ["...", "...", "..."],
    "patterns": ["...", "..."]
  } or null,
  "vertical_pain_points": ["...", "...", "...", "..."] or null,
  "likely_pain_points": ["...", "...", "..."],
  "talking_points": ["...", "...", "..."],
  "suggested_opening": "...",
  "red_flags": [...]
}`,
        maxTokens: 2000,
      })

      setResults(typeof brief === 'object' ? brief : {})
    } catch (e) {
      setError(e.message || 'Something went wrong. Please check your API key and try again.')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const buildFullBrief = () => {
    if (!results) return ''
    const reviewsText = results.customer_reviews
      ? [
          results.customer_reviews.overall_rating ? `Rating: ${results.customer_reviews.overall_rating}` : '',
          results.customer_reviews.praises?.length ? `Praises: ${results.customer_reviews.praises.join('; ')}` : '',
          results.customer_reviews.complaints?.length ? `Complaints: ${results.customer_reviews.complaints.join('; ')}` : '',
          results.customer_reviews.patterns?.length ? `Patterns: ${results.customer_reviews.patterns.join('; ')}` : '',
        ].filter(Boolean).join('\n')
      : ''

    return [
      `PRE-CALL RESEARCH BRIEF: ${businessName}`,
      results.business_overview ? `\nBUSINESS OVERVIEW:\n${results.business_overview}` : '',
      reviewsText ? `\nWHAT CUSTOMERS SAY:\n${reviewsText}` : '',
      results.vertical_pain_points?.length ? `\nWHAT ${vertical.toUpperCase()} OWNERS STRUGGLE WITH (Reddit):\n${results.vertical_pain_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : '',
      results.likely_pain_points?.length ? `\nLIKELY PAIN POINTS FOR THIS BUSINESS:\n${results.likely_pain_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : '',
      results.talking_points?.length ? `\nRECOMMENDED TALKING POINTS:\n${results.talking_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : '',
      results.suggested_opening ? `\nSUGGESTED OPENING LINE:\n"${results.suggested_opening}"` : '',
      results.red_flags?.length ? `\nRED FLAGS:\n${results.red_flags.map((w, i) => `${i + 1}. ${w}`).join('\n')}` : '',
    ].filter(Boolean).join('\n')
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Business Details</h3>
        <div className="field-group" style={{ marginBottom: 16 }}>
          <label className="label">Business Name <span style={{ color: 'var(--error)', fontSize: 12 }}>*</span></label>
          <input
            className="input-field"
            type="text"
            placeholder="e.g., Smile Dental Care"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
          />
        </div>
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="field-group">
            <label className="label">Business Website <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g., smiledentalcare.com"
              value={website}
              onChange={e => setWebsite(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="label">Business Location <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional — improves review search)</span></label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g., Austin, TX"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
        </div>

        {!config.perplexityKey && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(229,169,27,0.1)', border: '1px solid rgba(229,169,27,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--warning)' }}>
            💡 Add your Perplexity API key above to unlock customer reviews, Reddit research, and web search
          </div>
        )}

        <button className="btn btn-primary" onClick={research} disabled={loading}>
          {loading ? loadingStep || 'Researching...' : '🔍 Research This Business'}
        </button>
      </div>

      {error && <div className="error-card" style={{ marginBottom: 24 }}>⚠️ {error}</div>}

      {loading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <SkeletonLoader label={loadingStep || 'Researching...'} />
        </div>
      )}

      {results && (
        <>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontWeight: 700, fontSize: 18 }}>Research Brief: {businessName}</h3>
            <CopyButton text={buildFullBrief()} label="Copy Full Brief" />
          </div>

          {/* Business Overview */}
          {results.business_overview && (
            <BriefSection icon="🏢" title="Business Overview" color="var(--accent)" badge="Web" badgeColor="#3B8AE0">
              <p style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>{results.business_overview}</p>
            </BriefSection>
          )}

          {/* What Customers Say */}
          {results.customer_reviews ? (
            <BriefSection icon="⭐" title="What Customers Say" color="#45B36B" badge="Customer Reviews" badgeColor="#45B36B">
              {results.customer_reviews.overall_rating && (
                <div style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(69,179,107,0.1)', border: '1px solid rgba(69,179,107,0.25)', borderRadius: 20 }}>
                  <span style={{ fontSize: 16 }}>⭐</span>
                  <span style={{ fontWeight: 600, color: '#45B36B', fontSize: 14 }}>{results.customer_reviews.overall_rating}</span>
                </div>
              )}
              {results.customer_reviews.praises?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#45B36B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>What customers love</p>
                  <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {results.customer_reviews.praises.map((praise, i) => (
                      <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{praise}</li>
                    ))}
                  </ul>
                </div>
              )}
              {results.customer_reviews.complaints?.length > 0 && (
                <div style={{ marginBottom: results.customer_reviews.patterns?.length > 0 ? 14 : 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>What customers complain about</p>
                  <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {results.customer_reviews.complaints.map((complaint, i) => (
                      <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{complaint}</li>
                    ))}
                  </ul>
                </div>
              )}
              {results.customer_reviews.patterns?.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Patterns across reviews</p>
                  <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {results.customer_reviews.patterns.map((pattern, i) => (
                      <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>{pattern}</li>
                    ))}
                  </ul>
                </div>
              )}
            </BriefSection>
          ) : config.perplexityKey ? (
            <div style={{ marginBottom: 16, padding: '14px 18px', background: 'rgba(69,179,107,0.06)', border: '1px solid rgba(69,179,107,0.2)', borderRadius: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              ⭐ <strong style={{ color: '#45B36B' }}>No specific customer reviews found.</strong> Try adding the business location for better results.
            </div>
          ) : null}

          {/* What Owners in This Vertical Struggle With */}
          {results.vertical_pain_points && results.vertical_pain_points.length > 0 && (
            <BriefSection icon="🗣️" title={`What ${vertical} Owners Struggle With`} color="#FF6B47" badge="Reddit" badgeColor="#FF6B47">
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.vertical_pain_points.map((point, i) => (
                  <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{point}</li>
                ))}
              </ul>
            </BriefSection>
          )}

          {!config.perplexityKey && (
            <div style={{ marginBottom: 16, padding: '14px 18px', background: 'rgba(229,169,27,0.08)', border: '1px solid rgba(229,169,27,0.2)', borderRadius: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              🗣️ <strong style={{ color: 'var(--warning)' }}>Customer Reviews & Reddit research not included.</strong> Add your Perplexity API key in the setup section to unlock these sources.
            </div>
          )}

          {/* Likely Pain Points for This Business */}
          {results.likely_pain_points?.length > 0 && (
            <BriefSection icon="🎯" title="Likely Pain Points for This Business" color="var(--warning)">
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.likely_pain_points.map((point, i) => (
                  <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{point}</li>
                ))}
              </ul>
            </BriefSection>
          )}

          {/* Recommended Talking Points */}
          {results.talking_points?.length > 0 && (
            <BriefSection icon="💬" title="Recommended Talking Points" color="var(--success)">
              <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.talking_points.map((point, i) => (
                  <li key={i} style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{point}</li>
                ))}
              </ol>
            </BriefSection>
          )}

          {/* Suggested Opening Line */}
          {results.suggested_opening && (
            <BriefSection icon="🚀" title="Suggested Opening Line" color="var(--accent)">
              <div style={{ borderLeft: '3px solid var(--accent)', padding: '12px 16px', background: 'rgba(15,110,86,0.05)', borderRadius: '0 8px 8px 0' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 15, fontStyle: 'italic', lineHeight: 1.7 }}>"{results.suggested_opening}"</p>
              </div>
              <div style={{ marginTop: 10 }}>
                <CopyButton text={results.suggested_opening} label="Copy Opening Line" />
              </div>
            </BriefSection>
          )}

          {/* Red Flags */}
          {results.red_flags?.length > 0 && (
            <BriefSection icon="🚩" title="Red Flags" color="var(--error)">
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.red_flags.map((flag, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{flag}</li>
                ))}
              </ul>
            </BriefSection>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <button className="btn btn-secondary" onClick={research}>↺ Regenerate</button>
          </div>

          <OrbitalCTA vertical={vertical} />

          <ProspectContactsSection vertical={vertical} />
        </>
      )}
    </div>
  )
}

function BriefSection({ icon, title, color, badge, badgeColor, children }) {
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: `${badgeColor}22`,
            color: badgeColor || 'var(--accent)',
            border: `1px solid ${badgeColor}44`,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function ProspectContactsSection({ vertical }) {
  const count = VERTICAL_COUNTS[vertical] || 'thousands of'
  const contacts = VERTICAL_CONTACTS[vertical] || DEFAULT_CONTACTS
  const countIsNumber = count !== 'thousands of'
  const locationLabel = 'the US'

  return (
    <div style={{
      marginTop: 24,
      background: '#141416',
      border: '1px solid rgba(15,110,86,0.35)',
      borderRadius: 12,
      padding: '24px',
      boxShadow: '0 0 24px rgba(15,110,86,0.08)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0F6E56, #16A87F)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0,
        }}>O</div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '3px 10px', borderRadius: 20,
          background: 'rgba(15,110,86,0.15)', color: '#0F6E56',
          border: '1px solid rgba(15,110,86,0.35)',
        }}>Orbital</span>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
          Prospect Contacts in This Vertical
        </h3>
      </div>

      {/* Subline */}
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, paddingLeft: 38 }}>
        Orbital found{' '}
        <strong style={{ color: '#0F6E56' }}>
          {countIsNumber ? count : count}{' '}{vertical || 'SMB'}
        </strong>{' '}
        businesses in {locationLabel}. Here's a preview:
      </p>

      {/* Contact cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {contacts.map((contact, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.025)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '14px 18px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Frosted overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(15,110,86,0.04) 0%, rgba(0,0,0,0.12) 100%)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', filter: 'blur(1.5px)', userSelect: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{contact.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>·</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{contact.title}</span>
              </div>
              <div style={{ fontSize: 13, color: '#0F6E56', fontWeight: 500, marginBottom: 6 }}>{contact.business}</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📍 {contact.location}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📞 {contact.phone}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>✉️ {contact.email}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a
        href="https://withorbital.com/?utm_source=smb-toolkit&utm_medium=tool&utm_campaign=precall-research"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', padding: '14px 24px',
          background: '#0F6E56', color: '#fff',
          borderRadius: 8, fontWeight: 700, fontSize: 14,
          textDecoration: 'none', transition: 'all 0.2s ease',
          boxShadow: '0 0 20px rgba(15,110,86,0.25)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#138D6E'
          e.currentTarget.style.boxShadow = '0 0 28px rgba(15,110,86,0.4)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#0F6E56'
          e.currentTarget.style.boxShadow = '0 0 20px rgba(15,110,86,0.25)'
        }}
      >
        Unlock all {countIsNumber ? count : ''} contacts with verified emails and phone numbers → Get 100 Free Leads
      </a>
    </div>
  )
}
