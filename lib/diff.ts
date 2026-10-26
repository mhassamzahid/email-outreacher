// Line-based LCS diff, laid out for a side-by-side view.

export type DiffKind = "same" | "removed" | "added" | "empty"

export interface DiffCell {
  text: string
  kind: DiffKind
  line: number | null
}

export interface DiffRow {
  left: DiffCell
  right: DiffCell
}

type Op = { kind: "same" | "removed" | "added"; text: string }

function diffLines(a: string[], b: string[]): Op[] {
  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "same", text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: "removed", text: a[i++] })
    } else {
      ops.push({ kind: "added", text: b[j++] })
    }
  }
  while (i < n) ops.push({ kind: "removed", text: a[i++] })
  while (j < m) ops.push({ kind: "added", text: b[j++] })
  return ops
}

const EMPTY: DiffCell = { text: "", kind: "empty", line: null }

export function sideBySideDiff(before: string, after: string): DiffRow[] {
  const ops = diffLines(before.split("\n"), after.split("\n"))
  const rows: DiffRow[] = []
  let l = 1
  let r = 1
  let k = 0
  while (k < ops.length) {
    if (ops[k].kind === "same") {
      rows.push({
        left: { text: ops[k].text, kind: "same", line: l++ },
        right: { text: ops[k].text, kind: "same", line: r++ },
      })
      k++
      continue
    }
    // Pair a block of removals with the following block of additions.
    const removed: string[] = []
    const added: string[] = []
    while (k < ops.length && ops[k].kind === "removed") removed.push(ops[k++].text)
    while (k < ops.length && ops[k].kind === "added") added.push(ops[k++].text)
    for (let x = 0; x < Math.max(removed.length, added.length); x++) {
      rows.push({
        left: x < removed.length ? { text: removed[x], kind: "removed", line: l++ } : EMPTY,
        right: x < added.length ? { text: added[x], kind: "added", line: r++ } : EMPTY,
      })
    }
  }
  return rows
}
