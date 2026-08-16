const INITIAL_ALLOWED_WORKSPACE_NOTATIONS = new Set([
	'r',
	'F',
	'u',
	'U',
	'd',
	'D',
	'e',
	'E',
])

type WorkspaceMoveValidation = {
	allowed: boolean
	message?: string
}

const formatMoveNotationLabel = (notation: string) => {
	const upper = notation.toUpperCase()
	const isCounterClockwise = notation !== notation.toLowerCase()
	return isCounterClockwise ? `${upper}'` : upper
}

export const validateWorkspaceMoveNotation = (
	notation: string,
	requiredInverseNotation: string | null,
): WorkspaceMoveValidation => {
	if (requiredInverseNotation) {
		const isUpperU = notation === 'U'
		const isLowerU = notation === 'u'
		const isAllowedUnlockMove = notation === requiredInverseNotation
		if (isUpperU || isLowerU || isAllowedUnlockMove) {
			return { allowed: true }
		}

		return {
			allowed: false,
			message: `工作區已移動，僅可做 ${formatMoveNotationLabel(requiredInverseNotation)} 或 U/U'`,
		}
	}

	if (INITIAL_ALLOWED_WORKSPACE_NOTATIONS.has(notation)) {
		return { allowed: true }
	}

	return {
		allowed: false,
		message: "工作區剛啟用，僅可做 R、F'、U、U'、D、D'、E、E'",
	}
}
