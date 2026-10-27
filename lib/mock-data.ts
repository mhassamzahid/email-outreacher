import type {
  EnrichmentItem,
  Generation,
  GenerationFlag,
  ICP,
  Lead,
  LeadStatus,
  MediaType,
  PromptTemplate,
  PromptVersion,
  Settings,
  Source,
  User,
  Workspace,
} from "./types"

// ---------------------------------------------------------------------------
// Helpers (deterministic so server and client render the same mock data)
// ---------------------------------------------------------------------------

export const MOCK_NOW = new Date("2026-10-26T12:00:00Z").getTime()
const DAY = 86_400_000

export function daysAgo(days: number, hours = 0): string {
  return new Date(MOCK_NOW - days * DAY - hours * 3_600_000).toISOString()
}

/** mulberry32: tiny seeded PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

export function leadSources(lead: Lead): Source[] {
  const out: Source[] = []
  if (lead.linkedinUrl) out.push("linkedin")
  if (lead.instagramUrl) out.push("instagram")
  if (lead.facebookUrl) out.push("facebook")
  if (lead.website) out.push("website")
  return out
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export const DEFAULT_HOOK_SYSTEM = `You pick the single best personalization hook for a cold email. You are precise and conservative: a weak or risky hook is worse than no hook.`

export const DEFAULT_HOOK_USER = `We sell to this ICP: {{icp.name}} ({{icp.titles}} in {{icp.industries}}).
Their main pains: {{icp.pains}}
Our offer: {{icp.offer}}
Hook guidance: {{icp.hookGuidance}}

Lead: {{lead.firstName}} {{lead.lastName}}, {{lead.title}} at {{lead.company}}.

Recent content from this lead and their company:
{{items}}

Choose the ONE item that best connects to our offer and their pains. Prefer recent, original posts (not reposts) about work topics.
Never choose posts about grief, illness, layoffs affecting them personally, politics, religion, or family matters. If those are the only items, return no hook.

Return JSON only:
{
  "chosen_item": <item number or null>,
  "summary": "<one sentence: what the item says>",
  "hook": "<one natural sentence referencing it, max 25 words, no flattery, no quoting more than 5 words>",
  "relevance": <0-5>,
  "flags": ["sensitive_topic" | "repost" | "old_content" | ...]
}
If nothing is relevant, return chosen_item null, relevance 0, hook "".`

export const DEFAULT_EMAIL_SYSTEM = `You write short, plain-text cold emails that sound like one busy person writing to another. No hype, no buzzwords, no exclamation marks, no "I hope this email finds you well".`

export const DEFAULT_EMAIL_USER = `Write a cold email to {{lead.firstName}}, {{lead.title}} at {{lead.company}}.

ICP context
- Pains: {{icp.pains}}
- Offer: {{icp.offer}}
- Proof: {{icp.proof}}
- Call to action: {{icp.cta}}
- Tone: {{icp.tone}}
- Never use these words: {{icp.wordsToAvoid}}

Personalization hook (may be empty): {{hook.text}}
Source of hook: {{hook.source}}, {{hook.date}}

Example of an email in our voice:
{{icp.exampleEmail}}

Rules
- 60 to 110 words. 2 to 4 short paragraphs.
- If a hook is provided, open with it naturally and connect it to one pain in the next sentence. Mention the content only once.
- If no hook is provided, open with a relevant observation about their role or company instead. Do not invent facts.
- One clear, low-friction call to action.
- Subject line: 2 to 6 words, lowercase, no clickbait.

Return JSON only:
{ "subject": "...", "body": "...", "confidence": <0-100> }`

const HOOK_USER_V1 = `We sell to {{icp.name}}.
Our offer: {{icp.offer}}

Lead: {{lead.firstName}} {{lead.lastName}}, {{lead.title}} at {{lead.company}}.

Recent content:
{{items}}

Pick the item that best connects to our offer and write a one sentence hook referencing it.

Return JSON only:
{ "chosen_item": <item number or null>, "hook": "<one sentence>", "relevance": <0-5> }`

const HOOK_USER_V2 = `We sell to this ICP: {{icp.name}} ({{icp.titles}} in {{icp.industries}}).
Their main pains: {{icp.pains}}
Our offer: {{icp.offer}}

Lead: {{lead.firstName}} {{lead.lastName}}, {{lead.title}} at {{lead.company}}.

Recent content from this lead and their company:
{{items}}

Choose the ONE item that best connects to our offer and their pains. Prefer recent posts about work topics.
Never choose posts about grief, illness, politics or religion.

Return JSON only:
{
  "chosen_item": <item number or null>,
  "summary": "<one sentence: what the item says>",
  "hook": "<one natural sentence referencing it, max 30 words>",
  "relevance": <0-5>
}
If nothing is relevant, return chosen_item null, relevance 0, hook "".`

const EMAIL_USER_V1 = `Write a cold email to {{lead.firstName}}, {{lead.title}} at {{lead.company}}.

Offer: {{icp.offer}}
Proof: {{icp.proof}}
Call to action: {{icp.cta}}

Open with this hook if present: {{hook.text}}

Keep it under 120 words. Plain text.

Return JSON only:
{ "subject": "...", "body": "...", "confidence": <0-100> }`

const STRICT_HOOK_USER = `ICP: {{icp.name}}. Offer: {{icp.offer}}
Hook guidance: {{icp.hookGuidance}}

Lead: {{lead.firstName}} {{lead.lastName}}, {{lead.title}} at {{lead.company}}.

Content:
{{items}}

Only choose an item if it is clearly about their business: launches, hiring, team growth, events, market commentary.
Skip reposts. Skip anything personal, religious, seasonal or holiday related. Skip anything older than 60 days.
When in doubt, return no hook.

Return JSON only:
{ "chosen_item": <item number or null>, "summary": "...", "hook": "<max 20 words>", "relevance": <0-5>, "flags": [] }`

const SHORT_EMAIL_USER = `Write a very short cold email to {{lead.firstName}} at {{lead.company}}.

Offer: {{icp.offer}}
Call to action: {{icp.cta}}
Tone: {{icp.tone}}
Avoid: {{icp.wordsToAvoid}}
Hook (may be empty): {{hook.text}}

Rules
- 40 to 70 words, 2 or 3 short paragraphs.
- If there is a hook, open with it. Otherwise open with one line about their brand.
- Subject: 2 to 4 words, lowercase.

Return JSON only:
{ "subject": "...", "body": "...", "confidence": <0-100> }`

export const DEFAULT_SCORE_SYSTEM = `You score how safe and worthwhile a cold email is to send without a person checking it first. You are strict: when unsure, score lower so a person reviews it.`

export const DEFAULT_SCORE_USER = `ICP: {{icp.name}} ({{icp.titles}} in {{icp.industries}})
Pains: {{icp.pains}}
Offer: {{icp.offer}}
Proof we can claim: {{icp.proof}}

Lead: {{lead.firstName}} {{lead.lastName}}, {{lead.title}} at {{lead.company}} ({{lead.website}})

Content found for this lead:
{{items}}

Hook used (may be empty): {{hook.text}}

Drafted email
Subject: {{email.subject}}
{{email.body}}

Score from 0 to 100:
- Fit, up to 40: does the lead match the ICP's titles and industries?
- Hook, up to 30: is the opening grounded in a real, recent, relevant item? With no hook, at most 10.
- Email, up to 30: does it read naturally, follow the rules, avoid invented facts and end on one clear call to action?
Subtract 30 for anything sensitive (grief, illness, politics, religion, family) or any claim the proof does not support.

Return JSON only:
{ "score": <0-100>, "reasons": ["<short reason>", "..."] }
Give 2 to 4 reasons, most important first.`

const SCORE_USER_V1 = `Lead: {{lead.firstName}} {{lead.lastName}}, {{lead.title}} at {{lead.company}}
ICP: {{icp.name}}

Email:
{{email.subject}}
{{email.body}}

How good is this lead and email, from 0 to 100?

Return JSON only:
{ "score": <0-100>, "reasons": ["..."] }`

export const promptTemplates: PromptTemplate[] = [
  { id: "tpl_hook_default", name: "Default hook selection", kind: "hook", isDefault: true, currentVersionId: "pv_hook_default_3" },
  { id: "tpl_hook_strict", name: "Strict hook (business topics only)", kind: "hook", isDefault: false, currentVersionId: "pv_hook_strict_1" },
  { id: "tpl_email_default", name: "Default email writer", kind: "email", isDefault: true, currentVersionId: "pv_email_default_2" },
  { id: "tpl_email_short", name: "Short and direct", kind: "email", isDefault: false, currentVersionId: "pv_email_short_1" },
  { id: "tpl_score_default", name: "Default lead scoring", kind: "score", isDefault: true, currentVersionId: "pv_score_default_2" },
]

export const promptVersions: PromptVersion[] = [
  {
    id: "pv_hook_default_1", templateId: "tpl_hook_default", version: 1,
    systemPrompt: "You pick the best personalization hook for a cold email.",
    userPrompt: HOOK_USER_V1, model: "gpt-6.1-sol", temperature: 0.4, maxTokens: 300,
    note: "Initial version", createdAt: daysAgo(83),
  },
  {
    id: "pv_hook_default_2", templateId: "tpl_hook_default", version: 2,
    systemPrompt: DEFAULT_HOOK_SYSTEM,
    userPrompt: HOOK_USER_V2, model: "gpt-6.1-sol", temperature: 0.3, maxTokens: 400,
    note: "Added pains and sensitive topic rules after a hook referenced a bereavement post", createdAt: daysAgo(54),
  },
  {
    id: "pv_hook_default_3", templateId: "tpl_hook_default", version: 3,
    systemPrompt: DEFAULT_HOOK_SYSTEM,
    userPrompt: DEFAULT_HOOK_USER, model: "gpt-6.1-sol", temperature: 0.2, maxTokens: 400,
    note: "Hook guidance per ICP, 25 word cap, flags in output", createdAt: daysAgo(25),
  },
  {
    id: "pv_hook_strict_1", templateId: "tpl_hook_strict", version: 1,
    systemPrompt: DEFAULT_HOOK_SYSTEM,
    userPrompt: STRICT_HOOK_USER, model: "gpt-6.1-sol", temperature: 0.1, maxTokens: 300,
    note: "Stricter variant for regions where personal or religious references land badly", createdAt: daysAgo(31),
  },
  {
    id: "pv_email_default_1", templateId: "tpl_email_default", version: 1,
    systemPrompt: "You write short, plain-text cold emails.",
    userPrompt: EMAIL_USER_V1, model: "gpt-6.1-sol", temperature: 0.8, maxTokens: 500,
    note: "Initial version", createdAt: daysAgo(83),
  },
  {
    id: "pv_email_default_2", templateId: "tpl_email_default", version: 2,
    systemPrompt: DEFAULT_EMAIL_SYSTEM,
    userPrompt: DEFAULT_EMAIL_USER, model: "gpt-6.1-sol", temperature: 0.7, maxTokens: 600,
    note: "Word count range, no-hook fallback, lowercase subjects", createdAt: daysAgo(36),
  },
  {
    id: "pv_email_short_1", templateId: "tpl_email_short", version: 1,
    systemPrompt: DEFAULT_EMAIL_SYSTEM,
    userPrompt: SHORT_EMAIL_USER, model: "gpt-6.1-sol", temperature: 0.7, maxTokens: 400,
    note: "Shorter format for e-commerce founders who read on mobile", createdAt: daysAgo(19),
  },
  {
    id: "pv_score_default_1", templateId: "tpl_score_default", version: 1,
    systemPrompt: "You score cold emails.",
    userPrompt: SCORE_USER_V1, model: "gpt-6-luna", temperature: 0.2, maxTokens: 200,
    note: "Initial version", createdAt: daysAgo(21),
  },
  {
    id: "pv_score_default_2", templateId: "tpl_score_default", version: 2,
    systemPrompt: DEFAULT_SCORE_SYSTEM,
    userPrompt: DEFAULT_SCORE_USER, model: "gpt-6-luna", temperature: 0, maxTokens: 250,
    note: "Fit, hook and email weighted 40/30/30; sensitive content and unsupported claims cost 30", createdAt: daysAgo(9),
  },
]

// ---------------------------------------------------------------------------
// ICPs
// ---------------------------------------------------------------------------

export const icps: ICP[] = [
  {
    id: "icp_saas",
    name: "B2B SaaS founders (10–50 employees)",
    description: "Founder-led SaaS companies between seed and Series A that have not built a repeatable outbound motion yet.",
    titles: ["Founder", "Co-founder", "CEO"],
    industries: ["B2B SaaS", "Dev tools", "Fintech", "HR tech"],
    companySize: "10–50",
    locations: ["United States", "Canada", "United Kingdom"],
    pains: "Founders are still the whole sales team. Pipeline is lumpy month to month. First sales hires ramp slowly because there is no outbound playbook to inherit.",
    offer: "We set up and run outbound for SaaS teams under 50 people: targeting, copy and sending infrastructure, with the founder approving every message.",
    proof: "We work with seed and Series A SaaS teams in dev tools, fintech and HR tech. References available on request.",
    cta: "Ask if they are open to a 15 minute call next week.",
    tone: "Direct, peer to peer, founder to founder. Plain language.",
    exampleEmail: "Hi Sam,\n\nSaw you're hiring your first AE. Most founders we talk to want that hire to walk into a pipeline that already works, not build one from zero.\n\nWe set up and run outbound for SaaS teams your size, and you approve every message before it goes out.\n\nWorth a 15 minute call next week to see if it fits?\n\nAlex",
    wordsToAvoid: "synergy, leverage, game-changer, revolutionize, cutting-edge, quick question",
    hookGuidance: "Best hooks: hiring for sales roles, funding news, launches, posts about pipeline or growth. Avoid personal life posts.",
    enabledSources: ["linkedin", "website"],
    hookPromptId: null,
    emailPromptId: null,
    createdAt: daysAgo(80),
    updatedAt: daysAgo(6),
  },
  {
    id: "icp_uae_re",
    name: "Real estate agencies, UAE",
    description: "RERA-registered brokerages in Dubai and Abu Dhabi with 10+ agents and meaningful portal spend.",
    titles: ["Managing Director", "CEO", "Founder", "Head of Sales", "Sales Director"],
    industries: ["Real estate brokerage", "Off-plan sales", "Property management"],
    companySize: "10–200",
    locations: ["Dubai", "Abu Dhabi"],
    pains: "Portal leads go cold before an agent replies. Agents cherry-pick leads. Management has no visibility on response times. Portal spend is high with unclear return.",
    offer: "We set up WhatsApp and CRM follow-up so every portal lead gets a reply within minutes, day or night, and agents only handle qualified viewings.",
    proof: "Working with RERA-registered brokerages in Dubai and Abu Dhabi. Happy to share a walkthrough of a live setup.",
    cta: "Offer a 20 minute walkthrough of the setup.",
    tone: "Professional, respectful, concise. Business English, no slang.",
    exampleEmail: "Hi Khalid,\n\nCongratulations on the Business Bay launch. Launch weeks usually bring more portal enquiries than agents can answer quickly, and the slow replies are the ones that go cold.\n\nWe set up WhatsApp and CRM follow-up so every lead gets a reply within minutes, and your agents only see qualified viewings.\n\nWould a 20 minute walkthrough of a live setup be useful?\n\nBest,\nAlex",
    wordsToAvoid: "cheap, guaranteed, best in Dubai, quick question, hope you're well",
    hookGuidance: "Good hooks: new launches, team growth, portal performance, events like Cityscape. Never use religious or holiday posts.",
    enabledSources: ["linkedin", "instagram", "facebook", "website"],
    hookPromptId: "tpl_hook_strict",
    emailPromptId: null,
    createdAt: daysAgo(62),
    updatedAt: daysAgo(2),
  },
  {
    id: "icp_ecom",
    name: "E-commerce brand owners",
    description: "US apparel and fashion DTC brands on Shopify, spending on Meta and feeling the squeeze on ROAS.",
    titles: ["Founder", "Co-founder", "CEO", "Head of Growth", "Head of Ecommerce"],
    industries: ["Apparel", "Fashion", "Activewear", "Footwear"],
    companySize: "5–100",
    locations: ["United States"],
    pains: "Rising Meta CPMs and sliding ROAS. Creative fatigue. Low AOV. Discount dependence around BFCM that hurts Q1 margins.",
    offer: "Meta ads and landing page CRO for apparel brands, focused on profitable new customer acquisition and higher AOV.",
    proof: "We work with US apparel and fashion brands on Meta ads, CRO, offers and AOV. Case studies available on request.",
    cta: "Offer a free teardown of their current Meta account structure and top landing page.",
    tone: "Confident, friendly, specific. Sounds like a growth marketer, not an agency pitch.",
    exampleEmail: "Hi Ashley,\n\nThe new heavyweight hoodie colorways look great. Drops like that usually spike CPMs for a week while Meta figures out who to show them to.\n\nWe run Meta ads and landing page CRO for apparel brands, with a focus on new customer profit, not just ROAS.\n\nHappy to send a free teardown of your account structure and top landing page if useful.\n\nAlex",
    wordsToAvoid: "scale, crush, explode, 10x, skyrocket, quick question",
    hookGuidance: "Good hooks: new drops, collection launches, hiring for growth roles, posts about ads, returns or BFCM. Skip charity and personal posts.",
    enabledSources: ["linkedin", "instagram", "facebook", "website"],
    hookPromptId: null,
    emailPromptId: "tpl_email_short",
    createdAt: daysAgo(40),
    updatedAt: daysAgo(1),
  },
]

// ---------------------------------------------------------------------------
// Content pools (what the mock "scraper" finds and what the mock "LLM" says about it)
// ---------------------------------------------------------------------------

export interface PostSeed {
  text: string
  summary: string
  hook: string
  mediaType: MediaType
  repost?: boolean
  sensitive?: boolean
  /** Website path, for website items. */
  path?: string
}

