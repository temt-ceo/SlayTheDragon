// @ts-nocheck


export const routes = {
  "meta": {},
  "id": "_default",
  "name": "",
  "file": {
    "path": "src/routes",
    "dir": "src",
    "base": "routes",
    "ext": "",
    "name": "routes"
  },
  "rootName": "default",
  "routifyDir": import.meta.url,
  "children": [
    {
      "meta": {},
      "id": "_default_battle_svelte",
      "name": "battle",
      "file": {
        "path": "src/routes/battle.svelte",
        "dir": "src/routes",
        "base": "battle.svelte",
        "ext": ".svelte",
        "name": "battle"
      },
      "asyncModule": () => import('../src/routes/battle.svelte'),
      "children": []
    },
    {
      "meta": {},
      "id": "_default_cards_svelte",
      "name": "cards",
      "file": {
        "path": "src/routes/cards.svelte",
        "dir": "src/routes",
        "base": "cards.svelte",
        "ext": ".svelte",
        "name": "cards"
      },
      "asyncModule": () => import('../src/routes/cards.svelte'),
      "children": []
    },
    {
      "meta": {},
      "id": "_default_game_svelte",
      "name": "game",
      "file": {
        "path": "src/routes/game.svelte",
        "dir": "src/routes",
        "base": "game.svelte",
        "ext": ".svelte",
        "name": "game"
      },
      "asyncModule": () => import('../src/routes/game.svelte'),
      "children": []
    },
    {
      "meta": {
        "isDefault": true
      },
      "id": "_default_index_svelte",
      "name": "index",
      "file": {
        "path": "src/routes/index.svelte",
        "dir": "src/routes",
        "base": "index.svelte",
        "ext": ".svelte",
        "name": "index"
      },
      "asyncModule": () => import('../src/routes/index.svelte'),
      "children": []
    },
    {
      "meta": {},
      "id": "_default_try_tx_svelte",
      "name": "try-tx",
      "file": {
        "path": "src/routes/try-tx.svelte",
        "dir": "src/routes",
        "base": "try-tx.svelte",
        "ext": ".svelte",
        "name": "try-tx"
      },
      "asyncModule": () => import('../src/routes/try-tx.svelte'),
      "children": []
    },
    {
      "meta": {
        "dynamic": true,
        "dynamicSpread": true,
        "order": false,
        "inline": false
      },
      "name": "[...404]",
      "file": {
        "path": ".routify/components/[...404].svelte",
        "dir": ".routify/components",
        "base": "[...404].svelte",
        "ext": ".svelte",
        "name": "[...404]"
      },
      "asyncModule": () => import('./components/[...404].svelte'),
      "children": []
    }
  ]
}
export default routes