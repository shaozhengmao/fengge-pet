const { ipcRenderer } = require('electron')

let QUOTES = []

ipcRenderer.invoke('get-quotes').then(quotes => { QUOTES = quotes })
ipcRenderer.on('quotes-updated', (event, quotes) => { QUOTES = quotes })

// ─── Spritesheet 规格 ───────────────────────────────────────────────
// 1536x1872，8列×9行，每帧 192x208
// background-size: 800% 900%
// 列偏移: col / (COLS-1) * 100%
// 行偏移: row / (ROWS-1) * 100%
const COLS = 8
const ROWS = 9

function bgPos(col, row) {
  const x = col === 0 ? 0 : (col / (COLS - 1)) * 100
  const y = row === 0 ? 0 : (row / (ROWS - 1)) * 100
  return `${x}% ${y}%`
}

// ─── 动画序列定义 ────────────────────────────────────────────────────
// 每帧: { col, row, ms }  ms = 停留时长（毫秒）
// spritesheet 布局（8列×9行，每帧 192×208）：
//   row0: idle 站立（6帧）
//   row1: 跑步A（8帧）
//   row2: 跑步B（8帧）
//   row3: 自拍（4帧）
//   row4: idle 变体站立（5帧）
//   row5: 举手投降（8帧）
//   row6: 抱臂（6帧）
//   row7: 跑步C（6帧）
//   row8: 摸胡子/思考（6帧）
const ANIMATIONS = {
  // row 0: idle 站立
  idle: [
    { col: 0, row: 0, ms: 280 },
    { col: 1, row: 0, ms: 110 },
    { col: 2, row: 0, ms: 110 },
    { col: 3, row: 0, ms: 140 },
    { col: 4, row: 0, ms: 140 },
    { col: 5, row: 0, ms: 320 },
  ],
  // idle_slow — 发呆版 idle，帧时长 ×6
  idle_slow: [
    { col: 0, row: 0, ms: 280 * 6 },
    { col: 1, row: 0, ms: 110 * 6 },
    { col: 2, row: 0, ms: 110 * 6 },
    { col: 3, row: 0, ms: 140 * 6 },
    { col: 4, row: 0, ms: 140 * 6 },
    { col: 5, row: 0, ms: 320 * 6 },
  ],
  // row 1+2: 跑步（交替 A/B 帧，120ms）
  walk_right: [
    { col: 0, row: 1, ms: 120 },
    { col: 1, row: 1, ms: 120 },
    { col: 2, row: 1, ms: 120 },
    { col: 3, row: 1, ms: 120 },
    { col: 4, row: 1, ms: 120 },
    { col: 5, row: 1, ms: 120 },
    { col: 6, row: 1, ms: 120 },
    { col: 7, row: 1, ms: 120 },
  ],
  walk_left: [
    { col: 0, row: 2, ms: 120 },
    { col: 1, row: 2, ms: 120 },
    { col: 2, row: 2, ms: 120 },
    { col: 3, row: 2, ms: 120 },
    { col: 4, row: 2, ms: 120 },
    { col: 5, row: 2, ms: 120 },
    { col: 6, row: 2, ms: 120 },
    { col: 7, row: 2, ms: 120 },
  ],
  // row 3: 自拍（4帧，150ms）
  selfie: [
    { col: 0, row: 3, ms: 150 },
    { col: 1, row: 3, ms: 150 },
    { col: 2, row: 3, ms: 150 },
    { col: 3, row: 3, ms: 300 },
  ],
  // row 4: idle 变体（5帧）
  idle2: [
    { col: 0, row: 4, ms: 280 },
    { col: 1, row: 4, ms: 140 },
    { col: 2, row: 4, ms: 140 },
    { col: 3, row: 4, ms: 140 },
    { col: 4, row: 4, ms: 320 },
  ],
  // row 5: 举手投降/react（8帧，110ms）
  react: [
    { col: 0, row: 5, ms: 110 },
    { col: 1, row: 5, ms: 110 },
    { col: 2, row: 5, ms: 110 },
    { col: 3, row: 5, ms: 110 },
    { col: 4, row: 5, ms: 110 },
    { col: 5, row: 5, ms: 110 },
    { col: 6, row: 5, ms: 110 },
    { col: 7, row: 5, ms: 220 },
  ],
  // row 6: 抱臂（6帧，150ms）
  arms_cross: [
    { col: 0, row: 6, ms: 150 },
    { col: 1, row: 6, ms: 150 },
    { col: 2, row: 6, ms: 150 },
    { col: 3, row: 6, ms: 150 },
    { col: 4, row: 6, ms: 150 },
    { col: 5, row: 6, ms: 300 },
  ],
  // row 7: 跑步C（6帧，120ms）
  walk: [
    { col: 0, row: 7, ms: 120 },
    { col: 1, row: 7, ms: 120 },
    { col: 2, row: 7, ms: 120 },
    { col: 3, row: 7, ms: 120 },
    { col: 4, row: 7, ms: 120 },
    { col: 5, row: 7, ms: 120 },
  ],
  // row 8: 摸胡子/思考（6帧，150ms）
  think: [
    { col: 0, row: 8, ms: 150 },
    { col: 1, row: 8, ms: 150 },
    { col: 2, row: 8, ms: 150 },
    { col: 3, row: 8, ms: 150 },
    { col: 4, row: 8, ms: 150 },
    { col: 5, row: 8, ms: 300 },
  ],
}

