export const invertMoveNotation = (notation: string) =>
	notation === notation.toLowerCase() ? notation.toUpperCase() : notation.toLowerCase()
