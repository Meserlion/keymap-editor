const test = require('node:test')
const assert = require('node:assert')

const {
  parseKeyBinding,
  parseKeymap,
  encodeKeymap,
  validateKeymapJson,
  validateMacrosJson,
  validateCombosJson,
  KeymapValidationError
} = require('../api/services/zmk/keymap')

test('parseKeyBinding parses a simple binding', () => {
  assert.deepStrictEqual(parseKeyBinding('&kp A'), {
    value: '&kp',
    params: [{ value: 'A', params: [] }]
  })
})

test('parseKeyBinding parses nested params', () => {
  assert.deepStrictEqual(parseKeyBinding('&kp LS(LC(A))'), {
    value: '&kp',
    params: [{
      value: 'LS',
      params: [{ value: 'LC', params: [{ value: 'A', params: [] }] }]
    }]
  })
})

test('parseKeyBinding parses multiple params', () => {
  assert.deepStrictEqual(parseKeyBinding('&mt LSHIFT A'), {
    value: '&mt',
    params: [
      { value: 'LSHIFT', params: [] },
      { value: 'A', params: [] }
    ]
  })
})

test('parseKeyBinding treats compound keycodes as atomic', () => {
  // These come from the shared compound-keycodes.json list; the entries
  // below were previously missing from the backend copy (drift bug).
  for (const code of ['LA(LC(NUMBER_2))', 'LA(LC(HASH))', 'LC(LA(DLLR))', 'LS(FSLH)']) {
    assert.deepStrictEqual(parseKeyBinding(`&kp ${code}`), {
      value: '&kp',
      params: [{ value: code, params: [] }]
    }, `expected ${code} to parse as a single atomic param`)
  }
})

test('frontend and backend share the same compound keycode list', () => {
  const shared = require('../app/src/data/compound-keycodes.json')
  assert.ok(Array.isArray(shared) && shared.length > 0)
  const fs = require('fs')
  const frontendSource = fs.readFileSync(require.resolve('../app/src/keymap.js'), 'utf8')
  const backendSource = fs.readFileSync(require.resolve('../api/services/zmk/keymap.js'), 'utf8')
  assert.match(frontendSource, /compound-keycodes\.json/)
  assert.match(backendSource, /compound-keycodes\.json/)
})

test('encodeKeymap round-trips parseKeymap', () => {
  const keymap = {
    layer_names: ['default'],
    layers: [['&kp A', '&mt LSHIFT B', '&kp LA(LC(N7))', '&trans', '&none', '&bt BT_SEL 0']]
  }
  assert.deepStrictEqual(encodeKeymap(parseKeymap(keymap)), keymap)
})

test('validateKeymapJson accepts a valid keymap', () => {
  validateKeymapJson({
    layers: [[
      '&kp A',
      '&trans',
      { value: '&mo', params: [{ value: '1', params: [] }] }
    ]]
  })
})

test('validateKeymapJson rejects wrong param counts', () => {
  assert.throws(
    () => validateKeymapJson({ layers: [['&kp']] }),
    err => err instanceof KeymapValidationError &&
      err.errors.some(e => e.includes('expects 1 param'))
  )
})

test('validateKeymapJson rejects malformed values', () => {
  assert.throws(
    () => validateKeymapJson({ layers: [[42]] }),
    err => err instanceof KeymapValidationError &&
      err.errors.some(e => e.includes('invalid format'))
  )
})

test('validateKeymapJson skips unknown behaviors (user macros)', () => {
  validateKeymapJson({ layers: [['&kp_dk_ae']] })
})

test('validateMacrosJson accepts valid macros', () => {
  validateMacrosJson([
    { code: '&kp_dk_ae', name: 'dk_ae', modifier: 'RALT', key: 'A' }
  ])
})

test('validateMacrosJson rejects names unsafe for devicetree', () => {
  assert.throws(
    () => validateMacrosJson([{ code: '&kp_my macro;', modifier: 'RALT', key: 'A' }]),
    err => err instanceof KeymapValidationError
  )
})

test('validateMacrosJson rejects duplicate codes', () => {
  assert.throws(
    () => validateMacrosJson([
      { code: '&kp_x', modifier: 'RALT', key: 'A' },
      { code: '&kp_x', modifier: 'RALT', key: 'B' }
    ]),
    err => err instanceof KeymapValidationError &&
      err.errors.some(e => e.includes('duplicate'))
  )
})

test('validateCombosJson accepts valid combos', () => {
  validateCombosJson([
    { name: 'combo_esc', positions: [0, 1], binding: '&kp ESC', timeout: 50, layers: [0] },
    { name: 'combo_tab', positions: [2, 3], binding: '&mt LSHIFT TAB' }
  ])
})

test('validateCombosJson rejects bad names, positions and bindings', () => {
  assert.throws(
    () => validateCombosJson([{ name: 'bad name', positions: [], binding: 'kp ESC' }]),
    err => err instanceof KeymapValidationError &&
      err.errors.length === 3
  )
})

test('validateCombosJson rejects duplicate names', () => {
  assert.throws(
    () => validateCombosJson([
      { name: 'combo_a', positions: [0, 1], binding: '&kp A' },
      { name: 'combo_a', positions: [2, 3], binding: '&kp B' }
    ]),
    err => err instanceof KeymapValidationError &&
      err.errors.some(e => e.includes('duplicate'))
  )
})
