import { ImportView } from "@/components/companies/import-view"

export default async function ImportCompaniesPage({ searchParams }: { searchParams: Promise<{ icp?: string | string[] }> }) {
  const { icp } = await searchParams
  return <ImportView initialIcp={typeof icp === "string" ? icp : "all"} />
}
