import type { PromptKind, PromptVersion } from "./types"

// Short starting points for new prompts. The app always gets its answer in a fixed shape (structured
// outputs), so these describe the fields instead of asking for JSON. For the full, detailed versions,
// start from "A copy of" the default prompt of the same kind.

type Starter = Pick<PromptVersion, "systemPrompt" | "userPrompt" | "temperature" | "maxTokens" | "maxPosts">

export const PROMPT_STARTERS: Record<PromptKind, Starter> = {
  verify: {
    systemPrompt:
      "You decide whether a company is worth contacting. Judge ICP fit (is it the kind of business the ICP describes?) and product fit (would it want our product?) separately, then combine them into one score from 0 to 100. Use only the evidence given; when it's thin, score lower and say what's missing. Return a score, a one-sentence summary, up to 4 reasons and up to 4 concerns.",
    userPrompt: `## The company
{{company.name}} ({{company.domain}}), {{company.location}}
Apollo's data:
{{company.apollo}}
Instagram:
{{company.instagram}}
Recent Instagram posts:
{{company.posts}}
Website pages:
{{company.website}}

## Our ICP
{{icp.name}} ({{icp.industry}}): {{icp.description}}
Their pains: {{icp.pains}}
Matching rules:
{{icp.rules}}

## Our product
{{product.name}}: {{product.description}}
What it does for customers: {{product.value}}

Does this company fit the ICP, and would it want the product?`,
    temperature: 0,
    maxTokens: 4096,
    maxPosts: null,
  },
  hook: {
    systemPrompt:
      "You find hooks for a cold email to one person: specific, real details they or their company recently posted or did, which lead naturally to what we sell. Never invent anything, and skip sensitive topics. Return up to 5 hooks ranked best first, each with the post's number (or null for the website or profile), its source, the point, a one-sentence hook written to the person, why it fits, and a relevance from 0 to 5, plus any flags.",
    userPrompt: `The person: {{lead.fullName}}, {{lead.title}} at {{lead.company}}
Headline: {{lead.headline}}

Their LinkedIn posts:
{{posts.linkedin}}

Their Instagram posts:
{{posts.instagram}}

Their company's posts:
{{company.posts}}

Their company's website:
{{company.website}}

What we sell: {{product.name}}: {{product.value}}
Their pains: {{icp.pains}}
Hook guidance: {{icp.hookGuidance}}

Rank the best hooks, best first.`,
    temperature: 0.2,
    maxTokens: 4096,
    maxPosts: null,
  },
  email: {
    systemPrompt:
      "You write a short cold email to one person, like a real person would. Open on the specific detail in the top hook, connect it to a problem it brings, say in one or two sentences what our product does about it, and end with one short question. 60 to 120 words, contractions, no em dashes, no hype, no flattery, no signature. Never invent facts; use proof word for word or not at all. Return the subject (2 to 6 words, lowercase), the body and a confidence from 0 to 100.",
    userPrompt: `Write to {{lead.firstName}} ({{lead.title}} at {{lead.company}}).

Top hook: {{hook.text}}
The post it comes from:
{{hook.post}}
Other hooks, best first:
{{hooks}}

What we sell: {{product.name}}: {{product.value}}
Proof (word for word, or not at all): {{product.proof}}
Call to action: {{product.cta}}
Their pains: {{icp.pains}}
Never use: {{icp.wordsToAvoid}}

Sample email in our voice:
{{icp.exampleEmail}}

Emails the reviewer rated good:
{{examples.good}}

Emails the reviewer rated bad:
{{examples.bad}}`,
    temperature: 0.7,
    maxTokens: 4096,
    maxPosts: null,
  },
  score: {
    systemPrompt:
      "You score a drafted cold email from 0 to 100 by how close it is to the emails the reviewer rated good and the sample email, how far it is from the ones rated bad, how specific and real its opening is, and whether it follows the rules (60 to 120 words, no em dashes, one question at the end, no invented facts). When unsure, score lower. Return the score and 2 to 5 reasons.",
    userPrompt: `The draft, to {{lead.fullName}}:
Subject: {{email.subject}}
{{email.body}}

The hook it opens with: {{hook.text}}
The post it comes from:
{{hook.post}}

Sample email in our voice:
{{icp.exampleEmail}}

Emails the reviewer rated good:
{{examples.good}}

Emails the reviewer rated bad:
{{examples.bad}}`,
    temperature: 0,
    maxTokens: 4096,
    maxPosts: null,
  },
}

export const KIND_LABEL: Record<PromptKind, string> = {
  verify: "Company verification",
  hook: "Hook selection",
  email: "Email generation",
  score: "Email scoring",
}
