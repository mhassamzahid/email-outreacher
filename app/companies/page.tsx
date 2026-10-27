import { CompaniesView } from "@/components/companies/companies-view"

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ icp?: string | string[] }> }) {
  const { icp } = await searchParams
  return <CompaniesView initialIcp={typeof icp === "string" ? icp : "all"} />
}
