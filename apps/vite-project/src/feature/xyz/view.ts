export const getXyzAxisViewMarkup = () => `
	<div class="axis-view" aria-label="XYZ 軸視圖">
		<h2>按 X Y Z 可翻轉整顆方塊</h2>
		<svg viewBox="0 0 140 120" role="img" aria-label="XYZ 軸方向圖">
			<circle cx="70" cy="62" r="4" fill="#cbd5e1" />
			<line x1="70" y1="62" x2="114" y2="88" class="axis-line axis-x" />
			<line x1="70" y1="62" x2="70" y2="14" class="axis-line axis-y" />
			<line x1="70" y1="62" x2="28" y2="88" class="axis-line axis-z" />
			<text x="116" y="93" class="axis-label axis-x">+X</text>
			<text x="58" y="12" class="axis-label axis-y">+Y</text>
			<text x="8" y="93" class="axis-label axis-z">+Z</text>
		</svg>
	</div>
`
