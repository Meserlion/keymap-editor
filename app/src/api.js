import * as config from './config'
import behaviors from './data/zmk-behaviors.json'
import keycodes from './data/zmk-keycodes.json'

export function healthcheck() {
  return fetch(`${config.apiBaseUrl}/health`)
}

export function loadBehaviours() {
  return Promise.resolve(behaviors)
}

export function loadKeycodes() {
  return Promise.resolve(keycodes)
}

export function loadKeymap() {
  return fetch(`${config.apiBaseUrl}/keymap`)
    .then(response => response.json())
}

export function loadLayout() {
  return fetch(`${config.apiBaseUrl}/layout`)
    .then(response => response.json())
}

export function loadMacros() {
  return fetch(`${config.apiBaseUrl}/macros`)
    .then(response => response.json())
}

export function saveMacros(macros) {
  return fetch(`${config.apiBaseUrl}/macros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(macros)
  })
}

export function loadCombos() {
  return fetch(`${config.apiBaseUrl}/combos`)
    .then(response => response.json())
}

export function saveCombos(combos) {
  return fetch(`${config.apiBaseUrl}/combos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(combos)
  })
}
