import Link from "next/link"
import { SearchX } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <div className="px-4 pb-10 md:px-8">
        <EmptyState
          icon={SearchX}
          title="This page doesn't exist"
          description="The link may be old, or what it pointed to was deleted."
          action={
            <Button asChild variant="outline">
              <Link href="/icps">Back to ICPs</Link>
            </Button>
          }
        />
      </div>
    </>
  )
}
