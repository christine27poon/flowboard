/** "card" / "cards" */
export function cardNoun(count: number): string {
  return count === 1 ? 'card' : 'cards'
}

/** "1 card" / "4 cards" */
export function cardCountLabel(count: number): string {
  return `${count} ${cardNoun(count)}`
}