type Pool = Record<Source, PostSeed[]>

export const contentPools: Record<string, Pool> = {
  icp_saas: {
    linkedin: [
      { mediaType: "text", text: "We just crossed 40 paying teams. Still no sales hire. Every deal so far came from founder-led outreach and a lot of late nights. Next quarter that has to change.", summary: "The company reached 40 paying teams on founder-led sales alone and wants to change that next quarter.", hook: "Saw your post about reaching 40 paying teams without a sales hire, that is a lot of founder-led selling." },
      { mediaType: "text", text: "Hiring our first AE. Honest question for other founders: did you hire before or after you had a repeatable outbound motion?", summary: "They are hiring a first AE and asking whether to build outbound before or after the hire.", hook: "Your question about hiring the first AE before or after having repeatable outbound stuck with me." },
      { mediaType: "image", text: "Shipped SSO and audit logs this week. Enterprise prospects kept asking, so we finally did it. Huge credit to the platform team.", summary: "They shipped SSO and audit logs because enterprise prospects asked for them.", hook: "Noticed you shipped SSO and audit logs because enterprise prospects kept asking for them." },
      { mediaType: "text", text: "Spent the weekend rewriting our onboarding emails. Activation is the metric I lose sleep over right now.", summary: "The founder rewrote onboarding emails and is focused on activation.", hook: "Saw you spent a weekend rewriting onboarding emails to push activation." },
      { mediaType: "article", text: "Biggest lesson from SaaStr this year: nobody cares about your features until you name their problem in their words. Rewriting our homepage with that in mind.", summary: "After SaaStr they are rewriting their homepage around customer problems instead of features.", hook: "Liked your SaaStr takeaway about naming the customer's problem in their own words." },
      { mediaType: "text", repost: true, text: "Reposting this from a friend: a great thread on pricing page experiments that actually moved conversion.", summary: "A repost of someone else's thread on pricing page experiments.", hook: "Saw you shared that thread on pricing page experiments." },
      { mediaType: "text", text: "We moved from monthly to annual-first pricing. Churn conversations got a lot more honest, and earlier.", summary: "They switched to annual-first pricing and found churn conversations improved.", hook: "Your note on moving to annual-first pricing and getting more honest churn conversations was useful." },
      { mediaType: "carousel", text: "Two years in, 22 people, fully remote across 6 time zones. Here is what we got wrong about async, and what we would do again.", summary: "Reflections on running a 22 person fully remote team and lessons on async work.", hook: "Read your post on running a 22 person team across six time zones." },
      { mediaType: "text", text: "Cold email isn't dead, lazy cold email is. I reply to every personalized message I get, and ignore the rest.", summary: "The founder says they reply to personalized cold emails and ignore generic ones.", hook: "You mentioned you reply to every personalized cold email, so I'll keep this one specific." },
      { mediaType: "text", text: "Closed our seed extension. Grateful to the customers who took a chance on a tiny team before the product was ready.", summary: "They closed a seed extension and thanked early customers.", hook: "Congrats on closing the seed extension." },
    ],
    instagram: [
      { mediaType: "image", text: "Offsite in Lisbon. First time the whole team has been in one room.", summary: "Team offsite photo in Lisbon.", hook: "Saw the team made it to Lisbon for the first full offsite." },
      { mediaType: "video", text: "Behind the scenes of launch day: lots of coffee, one broken staging server, zero regrets.", summary: "A launch day behind-the-scenes video.", hook: "The launch day video with the broken staging server made me laugh." },
      { mediaType: "image", text: "Speaking at a founder meetup next week about pricing for small teams. Come say hi.", summary: "The founder is speaking about pricing for small teams at a meetup.", hook: "Saw you're speaking about pricing for small teams next week." },
    ],
    facebook: [
      { mediaType: "text", text: "We're hiring a founding account executive. Remote, US time zones. DM me if you know someone great.", summary: "They are hiring a founding AE, remote in US time zones.", hook: "Saw you're hiring a founding AE." },
      { mediaType: "image", text: "Proud of the team for shipping our biggest release of the year.", summary: "The team shipped their biggest release of the year.", hook: "Congrats on shipping the biggest release of the year." },
    ],
    website: [
      { mediaType: "page", path: "blog/usage-based-pricing", text: "Blog: Why we built a usage-based plan for teams under 50 seats.", summary: "A blog post explaining their usage-based plan for small teams.", hook: "Read your post on building a usage-based plan for teams under 50 seats." },
      { mediaType: "page", path: "careers", text: "Careers: Founding Account Executive, Head of Growth (both open, remote).", summary: "Careers page lists open Founding AE and Head of Growth roles.", hook: "Noticed the Founding AE and Head of Growth roles on your careers page." },
      { mediaType: "page", path: "changelog", text: "Changelog: New Salesforce and HubSpot sync, plus SOC 2 Type I complete.", summary: "Changelog shows CRM integrations and SOC 2 Type I completion.", hook: "Saw the HubSpot and Salesforce sync land in your changelog alongside SOC 2." },
      { mediaType: "page", path: "about", text: "About: Built by former operators who were tired of running the business from spreadsheets.", summary: "About page describes founders as former operators.", hook: "Liked the line on your about page about operators tired of spreadsheets." },
    ],
  },
  icp_uae_re: {
    linkedin: [
      { mediaType: "text", text: "Dubai Hills off-plan launches are moving faster than our team can follow up. Good problem, still a problem.", summary: "Off-plan launch demand is outpacing the team's follow-up capacity.", hook: "Your post about Dubai Hills launches moving faster than the team can follow up caught my eye." },
      { mediaType: "image", text: "Q3 is in: our busiest quarter since opening the Business Bay office. Thank you to every client and every agent.", summary: "Q3 was their busiest quarter since opening the Business Bay office.", hook: "Congratulations on the busiest quarter since opening the Business Bay office." },
      { mediaType: "image", text: "Welcoming six new agents to the team this month. Onboarding week starts Sunday.", summary: "They added six new agents this month.", hook: "Saw you welcomed six new agents this month." },
      { mediaType: "text", text: "Golden Visa enquiries are now close to half of our inbound from Europe. The questions are getting more specific too.", summary: "Golden Visa enquiries make up a large share of European inbound.", hook: "Interesting point about Golden Visa enquiries now making up so much of your European inbound." },
      { mediaType: "article", text: "Speaking at Cityscape Global on how agencies can respond faster to portal leads. Response time is the new commission split.", summary: "The leader is speaking at Cityscape about responding faster to portal leads.", hook: "Saw you're speaking at Cityscape about responding faster to portal leads." },
      { mediaType: "text", text: "We tested replying to every Property Finder lead within 5 minutes for a month. The difference in viewings booked was obvious.", summary: "Fast replies to Property Finder leads noticeably increased viewings.", hook: "Your five minute reply test on Property Finder leads is exactly the problem we work on." },
      { mediaType: "text", repost: true, text: "Reposting: RERA update on advertising permits, worth a read for every broker in Dubai.", summary: "A repost of a RERA update on advertising permits.", hook: "Saw you shared the RERA update on advertising permits." },
      { mediaType: "text", text: "Secondary market in JVC is heating up again. Investors are asking about yields, not views.", summary: "Investor interest in JVC secondary properties is rising, focused on yields.", hook: "Your note on JVC investors asking about yields rather than views matched what we hear." },
    ],
    instagram: [
      { mediaType: "image", text: "Just listed: 3 bed townhouse in Arabian Ranches 3. Viewings by appointment.", summary: "A new townhouse listing in Arabian Ranches 3.", hook: "Saw the new Arabian Ranches 3 townhouse listing." },
      { mediaType: "image", text: "Sold in 9 days. Congratulations to our clients on their new home in Dubai Marina.", summary: "A Dubai Marina property sold in nine days.", hook: "Nine days to sell in Dubai Marina is quick work." },
      { mediaType: "video", text: "Penthouse walkthrough, Palm Jumeirah. Full video on our page.", summary: "A walkthrough video of a Palm Jumeirah penthouse.", hook: "Saw the Palm Jumeirah penthouse walkthrough." },
      { mediaType: "image", text: "Our agents at Cityscape this year. Come say hi at the stand.", summary: "The team is exhibiting at Cityscape.", hook: "Saw your team is at Cityscape this year." },
    ],
    facebook: [
      { mediaType: "text", text: "Open house this Saturday in Damac Hills 2, 11am to 3pm.", summary: "An open house event in Damac Hills 2.", hook: "Saw the open house in Damac Hills 2 this weekend." },
      { mediaType: "text", text: "We're recruiting experienced off-plan consultants. Arabic and Russian speakers preferred.", summary: "They are hiring off-plan consultants.", hook: "Noticed you're recruiting off-plan consultants." },
      { mediaType: "image", sensitive: true, text: "Ramadan Kareem from all of us. Our offices will operate reduced hours this month.", summary: "A Ramadan greeting with office hours update.", hook: "" },
      { mediaType: "video", text: "Client story: a family relocating from London shares how they found their home in Mirdif.", summary: "A client testimonial video from a family relocating from London.", hook: "Liked the client story from the family relocating from London." },
    ],
    website: [
      { mediaType: "page", path: "services", text: "Services: off-plan sales, secondary market, property management, Golden Visa assistance.", summary: "Services page lists off-plan, secondary, management and Golden Visa.", hook: "Saw you cover off-plan, secondary and Golden Visa assistance under one roof." },
      { mediaType: "page", path: "blog/rental-yields-q3", text: "Blog: Dubai rental yields by community, updated for Q3.", summary: "A blog post on rental yields by community.", hook: "Read your Q3 rental yields by community breakdown." },
      { mediaType: "page", path: "careers", text: "Careers: Property consultants, lead coordinator.", summary: "Careers page lists consultant and lead coordinator roles.", hook: "Noticed you're hiring a lead coordinator." },
      { mediaType: "page", path: "about", text: "About: RERA-registered brokerage with offices in Business Bay and Abu Dhabi.", summary: "About page describes offices in Business Bay and Abu Dhabi.", hook: "Saw you run offices in both Business Bay and Abu Dhabi." },
    ],
  },
  icp_ecom: {
    linkedin: [
      { mediaType: "text", text: "Meta CPMs up again this month and our ROAS is sliding. Testing more UGC and fewer studio shots to see what holds.", summary: "Meta CPMs are rising and ROAS is falling, so they are testing UGC creative.", hook: "Your post about CPMs rising and testing more UGC over studio shots is the exact squeeze we see." },
      { mediaType: "image", text: "We launched our fall collection last week. Sell-through on outerwear beat our forecast.", summary: "The fall collection launched and outerwear sold through above forecast.", hook: "Congrats on the fall launch, outerwear beating forecast is a good problem." },
      { mediaType: "text", text: "Wholesale is now a big chunk of revenue. Trying to keep DTC margins healthy at the same time is the hard part.", summary: "Wholesale has grown and they are working to protect DTC margins.", hook: "Your note on protecting DTC margins while wholesale grows stood out." },
      { mediaType: "text", text: "Our returns rate on denim is the number I watch most. Fit is everything.", summary: "The founder tracks denim return rates closely and focuses on fit.", hook: "Saw you watch denim returns more closely than any other number." },
      { mediaType: "text", text: "Just moved to a 3PL in Texas. Shipping times to the West Coast finally make sense.", summary: "They moved fulfilment to Texas to improve West Coast shipping times.", hook: "Saw you moved to a Texas 3PL to fix West Coast shipping times." },
      { mediaType: "text", text: "Hiring a retention marketing manager. Email and SMS are under-loved here and I want that to change.", summary: "They are hiring a retention marketing manager for email and SMS.", hook: "Noticed you're hiring a retention marketing manager." },
      { mediaType: "text", repost: true, text: "Reposting: great breakdown of post-iOS attribution for DTC brands.", summary: "A repost of an article on post-iOS attribution.", hook: "Saw you shared that breakdown on post-iOS attribution." },
      { mediaType: "text", text: "BFCM planning starts now. Last year we discounted too deep and paid for it in Q1.", summary: "They are planning BFCM and want to avoid over-discounting this year.", hook: "Your point about discounting too deep last BFCM and paying for it in Q1 is a common one." },
    ],
    instagram: [
      { mediaType: "carousel", text: "New drop: the heavyweight hoodie in three new colorways.", summary: "A new hoodie drop in three colorways.", hook: "The new heavyweight hoodie colorways look great." },
      { mediaType: "video", text: "Behind the scenes at our shoot in Joshua Tree.", summary: "A behind-the-scenes video from a Joshua Tree photo shoot.", hook: "Saw the behind-the-scenes from the Joshua Tree shoot." },
      { mediaType: "image", text: "Restocked: the linen set sold out in 4 days last time.", summary: "The linen set is back in stock after selling out quickly.", hook: "Saw the linen set is back after selling out in four days." },
      { mediaType: "video", text: "Our founder on why we only use deadstock fabric.", summary: "A video about the brand's deadstock fabric sourcing.", hook: "Liked the video on why you only use deadstock fabric." },
      { mediaType: "image", text: "Pop-up this weekend in Austin. First 50 customers get a tote.", summary: "A weekend pop-up in Austin.", hook: "Saw the Austin pop-up this weekend." },
      { mediaType: "carousel", text: "Customer photos of the week. Thank you for tagging us.", summary: "A roundup of customer photos.", hook: "The customer photo roundups are great creative material." },
    ],
    facebook: [
      { mediaType: "text", text: "Free shipping on orders over $75 this week only.", summary: "A limited free shipping threshold promotion.", hook: "Saw the free shipping over $75 promo this week." },
      { mediaType: "image", text: "Meet the team behind our fit guide.", summary: "A post introducing the fit guide team.", hook: "Liked the post introducing the team behind your fit guide." },
      { mediaType: "image", text: "Sizing update: we've added extended sizes across our core range.", summary: "They added extended sizes across the core range.", hook: "Saw you added extended sizes across the core range." },
    ],
    website: [
      { mediaType: "page", path: "", text: "Homepage: Free returns within 30 days. Ethically made in Los Angeles.", summary: "Homepage highlights free returns and LA manufacturing.", hook: "Noticed the free 30 day returns front and center on your homepage." },
      { mediaType: "page", path: "about", text: "About: Started in a garage in 2019, now shipping to all 50 states.", summary: "About page tells the brand's garage-to-national story.", hook: "Liked the garage-to-50-states story on your about page." },
      { mediaType: "page", path: "collections", text: "Collections: Fall 2026, Essentials, Denim, Accessories.", summary: "Collections page shows Fall 2026, Essentials, Denim and Accessories.", hook: "Saw Fall 2026 is live next to your Essentials line." },
      { mediaType: "page", path: "blog/fit-xs-to-3xl", text: "Blog: How we design for fit across XS to 3XL.", summary: "A blog post on designing for fit across a wide size range.", hook: "Read your post on designing for fit from XS to 3XL." },
    ],
  },
}

