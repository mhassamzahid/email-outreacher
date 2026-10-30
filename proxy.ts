import { type NextRequest, NextResponse } from "next/server"
import { refusal } from "@/lib/authorized-urls"

// Every request, pages and files included, must be made to an address in AUTHORIZED_URLS. Calls to the
// API are also checked for coming from a page on one of those addresses (app/api/v1 checks again).
export function proxy(request: NextRequest) {
  const reason = refusal(request, { api: request.nextUrl.pathname.startsWith("/api/") })
  if (reason) return new NextResponse("Not authorized.", { status: 403, headers: { "Cache-Control": "no-store" } })
  return NextResponse.next()
}
