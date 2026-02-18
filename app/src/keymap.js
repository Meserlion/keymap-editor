import get from 'lodash/get'
import keyBy from 'lodash/keyBy'
export { loadKeymap } from './api'

export function parseKeymap(keymap) {
  return { ...keymap, layers: keymap.layers.map(layer => layer.map(parseKeyBinding)) }
}

const COMPOUND_KEYCODES = new Set([
  'LA(LC(N7))', 'LA(LC(N8))', 'LA(LC(N9))', 'LA(LC(N0))',
  'RS(NUMBER_8)', 'RS(N9)'
])

function parseKeyBinding(binding) {
  const paramsPattern = /\((.+)\)/
  function parse(code) {
    if (COMPOUND_KEYCODES.has(code)) return { value: code, params: [] }
    const value = code.replace(paramsPattern, '')
    const params = ((code.match(paramsPattern) || [])[1] || '').split(',')
      .map(s => s.trim()).filter(Boolean).map(parse)
    return { value, params }
  }
  const value = binding.match(/^(&.+?)\b/)[1]
  const params = binding.replace(/^&.+?\b\s*/, '').split(' ').filter(Boolean).map(parse)
  return { value, params }
}

export function getBehaviourParams(parsedParams, behaviour) {
  if (!behaviour) return []
  const firstParsedParam = get(parsedParams, '[0]', {})
  const commands = keyBy(behaviour.commands, 'code')
  return [].concat(
    behaviour.params,
    get(behaviour, 'params[0]') === 'command'
      ? get(commands[firstParsedParam.value], 'additionalParams', [])
      : []
  )
}
