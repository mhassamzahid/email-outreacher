import type { PromptKind, PromptVersion } from "./types"

// Starting points for new prompts. Each one already returns the JSON shape the app expects,
// so a new template works before it is customised.

type Starter = Pick<PromptVersion, "systemPrompt" | "userPrompt" | "temperature" | "maxTokens">

export const PROMPT_STARTERS: Record<PromptKind, Starter> = {
  verify: {
    systemPrompt: "You decide whether a company is a good prospect for an outreach campaign. Judge only from the evidence given; when it's thin, score lower.",
    userPrompt: `The ICP: {{icp.name}} ({{icp.industry}})
Who they are: {{icp.description}}
Matching rules:
{{icp.rules}}

The company: {{company.name}} ({{company.domain}}), {{company.location}}
Apollo's data:
{{company.apollo}}
Instagram:
{{company.instagram}}
Website text:
{{company.website}}

Score this company's fit with the ICP from 0 to 100, with a one-sentence summary, reasons and concerns.`,
    temperature: 0,
    maxTokens: 4096,
  },
  hook: {
    systemPrompt: "You pick the single best personalization hook for a cold email. A weak or risky hook is worse than no hook.",
    userPrompt: `We sell to: {{icp.name}}
Our offer: {{icp.offer}}
Hook guidance: {{icp.hookGuidance}}

Lead: {{lead.firstName}} {{lead.lastName}}, {{lead.title}} at {{lead.company}}

Recent content:
{{items}}

Choose the one item that best connects to our offer. Never choose personal, sensitive or political posts.

Return JSON only:
{ "chosen_item": <item number or null>, "summary": "...", "hook": "<one sentence, max 25 words>", "relevance": <0-5>, "flags": [] }`,
    temperature: 0.2,
    maxTokens: 400,
  },
  email: {
    systemPrompt: "You write short, plain-text cold emails that sound like one person writing to another. Never invent facts.",
    userPrompt: `Write a cold email to {{lead.firstName}}, {{lead.title}} at {{lead.company}}.

Pains: {{icp.pains}}
Offer: {{icp.offer}}
Proof: {{icp.proof}}
Call to action: {{icp.cta}}
Tone: {{icp.tone}}
Never use: {{icp.wordsToAvoid}}

Hook (may be empty): {{hook.text}}

Rules
- 60 to 110 words.
- Open with the hook if there is one; otherwise open with their role or company.
- One clear call to action.

Return JSON only:
{ "subject": "...", "body": "...", "confidence": <0-100> }`,
    temperature: 0.7,
    maxTokens: 600,
  },
  score: {
    systemPrompt: "You score how safe and worthwhile a cold email is to send without a person checking it. When unsure, score lower.",
    userPrompt: `ICP: {{icp.name}} ({{icp.titles}})
Lead: {{lead.firstName}} {{lead.lastName}}, {{lead.title}} at {{lead.company}}

Content found:
{{items}}

Hook used: {{hook.text}}

Email
Subject: {{email.subject}}
{{email.body}}

Score from 0 to 100 for fit, hook quality and email quality. Score low for anything sensitive or unsupported.

Return JSON only:
{ "score": <0-100>, "reasons": ["...", "..."] }`,
    temperature: 0,
    maxTokens: 250,
  },
}

export const KIND_LABEL: Record<PromptKind, string> = {
  verify: "Company verification",
  hook: "Hook selection",
  email: "Email generation",
  score: "Email scoring",
}
