// Server-only: which URLs may use this app. AUTHORIZED_URLS (comma-separated, like
// "https://coldbrew.example.com,http://localhost:3000") lists every address the app may be served at.
// Anything else (another domain pointed here, a raw IP, an unlisted preview deployment, or a page on
// another site calling our API) is refused. Unset means nothing is authorized: the app refuses to serve.

/** scheme://host[:port], lowercased, or null when the value isn't an http(s) URL. */
export function originOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:" ? `${url.protocol}//${url.host}`.toLowerCase() : null
  } catch {
    return null
  }
}

export function authorizedUrls(): string[] {
  return (process.env.AUTHORIZED_URLS ?? "")
    .split(",")
    .map((u) => originOf(u))
    .filter((u): u is string => u !== null)
}

/** Why the request isn't allowed, or null when it is. Pages only need an authorized host (a link from an
 * email or another site still opens the app); API calls must also come from a page on an authorized URL. */
export function refusal(request: Request, { api }: { api: boolean }): string | null {
  const allowed = authorizedUrls()
  if (allowed.length === 0) return "AUTHORIZED_URLS is not set"
  const headers = request.headers
  // The address the request was made to, as the browser saw it (Vercel and most hosts set X-Forwarded-*).
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  const proto = headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(request.url).protocol.replace(":", "")
  if (!host || !allowed.includes(`${proto}://${host}`.toLowerCase())) return "unauthorized host"
  if (!api) return null
  // A page elsewhere calling the API: its Origin or Referer gives it away, and so does Sec-Fetch-Site.
  for (const name of ["origin", "referer"]) {
    const value = headers.get(name)
    if (value && !allowed.includes(originOf(value) ?? "")) return `unauthorized ${name}`
  }
  if (headers.get("sec-fetch-site") === "cross-site") return "cross-site request"
  return null
}
