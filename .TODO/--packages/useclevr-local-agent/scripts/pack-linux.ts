import { debugLog, debugError, debugWarn } from "../../../lib/debug"

/**
 * Minimal Linux packaging scaffold for UseClevr Local Agent
 * This does NOT create an AppImage yet. It prepares an AppDir-like folder
 * structure that future steps can turn into UseClevr-Hybrid-Runtime.AppImage.
 */

import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { rmSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'out')
const APPDIR = join(OUT, 'UseClevr-Hybrid-Runtime.AppDir')

function ensureBuild() {
  if (!existsSync(DIST)) {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })
  }
}

function clean() {
  if (existsSync(APPDIR)) rmSync(APPDIR, { recursive: true, force: true })
  if (!existsSync(OUT)) mkdirSync(OUT)
}

function scaffoldAppDir() {
  mkdirSync(APPDIR)
  mkdirSync(join(APPDIR, 'usr'))
  mkdirSync(join(APPDIR, 'usr', 'bin'), { recursive: true })
  mkdirSync(join(APPDIR, 'usr', 'share', 'applications'), { recursive: true })
  mkdirSync(join(APPDIR, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps'), { recursive: true })

  // AppRun (launcher) – minimal shim calling Node to run the agent
  const appRun = `#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
NODE_BIN="node"
exec "$NODE_BIN" "$HERE/usr/bin/useclevr-local-agent.js" "$@"
`
  writeFileSync(join(APPDIR, 'AppRun'), appRun, { mode: 0o755 })

  // Desktop entry metadata for Linux menus (optional but standard for AppImage)
  const desktop = `[
Desktop Entry]
Name=UseClevr Hybrid Runtime
Comment=UseClevr Local Agent for Hybrid AI
Exec=UseClevr-Hybrid-Runtime
Terminal=false
Type=Application
Categories=Utility;Development;
Icon=useclevr-hybrid-runtime
`
  writeFileSync(join(APPDIR, 'useclevr-hybrid-runtime.desktop'), desktop)

  // Placeholder icon (text file). Replace with real PNG later.
  writeFileSync(
    join(APPDIR, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps', 'useclevr-hybrid-runtime.png'),
    'PLACEHOLDER ICON – replace with real 256x256 PNG'
  )

  // Copy compiled server to AppDir
  copyFileSync(join(DIST, 'server.js'), join(APPDIR, 'usr', 'bin', 'useclevr-local-agent.js'))

  // Provide a convenience top-level symlink-like stub name
  const runSh = `#!/bin/sh
DIR="$(dirname "$0")"
exec "$DIR/AppRun" "$@"
`
  writeFileSync(join(APPDIR, 'UseClevr-Hybrid-Runtime'), runSh, { mode: 0o755 })
}

function main() {
  ensureBuild()
  clean()
  scaffoldAppDir()
  // Print next-step guidance without faking success
  // eslint-disable-next-line no-console
  debugLog('\n[pack-linux] AppDir prepared at:', APPDIR)
  debugLog('[pack-linux] Next step: bundle this AppDir into an AppImage named: UseClevr-Hybrid-Runtime.AppImage')
}

main()
