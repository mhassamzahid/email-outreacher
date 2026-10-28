/** Score buckets of width 10 for the threshold preview chart. */
export function scoreHistogram(scores: number[]): number[] {
  const bins = new Array(10).fill(0)
  for (const s of scores) bins[Math.min(9, Math.floor(s / 10))]++
  return bins
}