// ─── 动画引擎 ────────────────────────────────────────────────────────
const sprite = document.getElementById('sprite')
const bubble = document.getElementById('bubble')

let currentAnim = null   // 当前动画名
let frameIndex = 0       // 当前帧索引
let loopCount = 0        // 已循环次数
let maxLoops = 1         // 最多循环几次
let frameTimer = null
let bubbleTimer = null
let lastQuote = null
let isReacting = false

function setFrame(col, row) {
  sprite.style.backgroundPosition = bgPos(col, row)
}

function playAnim(name, loops = 1, onDone = null) {
  clearTimeout(frameTimer)
  currentAnim = name
  frameIndex = 0
  loopCount = 0
  maxLoops = loops

  function tick() {
    const frames = ANIMATIONS[currentAnim]
    const frame = frames[frameIndex]
    setFrame(frame.col, frame.row)

    frameIndex++
    if (frameIndex >= frames.length) {
      frameIndex = 0
      loopCount++
      if (loopCount >= maxLoops) {
        if (onDone) onDone()
        return
      }
    }
    frameTimer = setTimeout(tick, frame.ms)
  }
  tick()
}

// ─── 状态机 ──────────────────────────────────────────────────────────
// 空闲时随机在 idle / think / walk 之间切换
const IDLE_STATES = ['idle', 'idle', 'idle2', 'idle2', 'think', 'arms_cross', 'selfie', 'walk', 'walk_right', 'walk_left']  // idle 权重更高

function pickRandom(pool, last) {
  const candidates = pool.filter(x => x !== last)
  return candidates[Math.floor(Math.random() * candidates.length)]
}

let lastIdleState = null
let idleTimer = null

function scheduleNextIdle() {
  if (isReacting) return
  // idle 结束后先发呆一段时间
  const delay = 1500 + Math.random() * 2500
  idleTimer = setTimeout(() => {
    if (isReacting) return
    const next = pickRandom(IDLE_STATES, lastIdleState)
    lastIdleState = next
    const loops = next === 'walk' ? 2 : 1
    maybeShowQuote(next)
    // idle 状态：先播一遍快速版，再播一遍慢速发呆版（帧时长 ×6）
    if (next === 'idle') {
      playAnim('idle', 1, () => {
        playAnim('idle_slow', 1, scheduleNextIdle)
      })
    } else {
      playAnim(next, loops, scheduleNextIdle)
    }
  }, delay)
}

function maybeShowQuote(state) {
  if (QUOTES.length === 0) return
  // idle 和 think 状态有概率说话
  if ((state === 'idle' || state === 'think') && Math.random() < 0.45) {
    const quote = pickRandom(QUOTES, lastQuote)
    lastQuote = quote
    showBubble(quote)
  }
}

function showBubble(text) {
  clearTimeout(bubbleTimer)
  bubble.textContent = text
  bubble.style.opacity = '1'
  bubbleTimer = setTimeout(() => {
    bubble.style.opacity = '0'
  }, 3000)
}

// ─── 点击反应 ────────────────────────────────────────────────────────
function triggerReaction() {
  if (isReacting) return
  isReacting = true
  clearTimeout(idleTimer)
  clearTimeout(frameTimer)

  if (QUOTES.length > 0) {
    const quote = pickRandom(QUOTES, lastQuote)
    lastQuote = quote
    showBubble(quote)
  }

  playAnim('react', 1, () => {
    isReacting = false
    scheduleNextIdle()
  })
}

// ─── 拖拽 ────────────────────────────────────────────────────────────
let isDragging = false
let dragMoved = false
let dragStartX = 0
let dragStartY = 0

sprite.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return
  isDragging = true
  dragMoved = false
  dragStartX = e.screenX
  dragStartY = e.screenY
  e.preventDefault()
})

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  const dx = Math.abs(e.screenX - dragStartX)
  const dy = Math.abs(e.screenY - dragStartY)
  if (dx > 3 || dy > 3) {
    dragMoved = true
    ipcRenderer.send('drag-window', { x: e.screenX, y: e.screenY })
  }
})

window.addEventListener('mouseup', (e) => {
  if (!isDragging) return
  isDragging = false
  ipcRenderer.send('drag-end')
  if (!dragMoved) {
    triggerReaction()
  }
})

// ─── 右键菜单 ────────────────────────────────────────────────────────
window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  ipcRenderer.send('show-context-menu')
})

// ─── 启动 ────────────────────────────────────────────────────────────
playAnim('idle', 1, scheduleNextIdle)
