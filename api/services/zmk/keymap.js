const fs = require('fs')
const path = require('path')
const filter = require('lodash/filter')
const flatten = require('lodash/flatten')
const get = require('lodash/get')
const keyBy = require('lodash/keyBy')
const map = require('lodash/map')
const uniq = require('lodash/uniq')

const { renderTable } = require('./layout')
const defaults = require('./defaults')

class KeymapValidationError extends Error {
  constructor (errors) {
    super()
    this.name = 'KeymapValidationError'
    this.errors = errors
  }
}

const behaviours = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/zmk-behaviors.json')))
const behavioursByBind = keyBy(behaviours, 'code')

function encodeBindValue(parsed) {
  const params = (parsed.params || []).map(encodeBindValue)
  const paramString = params.length > 0 ? `(${params.join(',')})` : ''
  return parsed.value + paramString
}

function encodeKeyBinding(parsed) {
  const { value, params } = parsed

  return `${value} ${params.map(encodeBindValue).join(' ')}`.trim()
}

function encodeKeymap(parsedKeymap) {
  return Object.assign({}, parsedKeymap, {
    layers: parsedKeymap.layers.map(layer => layer.map(encodeKeyBinding))
  })
}

function getBehavioursUsed(keymap) {
  const keybinds = flatten(keymap.layers)
  return uniq(map(keybinds, 'value'))
}

/**
 * Parse a bind string into a tree of values and parameters
 * @param {String} binding
 * @returns {Object}
 */
// Shared with the frontend parser — keep a single list so both sides treat
// the same codes as atomic. See app/src/keymap.js.
const COMPOUND_KEYCODES = new Set(
  require('../../../app/src/data/compound-keycodes.json')
)

function parseKeyBinding(binding) {
  const paramsPattern = /\((.+)\)/

  function parse(code) {
    if (COMPOUND_KEYCODES.has(code)) return { value: code, params: [] }
    const value = code.replace(paramsPattern, '')
    const params = get(code.match(paramsPattern), '[1]', '').split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(parse)

    return { value, params }
  }

  const value = binding.match(/^(&.+?)\b/)[1]
  const params = filter(binding.replace(/^&.+?\b\s*/, '')
    .split(' '))
    .map(parse)

  return { value, params }
}

function parseKeymap (keymap) {
  return Object.assign({}, keymap, {
    layers: keymap.layers.map(layer =>  {
      return layer.map(parseKeyBinding)
    })
  })
}

function generateKeymap (layout, keymap, template) {
  const encoded = encodeKeymap(keymap)
  return {
    code: generateKeymapCode(layout, keymap, encoded, template || defaults.keymapTemplate),
    json: generateKeymapJSON(layout, keymap, encoded)
  }
}

function renderTemplate(template, params) {
  const includesPattern = /\{\{\s*behaviour_includes\s*\}\}/
  const layersPattern = /\{\{\s*rendered_layers\s*\}\}/

  const renderedLayers = params.layers.map((layer, i) => {
    const name = i === 0 ? 'default_layer' : `layer_${params.layerNames[i] || i}`
    const rendered = renderTable(params.layout, layer, {
      linePrefix: '',
      columnSeparator: ' '
    })

    return `
        ${name.replace(/[^a-zA-Z0-9_]/g, '_')} {
            bindings = <
${rendered}
            >;
        };
`
  })

  return template
    .replace(includesPattern, params.behaviourHeaders.join('\n'))
    .replace(layersPattern, renderedLayers.join(''))
}

function generateKeymapCode (layout, keymap, encoded, template) {
  const { layer_names: names = [] } = keymap
  const behaviourHeaders = flatten(getBehavioursUsed(keymap).map(
    bind => get(behavioursByBind, [bind, 'includes'], [])
  ))

  return renderTemplate(template, {
    layout,
    behaviourHeaders,
    layers: encoded.layers,
    layerNames: names
  })
}

function generateKeymapJSON (layout, keymap, encoded) {
  const base = JSON.stringify(Object.assign({}, encoded, { layers: null }), null, 2)
  const layers = encoded.layers.map(layer => {
    const rendered = renderTable(layout, layer, {
      useQuotes: true,
      linePrefix: '      '
    })

    return `[\n${rendered}\n    ]`
  })

  return base.replace('"layers": null', `"layers": [\n    ${layers.join(', ')}\n  ]`)
}

