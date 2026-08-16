/// <reference lib="deno.ns" />

// @ts-ignore Dependency is resolved from deno.json imports.
import * as THREE from 'three'
import { createCubeStateAdapter, type CubeletLike } from './cube-state.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

const closeTo = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

Deno.test('cube state adapter captures and restores cubelets', () => {
	const cubelets: CubeletLike[] = [
		{
			position: new THREE.Vector3(1, 2, 3),
			quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.2, 0.3, 'XYZ')),
			rotation: new THREE.Euler(0.1, 0.2, 0.3, 'XYZ'),
		},
		{
			position: new THREE.Vector3(-1, -2, -3),
			quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, -0.5, 0.6, 'XYZ')),
			rotation: new THREE.Euler(0.4, -0.5, 0.6, 'XYZ'),
		},
	]

	const adapter = createCubeStateAdapter(cubelets)
	const snapshot = adapter.captureState()

	cubelets[0].position.set(8, 8, 8)
	cubelets[0].quaternion.setFromEuler(new THREE.Euler(1, 1, 1, 'XYZ'))
	cubelets[1].position.set(9, 9, 9)
	cubelets[1].quaternion.setFromEuler(new THREE.Euler(0.7, 0.7, 0.7, 'XYZ'))

	adapter.restoreState(snapshot)

	assert(closeTo(cubelets[0].position.x, 1), 'cubelet 0 x should be restored')
	assert(closeTo(cubelets[0].position.y, 2), 'cubelet 0 y should be restored')
	assert(closeTo(cubelets[1].position.x, -1), 'cubelet 1 x should be restored')
	assert(closeTo(cubelets[1].position.z, -3), 'cubelet 1 z should be restored')
	assert(cubelets[0].rotation.order === 'XYZ', 'rotation order should be XYZ')
	assert(closeTo(cubelets[0].quaternion.w, snapshot[0].quaternion.w), 'quaternion should be restored')
})
