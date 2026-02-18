import { useState } from 'react'

const styles = {
  panel: {
    margin: '20px auto',
    maxWidth: '700px',
    fontFamily: 'monospace',
    fontSize: '13px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px'
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '10px'
  },
  th: {
    textAlign: 'left',
    padding: '4px 8px',
    borderBottom: '1px solid #444',
    color: '#aaa',
    fontWeight: 'normal'
  },
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid #333'
  },
  btn: {
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  form: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: '8px',
    background: '#222',
    borderRadius: '4px'
  },
  input: {
    padding: '3px 6px',
    fontSize: '12px',
    fontFamily: 'monospace',
    background: '#333',
    border: '1px solid #555',
    color: '#eee',
    borderRadius: '3px'
  },
  label: {
    color: '#aaa',
    fontSize: '11px'
  },
  muted: {
    color: '#aaa'
  }
}

const EMPTY_FORM = { name: '', positions: '', binding: '', timeout: '' }

function ComboEditor({ combos, onUpdate }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  function handleAdd() {
    if (!form.name || !form.positions || !form.binding) return
    const positions = form.positions.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
    const newCombo = {
      name: form.name,
      positions,
      binding: form.binding,
      ...(form.timeout ? { timeout: Number(form.timeout) } : {})
    }
    onUpdate([...combos, newCombo])
    setAdding(false)
    setForm(EMPTY_FORM)
  }

  function handleRemove(name) {
    onUpdate(combos.filter(c => c.name !== name))
  }

  function field(label, key, placeholder, width) {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={styles.label}>{label}</span>
        <input
          style={{ ...styles.input, width: width || '120px' }}
          placeholder={placeholder}
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
        />
      </label>
    )
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.title}>Combos</h3>
        {!adding && (
          <button style={styles.btn} onClick={() => setAdding(true)}>+ Add</button>
        )}
      </div>

      {combos.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Positions</th>
              <th style={styles.th}>Binding</th>
              <th style={styles.th}>Timeout</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {combos.map(c => (
              <tr key={c.name}>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.td}><span style={styles.muted}>{c.positions.join(', ')}</span></td>
                <td style={styles.td}>{c.binding}</td>
                <td style={styles.td}><span style={styles.muted}>{c.timeout || '—'}</span></td>
                <td style={styles.td}>
                  <button style={styles.btn} onClick={() => handleRemove(c.name)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && (
        <div style={styles.form}>
          {field('Name', 'name', 'e.g. combo_esc', '110px')}
          {field('Positions (key indices)', 'positions', 'e.g. 0, 1', '140px')}
          {field('Binding', 'binding', 'e.g. &kp ESC', '130px')}
          {field('Timeout ms (optional)', 'timeout', 'e.g. 50', '80px')}
          <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end', paddingBottom: '1px' }}>
            <button style={styles.btn} onClick={handleAdd}>Add</button>
            <button style={styles.btn} onClick={() => { setAdding(false); setForm(EMPTY_FORM) }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComboEditor
