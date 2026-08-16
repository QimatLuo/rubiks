/// <reference lib="deno.ns" />

import { validateWorkspaceMoveNotation } from './rules.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('workspace without restriction only allows whitelisted first moves', () => {
	const allowed = validateWorkspaceMoveNotation('r', null)
	const denied = validateWorkspaceMoveNotation('b', null)

	assert(allowed.allowed, 'r should be allowed when workspace mode just enabled')
	assert(!denied.allowed, 'b should be blocked when workspace mode just enabled')
	assert(
		denied.message === "工作區剛啟用，僅可做 R、F'、U、U'、D、D'、E、E'",
		'denied first move should return onboarding hint',
	)
})

Deno.test('workspace with restriction only allows unlock move and U/U\'', () => {
	const unlock = validateWorkspaceMoveNotation('F', 'F')
	const upperU = validateWorkspaceMoveNotation('U', 'F')
	const lowerU = validateWorkspaceMoveNotation('u', 'F')
	const denied = validateWorkspaceMoveNotation('r', 'F')

	assert(unlock.allowed, 'required inverse notation should be allowed')
	assert(upperU.allowed, 'U should be allowed while restricted')
	assert(lowerU.allowed, 'U\' should be allowed while restricted')
	assert(!denied.allowed, 'non-whitelisted move should be denied while restricted')
	assert(
		denied.message === "工作區已移動，僅可做 F 或 U/U'",
		'denied restricted move should describe allowed notations',
	)
})
