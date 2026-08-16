const randomScramble = (count: number) => {
	const faces = ['u', 'd', 'l', 'r', 'f', 'b']
	const result: string[] = []

	while (result.length < count) {
		const candidate = faces[Math.floor(Math.random() * faces.length)]
		const prev = result[result.length - 1]
		if (candidate === prev) {
			continue
		}
		result.push(candidate)
	}

	return result.join('')
}

type CreateScrambleControllerOptions = {
	setStatus: (text: string) => void
	enqueueAlgorithm: (algorithm: string) => void
}

export const createScrambleController = ({
	setStatus,
	enqueueAlgorithm,
}: CreateScrambleControllerOptions) => {
	let lastScramble = ''

	const triggerScramble = () => {
		lastScramble = randomScramble(24)
		setStatus(`打亂 ${lastScramble}`)
		enqueueAlgorithm(lastScramble)
	}

	return {
		triggerScramble,
		getLastScramble: () => lastScramble,
	}
}