/** Used for the one lead whose only content is a sensitive post. */
export const SENSITIVE_POST: PostSeed = {
  mediaType: "text",
  sensitive: true,
  text: "Taking a few weeks away to be with my dad after his diagnosis. The team has everything covered. Hug your people.",
  summary: "The founder is taking time off for a family health matter.",
  hook: "",
}

export function findPostSeed(icpId: string, item: EnrichmentItem): PostSeed | undefined {
  if (item.text === SENSITIVE_POST.text) return SENSITIVE_POST
  return contentPools[icpId]?.[item.source].find((p) => p.text === item.text)
}

// ---------------------------------------------------------------------------
// Email composition (stands in for the email writing LLM call)
// ---------------------------------------------------------------------------

interface EmailInput {
  lead: Lead
  hook: string
}

type EmailVariant = (i: EmailInput) => { subject: string; body: string }

const noHookOpener: Record<string, (l: Lead) => string> = {
  icp_saas: (l) => `As ${l.title.toLowerCase()} at ${l.company}, you're probably still closer to sales than you'd like to be.`,
  icp_uae_re: (l) => `Brokerages the size of ${l.company} usually get more portal enquiries than agents can answer quickly.`,
  icp_ecom: (l) => `Brands like ${l.company} are feeling Meta costs climb heading into Q4.`,
}

