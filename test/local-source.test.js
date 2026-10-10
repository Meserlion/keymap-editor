const test = require('node:test')
const assert = require('node:assert')

const {
  extractBlock,
  removeBlock,
  mergeKeymapCode,
  generateCombosDTS,
  mergeCombosInKeymap,
  generateMacrosDTS,
  mergeMacrosInKeymap
} = require('../api/services/zmk/local-source')

const SAMPLE_KEYMAP = `#include <behaviors.dtsi>

/ {
    combos {
        compatible = "zmk,combos";

        combo_esc {
            key-positions = <0 1>;
            bindings = <&kp ESC>;
        };
    };

    macros {
        kp_dk_ae: kp_dk_ae {
            compatible = "zmk,behavior-macro";
            #binding-cells = <0>;
            bindings = <&macro_press>, <&kp RALT>, <&macro_tap>, <&kp A>, <&macro_release>, <&kp RALT>;
            label = "KP_DK_AE";
        };
    };

    keymap {
        compatible = "zmk,keymap";

        default_layer {
            bindings = <
&kp A &kp B
            >;
        };
    };
};
`

test('extractBlock finds a brace-balanced block', () => {
  const block = extractBlock(SAMPLE_KEYMAP, /\bcombos\s*\{/)
  assert.ok(block)
  const text = SAMPLE_KEYMAP.slice(block.start, block.end)
  assert.ok(text.startsWith('combos {'))
  assert.ok(text.endsWith('};'))
  assert.ok(text.includes('combo_esc'))
  assert.ok(!text.includes('macros'))
})

test('removeBlock deletes the combos block and nothing else', () => {
  const result = removeBlock(SAMPLE_KEYMAP, /\bcombos\s*\{/)
  assert.ok(!result.includes('zmk,combos'))
  assert.ok(!result.includes('combo_esc'))
  assert.ok(result.includes('macros {'))
  assert.ok(result.includes('keymap {'))
})

test('removeBlock is a no-op when the block is absent', () => {
  const withoutCombos = removeBlock(SAMPLE_KEYMAP, /\bcombos\s*\{/)
  assert.strictEqual(removeBlock(withoutCombos, /\bcombos\s*\{/), withoutCombos)
})

test('emptying combos removes the stale block (regression)', () => {
  // generateCombosDTS returns null for an empty list; the export path must
  // then strip the existing block instead of leaving it in the firmware.
  assert.strictEqual(generateCombosDTS([]), null)
  const updated = removeBlock(SAMPLE_KEYMAP, /\bcombos\s*\{/)
  assert.ok(!updated.includes('zmk,combos'))
})

test('generateCombosDTS renders all combo fields', () => {
  const dts = generateCombosDTS([
    { name: 'combo_esc', positions: [0, 1], binding: '&kp ESC', timeout: 50, layers: [0, 2] }
  ])
  assert.ok(dts.includes('compatible = "zmk,combos"'))
  assert.ok(dts.includes('combo_esc {'))
  assert.ok(dts.includes('timeout-ms = <50>;'))
  assert.ok(dts.includes('key-positions = <0 1>;'))
  assert.ok(dts.includes('bindings = <&kp ESC>;'))
  assert.ok(dts.includes('layers = <0 2>;'))
})

test('mergeCombosInKeymap replaces an existing combos block', () => {
  const dts = generateCombosDTS([
    { name: 'combo_tab', positions: [2, 3], binding: '&kp TAB' }
  ])
  const merged = mergeCombosInKeymap(SAMPLE_KEYMAP, dts)
  assert.ok(merged.includes('combo_tab'))
  assert.ok(!merged.includes('combo_esc'))
  assert.strictEqual(merged.match(/zmk,combos/g).length, 1)
})

test('mergeCombosInKeymap inserts before macros when no combos block exists', () => {
  const noCombos = removeBlock(SAMPLE_KEYMAP, /\bcombos\s*\{/)
  const dts = generateCombosDTS([
    { name: 'combo_tab', positions: [2, 3], binding: '&kp TAB' }
  ])
  const merged = mergeCombosInKeymap(noCombos, dts)
  assert.ok(merged.indexOf('zmk,combos') < merged.indexOf('macros {'))
})

test('generateMacrosDTS renders press/tap/release sequence', () => {
  const dts = generateMacrosDTS([
    { code: '&kp_dk_ae', modifier: 'RALT', key: 'A' }
  ])
  assert.ok(dts.includes('kp_dk_ae: kp_dk_ae {'))
  assert.ok(dts.includes('<&kp RALT>'))
  assert.ok(dts.includes('<&kp A>'))
  assert.ok(dts.includes('label = "KP_DK_AE";'))
})

test('emptying macros removes the stale block (regression)', () => {
  assert.strictEqual(generateMacrosDTS([]), null)
  const updated = removeBlock(SAMPLE_KEYMAP, /\bmacros\s*\{/)
  assert.ok(!updated.includes('zmk,behavior-macro'))
  assert.ok(updated.includes('combos {'))
  assert.ok(updated.includes('keymap {'))
})

test('mergeMacrosInKeymap replaces an existing macros block', () => {
  const dts = generateMacrosDTS([{ code: '&kp_dk_oe', modifier: 'RALT', key: 'O' }])
  const merged = mergeMacrosInKeymap(SAMPLE_KEYMAP, dts)
  assert.ok(merged.includes('kp_dk_oe'))
  assert.ok(!merged.includes('kp_dk_ae'))
})

test('mergeKeymapCode replaces only the keymap block', () => {
  const generated = `/ {
    keymap {
        compatible = "zmk,keymap";

        default_layer {
            bindings = <
&kp X &kp Y
            >;
        };
    };
};
`
  const merged = mergeKeymapCode(SAMPLE_KEYMAP, generated)
  assert.ok(merged.includes('&kp X &kp Y'))
  assert.ok(!merged.includes('&kp A &kp B'))
  // Hand-maintained content outside the keymap block survives
  assert.ok(merged.includes('#include <behaviors.dtsi>'))
  assert.ok(merged.includes('combo_esc'))
  assert.ok(merged.includes('kp_dk_ae'))
})
