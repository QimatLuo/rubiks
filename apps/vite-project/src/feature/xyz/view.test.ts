/// <reference lib="deno.ns" />

import { getXyzAxisViewMarkup } from './view.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('getXyzAxisViewMarkup contains axis SVG and labels', () => {
	const markup = getXyzAxisViewMarkup()

	assert(markup.includes('class="axis-view"'), 'axis container should exist')
	assert(markup.includes('viewBox="0 0 140 120"'), 'svg viewBox should exist')
	assert(markup.includes('axis-line axis-x'), 'x axis line should be rendered')
	assert(markup.includes('axis-line axis-y'), 'y axis line should be rendered')
	assert(markup.includes('axis-line axis-z'), 'z axis line should be rendered')
	assert(markup.includes('>+X<'), 'x axis label should be rendered')
	assert(markup.includes('>+Y<'), 'y axis label should be rendered')
	assert(markup.includes('>+Z<'), 'z axis label should be rendered')
})
