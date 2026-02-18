const {
  parseKeyBinding,
  generateKeymap
} = require('./keymap')

const {
  loadBehaviors,
  loadKeycodes,
  loadLayout,
  loadKeymap,
  exportKeymap,
  loadMacros,
  exportMacros,
  loadCombos,
  exportCombos
} = require('./local-source')

module.exports = {
  parseKeyBinding,
  generateKeymap,
  loadBehaviors,
  loadKeycodes,
  loadLayout,
  loadKeymap,
  exportKeymap,
  loadMacros,
  exportMacros,
  loadCombos,
  exportCombos
}
