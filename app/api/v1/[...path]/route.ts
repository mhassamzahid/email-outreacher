// The only way to the backend: the browser calls /api/v1/* here, on this app's own address, and this
// server forwards the call with the shared API secret. The backend's address (BACKEND_URL) and the
// secret (API_SECRET) stay on the server; neither is ever sent to the browser.

import { refusal } from "@/lib/authorized-urls"

// Researching companies and writing emails can take minutes.
export const maxDuration = 300

const SECRET_HEADER = "X-Coldbrew-Secret"
// Only what the API reads is forwarded: the session, the workspace, and what the body is.
const FORWARD_REQUEST = ["authorization", "x-workspace-id", "content-type", "accept"]
const FORWARD_RESPONSE = ["content-type", "content-disposition"]

function json(status: number, detail: string) {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } })
}

async function forward(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (refusal(request, { api: true })) return json(403, "Not authorized.")
  const backend = process.env.BACKEND_URL?.replace(/\/$/, "")
  const secret = process.env.API_SECRET
  if (!backend || !secret) return json(503, "The frontend isn't configured: BACKEND_URL and API_SECRET must be set.")

  const { path } = await ctx.params
  const target = `${backend}/api/v1/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`
  const headers = new Headers({ [SECRET_HEADER]: secret })
  for (const name of FORWARD_REQUEST) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  let res: Response
  try {
    res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    })
  } catch {
    return json(502, "Can't reach the backend. Is it running?")
  }

  // The backend refusing the secret is a setup problem, not an expired session: say so, rather than
  // pass on a 401 that would sign the person out.
  if (res.status === 401) {
    const detail = await res
      .clone()
      .json()
      .then((b: { detail?: unknown }) => b?.detail)
      .catch(() => null)
    if (detail === "Not authorized.") return json(502, "The frontend's API_SECRET doesn't match the backend's.")
  }

  const out = new Headers({ "Cache-Control": "no-store" })
  for (const name of FORWARD_RESPONSE) {
    const value = res.headers.get(name)
    if (value) out.set(name, value)
  }
  return new Response(res.status === 204 ? null : res.body, { status: res.status, headers: out })
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE }
