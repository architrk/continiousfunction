#!/usr/bin/env node
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function findOracleRoot() {
  const oracleBin = process.env.ORACLE_BIN || path.join(os.homedir(), '.local/bin/oracle')
  let current = fs.realpathSync(oracleBin)
  if (fs.statSync(current).isFile()) current = path.dirname(current)

  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(current, 'package.json')
    if (fs.existsSync(candidate)) {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      if (pkg.name === '@steipete/oracle') return current
    }
    current = path.dirname(current)
  }

  throw new Error(`Could not find @steipete/oracle package root from ${oracleBin}`)
}

const oracleRoot = findOracleRoot()
const promptComposer = path.join(oracleRoot, 'dist/src/browser/actions/promptComposer.js')
const source = fs.readFileSync(promptComposer, 'utf8')

if (source.includes('visibleUploadReady')) {
  console.log(`[oracle-patch] Attachment readiness patch already present: ${promptComposer}`)
  process.exit(0)
}

const needle = `    const countReady = chipNodes.length >= names.length && removeAffordanceCount >= names.length;

    return chipsReady || inputsReady || countReady;`

const replacement = [
  '    const countReady = chipNodes.length >= names.length && removeAffordanceCount >= names.length;',
  '    const normalizeUploadLabel = (value) =>',
  "      String(value || '')",
  '        .toLowerCase()',
  "        .replace(/\\\\(\\\\d+\\\\)(?=\\\\.[a-z0-9]+(?:\\\\s|$))/g, '')",
  "        .replace(/\\\\s+/g, ' ')",
  '        .trim();',
  "    const escapeRegExp = (value) => String(value).replace(/[.*+?^\\${}()|[\\\\]\\\\\\\\]/g, '\\\\\\\\$&');",
  "    const uploadText = normalizeUploadLabel(document.body?.innerText || document.body?.textContent || '');",
  '    const visibleUploadReady = names.every((name) => {',
  '      const basename = normalizeUploadLabel(String(name).split(/[\\\\\\\\/]/).pop() || name);',
  '      if (!basename) return false;',
  '      const filenameIndex = uploadText.indexOf(basename);',
  '      if (filenameIndex === -1) return false;',
  '      const nearbyText = uploadText.slice(filenameIndex, filenameIndex + basename.length + 80);',
  "      return new RegExp(escapeRegExp(basename) + '\\\\\\\\s+(document|file|image|pdf|spreadsheet|presentation|audio|video)').test(nearbyText);",
  '    });',
  '',
  '    return chipsReady || inputsReady || countReady || visibleUploadReady;',
].join('\n')

if (!source.includes(needle)) {
  throw new Error(`Oracle promptComposer.js did not match the expected patch point: ${promptComposer}`)
}

fs.writeFileSync(promptComposer, source.replace(needle, replacement))
console.log(`[oracle-patch] Patched attachment readiness in ${promptComposer}`)
