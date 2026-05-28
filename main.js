const { app, BrowserWindow, screen, ipcMain, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

let win

const POS_FILE = path.join(os.homedir(), '.fengge-pet-pos.json')
const QUOTES_FILE = path.join(os.homedir(), '.fengge-quotes.txt')

const DEFAULT_QUOTES = [
  '祝大家长生不老，永远不死',
  '这是个好事儿啊',
  '大家好，我是二次元峰哥',
  '祝大家发东南西北旋风财',
  '上舰长，送我的写真集',
  '祝大家开上帕拉梅拉，住上大平层',
  '学生最烦人了'
]

// 初始化语录文件（如果不存在）
function initQuotesFile() {
  if (!fs.existsSync(QUOTES_FILE)) {
    fs.writeFileSync(QUOTES_FILE, DEFAULT_QUOTES.join('\n'), 'utf8')
  }
}

// 读取语录文件
function loadQuotes() {
  try {
    const content = fs.readFileSync(QUOTES_FILE, 'utf8')
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    return lines.length > 0 ? lines : DEFAULT_QUOTES
  } catch (e) {
    return DEFAULT_QUOTES
  }
}

function loadPosition() {
  try {
    if (fs.existsSync(POS_FILE)) {
      return JSON.parse(fs.readFileSync(POS_FILE, 'utf8'))
    }
  } catch (e) {}
  return null
}

function savePosition(x, y) {
  try {
    fs.writeFileSync(POS_FILE, JSON.stringify({ x, y }), 'utf8')
  } catch (e) {}
}

function createWindow() {
  const display = screen.getPrimaryDisplay()
  const bounds = display.bounds

  const winW = 220
  const winH = 260

  // 默认右下角
  const defaultX = bounds.x + bounds.width - winW - 20
  const defaultY = bounds.y + bounds.height - winH - 80

  const savedPos = loadPosition()
  const posX = savedPos ? savedPos.x : defaultX
  const posY = savedPos ? savedPos.y : defaultY

  win = new BrowserWindow({
    width: winW,
    height: winH,
    x: posX,
    y: posY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    fullscreenable: true,
    minimizable: true,
    maximizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.setBackgroundColor('#00000000')
  win.loadFile('index.html')

  // 让宠物在所有桌面和全屏应用上都能显示
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setAlwaysOnTop(true, 'screen-saver')

  win.once('ready-to-show', () => {
    win.show()
  })

  // 拖动结束时保存位置
  win.on('moved', () => {
    const [x, y] = win.getPosition()
    savePosition(x, y)
  })

  win.setIgnoreMouseEvents(false)
  win.setMovable(true)
}

app.whenReady().then(() => {
  // 开机自启
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false
  })
  initQuotesFile()
  // 文件确保存在后再监听变化
  fs.watch(QUOTES_FILE, () => {
    if (win) {
      win.webContents.send('quotes-updated', loadQuotes())
    }
  })
  createWindow()
})

// 渲染进程请求语录
ipcMain.handle('get-quotes', () => {
  return loadQuotes()
})

// 右键菜单
ipcMain.on('show-context-menu', () => {
  const menu = Menu.buildFromTemplate([
    {
      label: '编辑语录',
      click: () => { shell.openPath(QUOTES_FILE) }
    },
    { type: 'separator' },
    {
      label: '关闭宠物',
      click: () => { app.quit() }
    }
  ])
  menu.popup({ window: win })
})

// 拖拽移动：记录每次鼠标位置差值
let lastDragX = null
let lastDragY = null
ipcMain.on('drag-window', (event, { x, y }) => {
  if (!win) return
  if (lastDragX === null) {
    lastDragX = x
    lastDragY = y
    return
  }
  const dx = x - lastDragX
  const dy = y - lastDragY
  lastDragX = x
  lastDragY = y
  const [curX, curY] = win.getPosition()
  const newX = curX + dx
  const newY = curY + dy
  win.setPosition(Math.round(newX), Math.round(newY))
  savePosition(Math.round(newX), Math.round(newY))
})

// 鼠标松开时重置
ipcMain.on('drag-end', () => {
  lastDragX = null
  lastDragY = null
})

app.on('window-all-closed', () => {
  app.quit()
})
