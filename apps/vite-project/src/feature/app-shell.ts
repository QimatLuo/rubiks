type CreateAppShellOptions = {
	app: HTMLDivElement
	xyzMarkup: string
	latestCommitTimestamp: string | undefined
}

export type AppShellElements = {
	scrambleButton: HTMLButtonElement | null
	workspaceToggleButton: HTMLButtonElement | null
	repeatLastButton: HTMLButtonElement | null
	historyPrevButton: HTMLButtonElement | null
	historyNextButton: HTMLButtonElement | null
	historyListEl: HTMLDivElement | null
	helpToggleButton: HTMLButtonElement | null
	helpCloseButton: HTMLButtonElement | null
	helpPanelEl: HTMLDivElement | null
	mobileTurnMenuEl: HTMLDivElement | null
	mobileTurnTargetEl: HTMLParagraphElement | null
	mobileTurnOptionAButton: HTMLButtonElement | null
	mobileTurnOptionBButton: HTMLButtonElement | null
	mobileTurnOptionCButton: HTMLButtonElement | null
	mobileTurnOptionDButton: HTMLButtonElement | null
	mobileTurnBackButton: HTMLButtonElement | null
	mobileTurnCancelButton: HTMLButtonElement | null
	cubeStageEl: HTMLDivElement
}

const formatLastUpdatedLabel = (isoTimestamp: string | undefined): string => {
	if (!isoTimestamp) {
		return '未知'
	}

	const parsed = new Date(isoTimestamp)
	if (Number.isNaN(parsed.getTime())) {
		return isoTimestamp
	}

	return new Intl.DateTimeFormat('zh-TW', {
		dateStyle: 'medium',
		timeStyle: 'medium',
		hour12: false,
	}).format(parsed)
}

export const createAppShell = ({
	app,
	xyzMarkup,
	latestCommitTimestamp,
}: CreateAppShellOptions): AppShellElements => {
	const latestCommitLabel = formatLastUpdatedLabel(latestCommitTimestamp)

	app.innerHTML = `
		<div class="app-shell">
			<section class="cube-panel" aria-label="魔術方塊視窗">
				<div id="cube-stage" class="cube-stage"></div>
			</section>
			<section class="control-panel" aria-label="互動選單">
				<div class="control-toolbar">
					<button id="repeat-last-button" type="button">再一次</button>
					<button id="history-prev-button" type="button">上一步</button>
					<button id="history-next-button" type="button">下一步</button>
					<button id="workspace-toggle-button" type="button" aria-pressed="false">工作區：關</button>
					<button id="scramble-button" type="button">打亂</button>
					<button id="help-toggle-button" class="help-toggle-button" type="button" aria-haspopup="dialog" aria-controls="help-panel" aria-expanded="false">
						說明
					</button>
				</div>
				<section class="move-history" aria-label="轉動歷史">
					<div id="move-history-list" class="move-history-list"></div>
				</section>
				<div id="mobile-turn-menu" class="center-turn-menu" hidden>
					<div class="center-turn-card" aria-label="手機轉動選單">
						<p id="mobile-turn-target" class="center-turn-target">請選擇操作</p>
						<div class="center-turn-actions">
							<button id="mobile-turn-option-a" type="button">選項一</button>
							<button id="mobile-turn-option-b" type="button">選項二</button>
							<button id="mobile-turn-option-c" type="button">選項三</button>
							<button id="mobile-turn-option-d" type="button">選項四</button>
						</div>
						<div class="center-turn-nav-actions">
							<button id="mobile-turn-back-button" type="button">上一步</button>
							<button id="mobile-turn-cancel-button" type="button">取消</button>
						</div>
					</div>
				</div>
			</section>
		</div>
		<div id="help-panel" class="help-panel" hidden>
			<div class="help-card" role="dialog" aria-modal="true" aria-labelledby="help-title">
				<div class="help-card-header">
					<h2 id="help-title">操作說明</h2>
					<button id="help-close-button" class="help-close-button" type="button" aria-label="關閉說明">關閉</button>
				</div>
				<div class="hud">
					<h1>Rubik's Cube</h1>
					<p>按小寫順時針，按大寫逆時針</p>
					<p>U D L R F B 對應六個面，M E S 對應中間層</p>
					<p>按 W 可開關工作區模式</p>
				</div>
				${xyzMarkup}
				<p class="help-last-updated">最後更新時間：<time id="last-updated-time" datetime="${latestCommitTimestamp ?? ''}">${latestCommitLabel}</time></p>
			</div>
		</div>
	`

	const cubeStageEl = document.querySelector<HTMLDivElement>('#cube-stage')
	if (!cubeStageEl) {
		throw new Error('Missing #cube-stage container')
	}

	return {
		scrambleButton: document.querySelector<HTMLButtonElement>('#scramble-button'),
		workspaceToggleButton: document.querySelector<HTMLButtonElement>('#workspace-toggle-button'),
		repeatLastButton: document.querySelector<HTMLButtonElement>('#repeat-last-button'),
		historyPrevButton: document.querySelector<HTMLButtonElement>('#history-prev-button'),
		historyNextButton: document.querySelector<HTMLButtonElement>('#history-next-button'),
		historyListEl: document.querySelector<HTMLDivElement>('#move-history-list'),
		helpToggleButton: document.querySelector<HTMLButtonElement>('#help-toggle-button'),
		helpCloseButton: document.querySelector<HTMLButtonElement>('#help-close-button'),
		helpPanelEl: document.querySelector<HTMLDivElement>('#help-panel'),
		mobileTurnMenuEl: document.querySelector<HTMLDivElement>('#mobile-turn-menu'),
		mobileTurnTargetEl: document.querySelector<HTMLParagraphElement>('#mobile-turn-target'),
		mobileTurnOptionAButton: document.querySelector<HTMLButtonElement>('#mobile-turn-option-a'),
		mobileTurnOptionBButton: document.querySelector<HTMLButtonElement>('#mobile-turn-option-b'),
		mobileTurnOptionCButton: document.querySelector<HTMLButtonElement>('#mobile-turn-option-c'),
		mobileTurnOptionDButton: document.querySelector<HTMLButtonElement>('#mobile-turn-option-d'),
		mobileTurnBackButton: document.querySelector<HTMLButtonElement>('#mobile-turn-back-button'),
		mobileTurnCancelButton: document.querySelector<HTMLButtonElement>('#mobile-turn-cancel-button'),
		cubeStageEl,
	}
}