export const emailVariants: Record<string, EmailVariant[]> = {
  icp_saas: [
    ({ lead, hook }) => ({
      subject: "outbound before the ae",
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_saas(lead)} Most founders at ${lead.company}'s stage are still the whole sales team, which makes pipeline lumpy month to month.\n\nWe set up and run outbound for SaaS teams under 50 people. You approve every message before it goes out, so it still sounds like you.\n\nOpen to a 15 minute call next week?\n\nAlex`,
    }),
    ({ lead, hook }) => ({
      subject: `pipeline for ${lead.company.toLowerCase()}`,
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_saas(lead)} When a first sales hire joins without an outbound playbook to inherit, ramp tends to take far longer than planned.\n\nWe build that playbook and run it: targeting, copy and sending setup, with you signing off on every email.\n\nWorth 15 minutes next week to see if it fits?\n\nAlex`,
    }),
    ({ lead, hook }) => ({
      subject: "founder-led sales",
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_saas(lead)} That usually means outbound happens in the gaps between product and hiring, so it never gets consistent.\n\nWe run outbound for small SaaS teams in dev tools, fintech and HR tech, and the founder approves every message.\n\nWould a short call next week be useful?\n\nAlex`,
    }),
  ],
  icp_uae_re: [
    ({ lead, hook }) => ({
      subject: "portal lead response time",
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_uae_re(lead)} The enquiries that wait an hour for a reply are usually the ones that go cold.\n\nWe set up WhatsApp and CRM follow-up so every portal lead at ${lead.company} gets a reply within minutes, and your agents only handle qualified viewings.\n\nWould a 20 minute walkthrough of a live setup be useful?\n\nBest,\nAlex`,
    }),
    ({ lead, hook }) => ({
      subject: "after-hours enquiries",
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_uae_re(lead)} A lot of portal enquiries arrive after office hours, and by morning the buyer has already spoken to two other agencies.\n\nWe automate the first reply on WhatsApp and route qualified leads to the right agent, with response times visible to management.\n\nHappy to show you a 20 minute walkthrough.\n\nBest,\nAlex`,
    }),
    ({ lead, hook }) => ({
      subject: `lead follow-up at ${lead.company.toLowerCase()}`,
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_uae_re(lead)} When agents pick which leads to call back, the rest quietly disappear, and portal spend gets harder to justify.\n\nWe give every lead an instant WhatsApp reply and a clear owner in your CRM.\n\nWould a short walkthrough of how it works be helpful?\n\nBest,\nAlex`,
    }),
  ],
  icp_ecom: [
    ({ lead, hook }) => ({
      subject: "meta teardown",
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_ecom(lead)} That's usually when account structure starts costing more than the creative.\n\nWe run Meta ads and landing page CRO for apparel brands. Happy to send a free teardown of ${lead.company}'s account and top landing page.\n\nAlex`,
    }),
    ({ lead, hook }) => ({
      subject: "q4 without deep discounts",
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_ecom(lead)} Most apparel brands lean on discounts to hit Q4 numbers, then pay for it in Q1 margins.\n\nWe help brands raise AOV with bundles and offers instead. Want a free teardown of your Meta setup and top landing page?\n\nAlex`,
    }),
    ({ lead, hook }) => ({
      subject: "new customer profit",
      body: `Hi ${lead.firstName},\n\n${hook || noHookOpener.icp_ecom(lead)} Rising CPMs make it tempting to chase ROAS, but new customer profit is the number that compounds.\n\nWe do Meta ads and CRO for apparel brands. I can send a free teardown of ${lead.company}'s account if useful.\n\nAlex`,
    }),
  ],
}

