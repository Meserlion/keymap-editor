import '@fortawesome/fontawesome-free/css/all.css'
import keyBy from 'lodash/keyBy'
import { useMemo, useState } from 'react'

import * as config from './config'
import './App.css';
import { DefinitionsContext } from './providers'
import { loadKeycodes } from './keycodes'
import { loadBehaviours, loadKeymap, loadMacros, saveMacros, loadCombos, saveCombos } from './api'
import Keyboard from './Keyboard/Keyboard'
import Loader from './Common/Loader'
import MacroEditor from './Macros/MacroEditor'
import ComboEditor from './Macros/ComboEditor'
import layoutData from './data/totem.json'
import defaultKeymap from './data/totem.keymap.json'
import { parseKeymap } from './keymap'

const layout = layoutData.layouts.LAYOUT.layout

function App() {
  const [baseDefinitions, setBaseDefinitions] = useState(null)
  const [macros, setMacros] = useState([])
  const [combos, setCombos] = useState([])
  const [editingKeymap, setEditingKeymap] = useState(null)

  // Merge macro behaviors into the definitions so they appear in the picker
  const definitions = useMemo(() => {
    if (!baseDefinitions) return null
    const { keycodes, behaviours } = baseDefinitions
    const macroBehaviours = macros.map(m => ({
      code: m.code,
      name: m.name,
      symbol: m.symbol,
      params: []
    }))
    const macroCodes = new Set(macroBehaviours.map(m => m.code))
    const allBehaviours = [
      ...behaviours.filter(b => !macroCodes.has(b.code)),
      ...macroBehaviours
    ]
    allBehaviours.indexed = keyBy(allBehaviours, 'code')
    return { keycodes, behaviours: allBehaviours }
  }, [baseDefinitions, macros])

  async function handleCompile() {
    // Save in order: combos → macros → keymap (each replaces its block in .keymap)
    await saveCombos(combos)
    await saveMacros(macros)
    await fetch(`${config.apiBaseUrl}/keymap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingKeymap)
    })
  }

  const initialize = useMemo(() => {
    return async function () {
      const [keycodes, behaviours, loadedMacros, loadedCombos] = await Promise.all([
        loadKeycodes(),
        loadBehaviours(),
        loadMacros(),
        loadCombos()
      ])

      keycodes.indexed = keyBy(keycodes, 'code')
      behaviours.indexed = keyBy(behaviours, 'code')

      setBaseDefinitions({ keycodes, behaviours })
      setMacros(loadedMacros)
      setCombos(loadedCombos)

      try {
        const savedKeymap = await loadKeymap()
        if (savedKeymap && savedKeymap.layers && savedKeymap.layers[0] && savedKeymap.layers[0].length > 0) {
          setEditingKeymap(savedKeymap)
        } else {
          setEditingKeymap(parseKeymap(defaultKeymap))
        }
      } catch (e) {
        setEditingKeymap(parseKeymap(defaultKeymap))
      }
    }
  }, [])

  const handleUpdateKeymap = useMemo(() => function(keymap) {
    setEditingKeymap(keymap)
  }, [])

  return (
    <>
      <Loader load={initialize}>
        <div id="actions">
          <button disabled={!editingKeymap} onClick={handleCompile}>
            Save Local
          </button>
        </div>
        <DefinitionsContext.Provider value={definitions}>
          {editingKeymap && (
            <Keyboard
              layout={layout}
              keymap={editingKeymap}
              onUpdate={handleUpdateKeymap}
            />
          )}
        </DefinitionsContext.Provider>
        <MacroEditor macros={macros} onUpdate={setMacros} />
        <ComboEditor combos={combos} onUpdate={setCombos} />
      </Loader>
    </>
  );
}

export default App;
