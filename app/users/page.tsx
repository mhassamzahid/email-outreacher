import { UsersView, type UsersTab } from "@/components/users/users-view"

const TABS: UsersTab[] = ["users", "workspaces", "roles"]

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams
  return <UsersView initialTab={TABS.find((t) => t === tab) ?? "users"} />
}
