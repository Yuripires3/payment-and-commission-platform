const fs = require('fs')
const path = require('path')

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    return
  }

  const stats = fs.statSync(src)

  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

function ensureStandaloneAssets() {
  const projectRoot = process.cwd()
  const standaloneDir = path.join(projectRoot, '.next', 'standalone')
  const distStaticDir = path.join(projectRoot, '.next', 'static')
  const publicDir = path.join(projectRoot, 'public')

  if (!fs.existsSync(standaloneDir)) {
    return
  }

  const standaloneNextDir = path.join(standaloneDir, '.next')
  const standaloneStaticDir = path.join(standaloneNextDir, 'static')

  copyRecursive(distStaticDir, standaloneStaticDir)
  copyRecursive(publicDir, path.join(standaloneDir, 'public'))
}

ensureStandaloneAssets()