export function composeEmail(icpId: string, lead: Lead, hook: string, variant: number) {
  const pool = emailVariants[icpId] ?? emailVariants.icp_saas
  return pool[Math.abs(variant) % pool.length]({ lead, hook })
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

// [firstName, lastName, company, title, domain, sources ("li ig fb")]
type LeadRow = [string, string, string, string, string, string]

const leadRows: Record<string, LeadRow[]> = {
  icp_saas: [
    ["Maya", "Chen", "Stackfold", "Co-founder & CEO", "stackfold.io", "li"],
    ["Daniel", "Okafor", "Tallyfin", "Founder", "tallyfin.com", "li fb"],
    ["Priya", "Raman", "Quorra Labs", "CEO", "quorralabs.io", "li ig"],
    ["Tom", "Lindqvist", "Pipewise", "Co-founder", "pipewise.app", "li"],
    ["Jessica", "Moreno", "Clearbook", "Founder & CEO", "clearbook.co", "li ig fb"],
    ["Ethan", "Brooks", "Fieldnote", "CEO", "fieldnote.io", "li"],
    ["Hannah", "Weiss", "Rosterly", "Co-founder & COO", "rosterly.com", "li fb"],
    ["Marcus", "Bell", "Shipyard Metrics", "Founder", "shipyardmetrics.com", "li"],
    ["Aisha", "Rahman", "Contour HR", "CEO", "contourhr.com", "li ig"],
    ["Leo", "Hartmann", "Patchwork Dev", "Co-founder & CTO", "patchwork.dev", "li"],
    ["Sofia", "Alvarez", "Loopdesk", "Founder", "loopdesk.io", "li ig"],
    ["Ryan", "Kim", "Vaultline", "CEO", "vaultline.com", "li"],
    ["Chloe", "Dubois", "Briefcase AI", "Co-founder", "briefcase.ai", "li fb"],
    ["Nathan", "Price", "Ordinal Health", "Founder & CEO", "ordinalhealth.com", "li"],
    ["Grace", "Liu", "Tidewater Analytics", "CEO", "tidewater.io", "li ig fb"],
    ["Omar", "Haddad", "Kitebase", "Co-founder", "kitebase.com", "li"],
    ["Emily", "Carter", "Formwell", "Founder", "formwell.app", "li"],
    ["Jacob", "Stein", "Linearity Ops", "CEO", "linearityops.com", "li fb"],
    ["Isabel", "Novak", "Parcelpoint", "Co-founder & CEO", "parcelpoint.io", "li"],
    ["Kevin", "Osei", "Benchmark Pay", "Founder", "benchmarkpay.com", "li"],
    ["Laura", "Fischer", "Cadence CRM", "CEO", "cadencecrm.io", "li ig"],
    ["Ben", "Adler", "Northwind Docs", "Founder", "", "li"],
    ["Zoe", "Martin", "Sprintboard", "Co-founder", "sprintboard.io", "li"],
    ["Arjun", "Mehta", "Ledgerline", "CEO", "ledgerline.co", "li fb"],
    ["Olivia", "Grant", "Helio Support", "Founder & CEO", "heliosupport.com", "li"],
  ],
  icp_uae_re: [
    ["Khalid", "Al Mansoori", "Palmline Properties", "Managing Director", "palmlineproperties.ae", "li ig fb"],
    ["Sara", "Haddad", "Crescent Key Realty", "CEO", "crescentkey.ae", "li ig"],
    ["James", "Whitfield", "Marina Gate Homes", "Founder", "marinagatehomes.com", "li ig fb"],
    ["Fatima", "Al Suwaidi", "Desert Rose Real Estate", "Head of Sales", "desertrose-re.ae", "li"],
    ["Viktor", "Petrov", "Skyline Brokers", "Sales Director", "skylinebrokers.ae", "li ig"],
    ["Noura", "Al Hashimi", "Azure Bay Realty", "Managing Partner", "azurebay.ae", "li fb"],
    ["Ahmed", "Farouk", "Golden Sands Estates", "CEO", "goldensandsestates.com", "li ig fb"],
    ["Rebecca", "Shaw", "Harbourview Property", "Director", "harbourview.ae", "li"],
    ["Rashid", "Al Nuaimi", "Oasis Point Realty", "Founder & CEO", "oasispoint.ae", "li ig"],
    ["Elena", "Volkova", "Prime Atlas Real Estate", "Managing Director", "primeatlas.ae", "li ig"],
    ["Youssef", "Benali", "Silverkey Homes", "Head of Off-Plan", "silverkeyhomes.com", "li"],
    ["Hana", "Al Marri", "Seastone Properties", "CEO", "seastone.ae", "li ig fb"],
    ["David", "Mercer", "Burj Line Realty", "Founder", "burjline.ae", "li"],
    ["Layla", "Nasser", "Meridian Homes Dubai", "Sales Director", "meridianhomes.ae", "li ig"],
    ["Omar", "Saleh", "Al Wasl Brokers", "Managing Director", "alwaslbrokers.ae", "li fb"],
    ["Chloe", "Bennett", "Bluewater Estates", "Director of Sales", "bluewaterestates.ae", "li ig"],
    ["Tariq", "Hamdan", "Creekside Realty", "CEO", "creeksiderealty.ae", "li"],
    ["Anna", "Kowalski", "Saffron Living", "Founder", "saffronliving.ae", "li ig"],
    ["Mohammed", "Al Falasi", "Jumeirah Crest Properties", "Managing Partner", "jumeirahcrest.ae", "li fb"],
    ["Lucas", "Moreau", "Lighthouse Realty", "CEO", "lighthouserealty.ae", "li"],
    ["Mariam", "Al Zaabi", "Pearl Coast Homes", "Head of Sales", "pearlcoast.ae", "li ig"],
    ["George", "Haddad", "Arcadia Brokers", "Founder", "arcadiabrokers.ae", "li"],
    ["Ingrid", "Larsen", "Nordic Key Real Estate", "Managing Director", "nordickey.ae", "li ig fb"],
    ["Samir", "Aziz", "Gateway Homes", "CEO", "gatewayhomes.ae", "li"],
    ["Natalie", "Ross", "Horizon Line Properties", "Director", "horizonline.ae", "li ig"],
  ],
  icp_ecom: [
    ["Ashley", "Turner", "Northbound Apparel", "Founder & CEO", "northboundapparel.com", "li ig fb"],
    ["Jordan", "Reyes", "Saltwater Denim", "Co-founder", "saltwaterdenim.com", "li ig"],
    ["Megan", "O'Brien", "Field & Fern", "Founder", "fieldandfern.co", "ig fb"],
    ["Tyler", "Nguyen", "Common Thread Co", "CEO", "commonthreadco.com", "li ig"],
    ["Brianna", "Scott", "Lumen Active", "Head of Growth", "lumenactive.com", "li ig"],
    ["Chris", "Walsh", "Ironwood Workwear", "Founder", "ironwoodworkwear.com", "li fb"],
    ["Natalie", "Kim", "Dune & Daisy", "Co-founder & Creative Director", "duneanddaisy.com", "ig"],
    ["Marcus", "Johnson", "Kindred Basics", "CEO", "kindredbasics.com", "li ig fb"],
    ["Sophie", "Bennett", "Wren Swim", "Founder", "wrenswim.com", "li ig"],
    ["Derek", "Holt", "Ridgeback Outdoor", "Head of Ecommerce", "ridgebackoutdoor.com", "li"],
    ["Camila", "Ortiz", "Solana Linen", "Founder & CEO", "solanalinen.com", "ig fb"],
    ["Ryan", "Foster", "Heavyweight Club", "Co-founder", "heavyweightclub.com", "li ig"],
    ["Lauren", "Price", "Mabel Kids", "Founder", "mabelkids.com", "ig fb"],
    ["Andre", "Williams", "Concrete Rose Apparel", "CEO", "concreteroseapparel.com", "li ig"],
    ["Hailey", "Brooks", "Atlas Knitwear", "Brand Director", "atlasknitwear.com", "li"],
    ["Ian", "Murphy", "Low Tide Surf Co", "Founder", "lowtidesurf.co", "ig"],
    ["Rachel", "Gordon", "Petal & Pine", "Co-founder", "petalandpine.com", "li ig fb"],
    ["Noah", "Davis", "Union Goods", "CEO", "uniongoods.co", "li"],
    ["Kayla", "Martinez", "Verve Studio", "Founder", "vervestudio.com", "ig"],
    ["Sean", "Patel", "Stride Footwear", "Head of Growth", "stridefootwear.com", "li"],
    ["Emma", "Larson", "Birch & Bloom", "Founder & CEO", "birchandbloom.com", "li ig"],
    ["Jason", "Cole", "Gridiron Goods", "Co-founder", "gridirongoods.com", "li fb"],
    ["Olivia", "Hart", "Hart & Hem", "Founder", "hartandhem.com", "ig"],
    ["Dylan", "Brooks", "Westside Thread", "CEO", "westsidethread.com", "li"],
    ["Mia", "Thompson", "Coastline Collective", "Founder", "coastlinecollective.co", "li ig"],
  ],
}

// Status by row index (25 rows per ICP). Each ICP is at a different point in its pipeline;
// row 7 is always a generated lead because NO_HOOK_ROWS points at it.
const plan = (counts: [LeadStatus, number][]): LeadStatus[] => counts.flatMap(([s, n]) => Array<LeadStatus>(n).fill(s))
const STATUS_PLANS: Record<string, LeadStatus[]> = {
  icp_saas: plan([["approved", 4], ["generated", 6], ["skipped", 2], ["enriched", 5], ["no_content", 3], ["failed", 1], ["imported", 4]]),
  icp_uae_re: plan([["approved", 7], ["generated", 4], ["skipped", 1], ["enriched", 3], ["no_content", 2], ["imported", 8]]),
  icp_ecom: plan([["approved", 2], ["generated", 9], ["skipped", 3], ["enriched", 6], ["no_content", 1], ["failed", 2], ["imported", 2]]),
}

/** Rows that get a generation without a hook (a normal state). */
const NO_HOOK_ROWS = new Set([7])
/** Row in icp_saas whose only content is a sensitive post. */
const SENSITIVE_ROW = { icpId: "icp_saas", index: 9 }

const extraFor: Record<string, (r: () => number) => Record<string, string>> = {
  icp_saas: (r) => ({
    employees: String(10 + Math.floor(r() * 40)),
    funding_stage: ["Seed", "Seed extension", "Series A"][Math.floor(r() * 3)],
  }),
  icp_uae_re: (r) => ({
    city: r() < 0.75 ? "Dubai" : "Abu Dhabi",
    agents: String(10 + Math.floor(r() * 90)),
  }),
  icp_ecom: (r) => ({
    platform: "Shopify",
    state: ["CA", "NY", "TX", "CO", "OR", "FL"][Math.floor(r() * 6)],
  }),
}

function buildLeads(): Lead[] {
  const out: Lead[] = []
  for (const icp of icps) {
    const r = seededRandom(icp.id.length * 977)
    leadRows[icp.id].forEach(([firstName, lastName, company, title, domain, src], i) => {
      const handle = slugify(`${firstName}-${lastName}`)
      const companySlug = slugify(company)
      const email = domain
        ? `${firstName.toLowerCase().replace(/[^a-z]/g, "")}@${domain}`
        : `${handle.replace(/-/g, ".")}.docs@gmail.com`
      out.push({
        id: `lead_${icp.id.replace("icp_", "")}_${String(i + 1).padStart(2, "0")}`,
        icpId: icp.id,
        firstName,
        lastName,
        email,
        company,
        title,
        website: domain ? `https://${domain}` : "",
        linkedinUrl: src.includes("li") ? `https://www.linkedin.com/in/${handle}` : "",
        instagramUrl: src.includes("ig") ? `https://www.instagram.com/${companySlug.replace(/-/g, "")}` : "",
        facebookUrl: src.includes("fb") ? `https://www.facebook.com/${companySlug.replace(/-/g, "")}` : "",
        extra: extraFor[icp.id](r),
        status: STATUS_PLANS[icp.id][i],
        score: null,
        createdAt: daysAgo(30 - Math.floor(i / 5), i),
      })
    })
  }
  return out
}

export const leads: Lead[] = buildLeads()

// ---------------------------------------------------------------------------
// Enrichment items
// ---------------------------------------------------------------------------

const HAS_CONTENT: LeadStatus[] = ["enriched", "generated", "approved", "skipped"]

export function itemUrl(lead: Lead, source: Source, seed: PostSeed, n: number): string {
  const id = (7_100_000_000 + n * 7919).toString()
  switch (source) {
    case "linkedin":
      return `${lead.linkedinUrl.replace("/in/", "/posts/")}_activity-${id}`
    case "instagram":
      return `https://www.instagram.com/p/${id.slice(-8).replace(/(\d)/g, (d) => "CxQaPbRmTz"[Number(d)])}/`
    case "facebook":
      return `${lead.facebookUrl}/posts/${id}`
    case "website":
      return `${lead.website}/${seed.path ?? ""}`
  }
}

/** Picks posts for a lead from the ICP pool. Shared by the seed data and the enrichment simulation. */
export function pickItemsForLead(
  lead: Lead,
  sources: Source[],
  count: number,
  r: () => number,
  idPrefix: string,
): EnrichmentItem[] {
  const pool = contentPools[lead.icpId]
  const candidates: Array<{ source: Source; seed: PostSeed }> = []
  for (const s of sources) for (const seed of pool[s]) candidates.push({ source: s, seed })
  // Shuffle deterministically, keep at most one website page and prefer LinkedIn first.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  candidates.sort((a, b) => Number(b.source === "linkedin") - Number(a.source === "linkedin"))
  const picked: typeof candidates = []
  let websiteCount = 0
  for (const c of candidates) {
    if (picked.length >= count) break
    if (c.source === "website" && websiteCount++ >= 1) continue
    picked.push(c)
  }
  return picked.map(({ source, seed }, i) => {
    const age = r() < 0.15 ? 61 + Math.floor(r() * 30) : 1 + Math.floor(r() * 55)
    return {
      id: `${idPrefix}_${i + 1}`,
      leadId: lead.id,
      source,
      url: itemUrl(lead, source, seed, i + lead.id.length),
      postedAt: source === "website" ? daysAgo(2) : daysAgo(age, Math.floor(r() * 20)),
      text: seed.text,
      mediaType: seed.mediaType,
    }
  })
}

function buildItems(): EnrichmentItem[] {
  const out: EnrichmentItem[] = []
  leads.forEach((lead, idx) => {
    if (!HAS_CONTENT.includes(lead.status)) return
    const icp = icps.find((i) => i.id === lead.icpId)!
    const rowIndex = Number(lead.id.slice(-2)) - 1
    if (lead.icpId === SENSITIVE_ROW.icpId && rowIndex === SENSITIVE_ROW.index) {
      out.push({
        id: `item_${lead.id}_1`,
        leadId: lead.id,
        source: "linkedin",
        url: `${lead.linkedinUrl.replace("/in/", "/posts/")}_activity-7188204411`,
        postedAt: daysAgo(9),
        text: SENSITIVE_POST.text,
        mediaType: SENSITIVE_POST.mediaType,
      })
      return
    }
    const r = seededRandom(idx * 131 + 7)
    const sources = leadSources(lead).filter((s) => icp.enabledSources.includes(s))
    const count = 2 + Math.floor(r() * 5)
    out.push(...pickItemsForLead(lead, sources, count, r, `item_${lead.id}`))
  })
  return out
}

export const enrichmentItems: EnrichmentItem[] = buildItems()

// ---------------------------------------------------------------------------
// Generations
// ---------------------------------------------------------------------------

export const COST_PER_GENERATION = 0.01

export function resolvePromptVersionId(templateId: string | null, kind: "hook" | "email"): string {
  const tpl =
    promptTemplates.find((t) => t.id === templateId) ??
    promptTemplates.find((t) => t.kind === kind && t.isDefault)!
  return tpl.currentVersionId
}

export function ageInDays(iso: string): number {
  return Math.floor((MOCK_NOW - new Date(iso).getTime()) / DAY)
}

/** Stand-in for the hook selection step: newest non-sensitive item, preferring originals. */
export function chooseHookItem(
  icpId: string,
  items: EnrichmentItem[],
  excludeIds: string[] = [],
): { item: EnrichmentItem; seed: PostSeed } | null {
  const usable = items
    .filter((it) => !excludeIds.includes(it.id))
    .map((item) => ({ item, seed: findPostSeed(icpId, item) }))
    .filter((x): x is { item: EnrichmentItem; seed: PostSeed } => !!x.seed && !x.seed.sensitive)
    .sort(
      (a, b) =>
        Number(!!a.seed.repost) - Number(!!b.seed.repost) ||
        b.item.postedAt.localeCompare(a.item.postedAt),
    )
  return usable[0] ?? null
}

const SOURCE_NAME: Record<Source, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", website: "website" }

const FLAG_PENALTY: Partial<Record<GenerationFlag, [number, string]>> = {
  sensitive_topic: [30, "Only sensitive content was found for this lead"],
  repost: [8, "The hook is a repost, not their own words"],
  old_content: [8, "The hook is over 60 days old"],
  low_relevance: [8, "The hook is only loosely related to the offer"],
  word_count: [6, "The email is outside the target length"],
}

/**
 * Stand-in for the scoring prompt: fit (title against the ICP), hook strength and draft quality,
 * minus penalties for flags. Returns up to four reasons, most important first.
 */
export function mockScore(
  icp: ICP,
  lead: Lead,
  gen: Pick<Generation, "chosenItemId" | "relevance" | "confidence" | "flags">,
  items: EnrichmentItem[],
  r: () => number,
): { value: number; reasons: string[] } {
  const reasons: [number, string][] = []
  const matched = icp.titles.find((t) => lead.title.toLowerCase().includes(t.toLowerCase()))
  const fit = matched ? 34 : lead.title ? 18 : 10
  reasons.push([
    matched ? 3 : 4,
    matched
      ? `Title matches the ICP (${matched})`
      : lead.title
        ? `"${lead.title}" is not one of the ICP's titles`
        : "No job title on the lead",
  ])
  const item = items.find((i) => i.id === gen.chosenItemId)
  const hook = item ? 8 + gen.relevance * 4 : 6
  reasons.push([
    item ? 2 : 5,
    item
      ? `Hook from a ${SOURCE_NAME[item.source]} ${item.source === "website" ? "page" : "post"}, relevance ${gen.relevance} of 5`
      : "No usable hook, so the email opens on their role",
  ])
  const email = Math.round(gen.confidence * 0.3)
  reasons.push([1, `Draft confidence ${gen.confidence} of 100`])
  let value = fit + hook + email + Math.round((r() - 0.5) * 6)
  for (const f of gen.flags) {
    const penalty = FLAG_PENALTY[f]
    if (!penalty) continue
    value -= penalty[0]
    reasons.push([penalty[0], penalty[1]])
  }
  return {
    value: Math.max(3, Math.min(98, value)),
    reasons: reasons.sort((a, b) => b[0] - a[0]).slice(0, 4).map(([, text]) => text),
  }
}

function buildGenerations(): Generation[] {
  const out: Generation[] = []
  leads.forEach((lead, idx) => {
    if (!["generated", "approved", "skipped"].includes(lead.status)) return
    const icp = icps.find((i) => i.id === lead.icpId)!
    const r = seededRandom(idx * 53 + 11)
    const rowIndex = Number(lead.id.slice(-2)) - 1
    const items = enrichmentItems.filter((it) => it.leadId === lead.id)
    const isSensitiveLead = lead.icpId === SENSITIVE_ROW.icpId && rowIndex === SENSITIVE_ROW.index
    const choice = NO_HOOK_ROWS.has(rowIndex) || isSensitiveLead ? null : chooseHookItem(icp.id, items)

    const flags: GenerationFlag[] = []
    let relevance = 0
    if (isSensitiveLead) flags.push("sensitive_topic")
    if (choice) {
      relevance = 2 + Math.floor(r() * 4)
      if (choice.seed.repost) flags.push("repost")
      if (choice.item.source !== "website" && ageInDays(choice.item.postedAt) > 60) flags.push("old_content")
      if (relevance < 3) flags.push("low_relevance")
    }
    const confidence = choice
      ? Math.min(96, 48 + relevance * 8 + Math.floor(r() * 14) - flags.length * 9)
      : 42 + Math.floor(r() * 16)

    const { subject, body } = composeEmail(icp.id, lead, choice?.seed.hook ?? "", idx)
    // A few approved emails in the UAE ICP have already gone out, so the Sent view has history.
    const sent = lead.status === "approved" && lead.icpId === "icp_uae_re" && rowIndex < 3
    if (sent) lead.status = "sent"
    const status =
      sent ? "sent" : lead.status === "approved" ? "approved" : lead.status === "skipped" ? "skipped" : rowIndex % 3 === 0 ? "edited" : "draft"

    out.push({
      id: `gen_${lead.id}`,
      leadId: lead.id,
      hookPromptVersionId: resolvePromptVersionId(icp.hookPromptId, "hook"),
      emailPromptVersionId: resolvePromptVersionId(icp.emailPromptId, "email"),
      chosenItemId: choice?.item.id ?? null,
      hook: choice?.seed.hook ?? "",
      relevance,
      subject,
      body,
      confidence,
      flags,
      status,
      editedBody: status === "edited" ? body.replace(/\n\n([^\n]+)\n\nAlex$/, "\n\n$1\n\nThanks,\nAlex") : null,
      costUsd: COST_PER_GENERATION,
      createdAt: daysAgo(3 - (idx % 3), idx % 12),
      sentAt: sent ? daysAgo(1, rowIndex + 2) : null,
      sentBy: sent ? "manual" : null,
    })
  })
  return out
}

export const generations: Generation[] = buildGenerations()

// Every lead with a draft has been through the scoring prompt.
generations.forEach((g, idx) => {
  const lead = leads.find((l) => l.id === g.leadId)!
  const icp = icps.find((i) => i.id === lead.icpId)!
  const items = enrichmentItems.filter((it) => it.leadId === lead.id)
  const { value, reasons } = mockScore(icp, lead, g, items, seededRandom(idx * 71 + 5))
  lead.score = { value, reasons, promptVersionId: "pv_score_default_2", scoredAt: g.createdAt }
})

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const settings: Settings = {
  defaultModel: "gpt-6.1-sol",
  postsPerLead: 5,
  maxPostAgeDays: 60,
  monthlyBudgetUsd: 150,
  spentThisMonthUsd: 118.62,
  scoring: { promptId: null, threshold: 80, autoSend: false, dailyAutoSendCap: 50 },
}

// ---------------------------------------------------------------------------
// Users and workspaces
// ---------------------------------------------------------------------------

export const workspaces: Workspace[] = [
  { id: "ws_aheadtech", name: "AheadTech360", description: "Main outbound for local service businesses.", createdAt: daysAgo(210) },
  { id: "ws_agency", name: "Agency clients", description: "Campaigns run on behalf of agency partners.", createdAt: daysAgo(96) },
  { id: "ws_eu", name: "EU expansion", description: "Pilot outreach to UK and Ireland.", createdAt: daysAgo(12) },
]

export const CURRENT_USER_ID = "usr_alex"

export const users: User[] = [
  { id: "usr_alex", name: "Alex Morgan", email: "alex@aheadtech360.com", role: "admin", workspaceIds: ["ws_aheadtech", "ws_agency", "ws_eu"], status: "active", lastActiveAt: daysAgo(0, 1), createdAt: daysAgo(210) },
  { id: "usr_jordan", name: "Jordan Lee", email: "jordan@aheadtech360.com", role: "admin", workspaceIds: ["ws_aheadtech", "ws_agency"], status: "active", lastActiveAt: daysAgo(2), createdAt: daysAgo(180) },
  { id: "usr_priya", name: "Priya Shah", email: "priya@aheadtech360.com", role: "management", workspaceIds: ["ws_aheadtech", "ws_eu"], status: "active", lastActiveAt: daysAgo(0, 5), createdAt: daysAgo(150) },
  { id: "usr_daniel", name: "Daniel Reyes", email: "daniel@aheadtech360.com", role: "management", workspaceIds: ["ws_agency"], status: "active", lastActiveAt: daysAgo(4), createdAt: daysAgo(90) },
  { id: "usr_omar", name: "Omar Farooq", email: "omar@aheadtech360.com", role: "sales", workspaceIds: ["ws_aheadtech"], status: "active", lastActiveAt: daysAgo(0, 3), createdAt: daysAgo(60) },
  { id: "usr_chloe", name: "Chloe Bennett", email: "chloe@aheadtech360.com", role: "sales", workspaceIds: ["ws_aheadtech", "ws_agency"], status: "active", lastActiveAt: daysAgo(1), createdAt: daysAgo(45) },
  { id: "usr_tom", name: "Tom Becker", email: "tom@aheadtech360.com", role: "sales", workspaceIds: ["ws_eu"], status: "invited", lastActiveAt: null, createdAt: daysAgo(3) },
  { id: "usr_lina", name: "Lina Haddad", email: "lina@aheadtech360.com", role: "sales", workspaceIds: ["ws_aheadtech"], status: "deactivated", lastActiveAt: daysAgo(38), createdAt: daysAgo(120) },
]
