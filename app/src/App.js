import '@fortawesome/fontawesome-free/css/all.css'
import keyBy from 'lodash/keyBy'
import { useMemo, useState } from 'react'

import * as config from './config'
import './App.css';
import { DefinitionsContext } from './providers'
import { loadKeycodes } from './keycodes'
import { loadBehaviours, loadKeymap } from './api'
import Keyboard from './Keyboard/Keyboard'
import Loader from './Common/Loader'
import layoutData from './data/totem.json'
import defaultKeymap from './data/totem.keymap.json'
import { parseKeymap } from './keymap'

const layout = layoutData.layouts.LAYOUT.layout

function App() {
  const [definitions, setDefinitions] = useState(null)
  const [editingKeymap, setEditingKeymap] = useState(null)

  function handleCompile() {
    fetch(`${config.apiBaseUrl}/keymap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editingKeymap)
    })
  }

  const initialize = useMemo(() => {
    return async function () {
      const [keycodes, behaviours] = await Promise.all([
        loadKeycodes(),
        loadBehaviours()
      ])

      keycodes.indexed = keyBy(keycodes, 'code')
      behaviours.indexed = keyBy(behaviours, 'code')

      setDefinitions({ keycodes, behaviours })

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
  }, [setDefinitions])

  const handleUpdateKeymap = useMemo(() => function(keymap) {
    setEditingKeymap(keymap)
  }, [setEditingKeymap])

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
      </Loader>
    </>
  );
}

export default App;