function validateKeymapJson(keymap) {
  const errors = []

  if (typeof keymap !== 'object' || keymap === null) {
    errors.push('keymap.json root must be an object')
  } else if (!Array.isArray(keymap.layers)) {
    errors.push('keymap must include "layers" array')
  } else {
    for (let i in keymap.layers) {
      const layer = keymap.layers[i]

      if (!Array.isArray(layer)) {
        errors.push(`Layer at layers[${i}] must be an array`)
      } else {
        for (let j in layer) {
          const key = layer[j]
          const keyPath = `layers[${i}][${j}]`

          // Accept both string bindings ("&kp A") and parsed objects ({value, params})
          let bindCode, params
          if (typeof key === 'string') {
            const m = key.match(/^(&\S+)/)
            bindCode = m && m[1]
            params = bindCode ? parseKeyBinding(key).params : []
          } else if (typeof key === 'object' && key !== null && key.value) {
            bindCode = key.value
            params = key.params || []
          } else {
            errors.push(`Value at "${keyPath}" has invalid format`)
            continue
          }

          if (!bindCode) {
            errors.push(`Value at "${keyPath}" has invalid format`)
            continue
          }

          const behaviour = behavioursByBind[bindCode]
          if (!behaviour) {
            // Unknown behavior — likely a user-defined macro, skip param validation
            continue
          }

          const expectedParams = behaviour.params || []
          const commandsByCode = keyBy(behaviour.commands || [], 'code')

          // Calculate total expected params including additionalParams for commands
          let totalExpected = expectedParams.length
          if (expectedParams[0] === 'command' && params[0]) {
            const cmdCode = typeof params[0] === 'string' ? params[0] : params[0].value
            const cmd = commandsByCode[cmdCode]
            totalExpected += (cmd && cmd.additionalParams ? cmd.additionalParams.length : 0)
          }

          if (params.length !== totalExpected) {
            errors.push(
              `Key bind at "${keyPath}" (${bindCode}) expects ${totalExpected} param(s), got ${params.length}`
            )
            continue
          }

          // Validate command params
          for (let k = 0; k < expectedParams.length; k++) {
            if (expectedParams[k] === 'command' && params[k]) {
              const cmdCode = typeof params[k] === 'string' ? params[k] : params[k].value
              const validCmds = (behaviour.commands || []).map(c => c.code)
              if (cmdCode && !validCmds.includes(cmdCode)) {
                errors.push(
                  `Key bind at "${keyPath}" has unknown command "${cmdCode}" for ${bindCode}`
                )
              }
            }
          }
        }
      }
    }
  }

  if (errors.length) {
    throw new KeymapValidationError(errors)
  }
}

// Names and bindings are interpolated directly into devicetree source, so
// reject anything that would only fail later in the firmware build.
const DTS_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const BINDING_PATTERN = /^&[a-zA-Z_][a-zA-Z0-9_]*(\s+[a-zA-Z0-9_()]+)*$/

function validateMacrosJson (macros) {
  const errors = []

  if (!Array.isArray(macros)) {
    errors.push('macros.json root must be an array')
  } else {
    const seen = new Set()
    macros.forEach((macro, i) => {
      if (typeof macro !== 'object' || macro === null) {
        errors.push(`Macro at [${i}] must be an object`)
        return
      }
      const name = String(macro.code || '').replace(/^&/, '')
      if (!DTS_NAME_PATTERN.test(name)) {
        errors.push(`Macro at [${i}] has invalid code "${macro.code}" (letters, digits and _ only)`)
      }
      if (seen.has(macro.code)) {
        errors.push(`Macro at [${i}] has duplicate code "${macro.code}"`)
      }
      seen.add(macro.code)
      for (const field of ['modifier', 'key']) {
        if (!DTS_NAME_PATTERN.test(String(macro[field] || ''))) {
          errors.push(`Macro at [${i}] has invalid ${field} "${macro[field]}"`)
        }
      }
    })
  }

  if (errors.length) {
    throw new KeymapValidationError(errors)
  }
}

function validateCombosJson (combos) {
  const errors = []

  if (!Array.isArray(combos)) {
    errors.push('combos.json root must be an array')
  } else {
    const seen = new Set()
    combos.forEach((combo, i) => {
      if (typeof combo !== 'object' || combo === null) {
        errors.push(`Combo at [${i}] must be an object`)
        return
      }
      if (!DTS_NAME_PATTERN.test(String(combo.name || ''))) {
        errors.push(`Combo at [${i}] has invalid name "${combo.name}" (letters, digits and _ only)`)
      }
      if (seen.has(combo.name)) {
        errors.push(`Combo at [${i}] has duplicate name "${combo.name}"`)
      }
      seen.add(combo.name)
      if (!Array.isArray(combo.positions) || combo.positions.length === 0 ||
          !combo.positions.every(p => Number.isInteger(p) && p >= 0)) {
        errors.push(`Combo at [${i}] must have a non-empty "positions" array of key indexes`)
      }
      if (!BINDING_PATTERN.test(String(combo.binding || ''))) {
        errors.push(`Combo at [${i}] has invalid binding "${combo.binding}"`)
      }
      if (combo.timeout !== undefined && !(Number.isInteger(combo.timeout) && combo.timeout > 0)) {
        errors.push(`Combo at [${i}] has invalid timeout "${combo.timeout}"`)
      }
      if (combo.layers !== undefined &&
          (!Array.isArray(combo.layers) || !combo.layers.every(l => Number.isInteger(l) && l >= 0))) {
        errors.push(`Combo at [${i}] has invalid "layers" array`)
      }
    })
  }

  if (errors.length) {
    throw new KeymapValidationError(errors)
  }
}

module.exports = {
  KeymapValidationError,
  encodeKeymap,
  parseKeyBinding,
  parseKeymap,
  generateKeymap,
  validateKeymapJson,
  validateMacrosJson,
  validateCombosJson
}
