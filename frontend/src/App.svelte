<script lang="ts">
  import RouterWrapper from './RouterWrapper.svelte'
  import { onMount } from 'svelte'
  import { gameState } from './lib/runes/gameState.svelte'

  onMount(() => { gameState.connect() })
</script>

<RouterWrapper />
