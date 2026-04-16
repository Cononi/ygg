export function shouldUseHistoryBack(historyLength: number, locationKey: string): boolean {
  return historyLength > 1 && locationKey !== 'default'
}
