const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, execFileSync } = require('child_process');

function resizePng(src, dest, size) {
  const cmds = [
    ['magick', [src, '-resize', `${size}x${size}`, dest]],
    ['convert', [src, '-resize', `${size}x${size}`, dest]],
    ['python3', ['-c', `from PIL import Image; Image.open("${src}").resize((${size},${size}), Image.LANCZOS).save("${dest}")`]]
  ];
  for (const [cmd, args] of cmds) {
    try { execFileSync(cmd, args, { stdio: 'ignore' }); return; } catch {}
  }
}

const APP_ID = 'global-time-meeting-scheduler';
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'logo.png')
  : path.join(__dirname, 'logo.png');

const icon = nativeImage.createFromPath(iconPath);

function ensureDesktopIntegration() {
  if (process.platform !== 'linux') return;

  const localShare = path.join(os.homedir(), '.local', 'share');
  const marker = path.join(localShare, '.global-time-scheduler-icon-installed');

  if (fs.existsSync(marker)) return;

  try {
    const iconBase = path.join(localShare, 'icons', 'hicolor');
    for (const size of ICON_SIZES) {
      const dir = path.join(iconBase, `${size}x${size}`, 'apps');
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, `${APP_ID}.png`);
      if (!fs.existsSync(dest)) {
        resizePng(iconPath, dest, size);
      }
    }

    const desktopDir = path.join(localShare, 'applications');
    fs.mkdirSync(desktopDir, { recursive: true });
    const desktopDest = path.join(desktopDir, `${APP_ID}.desktop`);
    const appImage = process.env.APPIMAGE || process.argv[0];
    const desktop = [
      '[Desktop Entry]',
      'Name=Global Time and Meeting Scheduler',
      'Comment=Real-time world clocks & business hour overlap calculator',
      `Exec="${appImage}" %U`,
      `Icon=${APP_ID}`,
      'Type=Application',
      'Categories=Utility;Clock;',
      'Terminal=false',
      `StartupWMClass=${APP_ID}`,
      ''
    ].join('\n');
    fs.writeFileSync(desktopDest, desktop, 'utf-8');

    try { execSync('gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor/', { stdio: 'ignore' }); } catch {}
    try { execSync('kbuildsycoca5', { stdio: 'ignore' }); } catch {}

    fs.writeFileSync(marker, Date.now().toString());
  } catch (e) {
    // silently ignore
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 1195,
    minWidth: 800,
    minHeight: 600,
    icon: icon,
    title: 'Global Time & Meeting Scheduler',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.setIcon(icon);
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
}

app.setName('Global Time and Meeting Scheduler');
ensureDesktopIntegration();
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
