<svelte:options runes={false} />
<script>
  import { Router } from '@roxi/routify'
  // @ts-ignore
  import { routes } from '../.routify/routes.default.js'
</script>
<Router {routes} />
