<script lang="ts">
  import { onMount } from 'svelte';
  import * as PIXI from 'pixi.js';

  interface Props {
    src: string;
    totalFrames?: number;
    row?: number;
    scale?: number;
  }

  let { src, totalFrames = 10, row = 0, scale = 1.5 }: Props = $props();

  let container: HTMLDivElement;

  onMount(() => {
    let app: PIXI.Application | null = null;

    (async () => {
      const img = new Image();
      img.src = src;
      await new Promise<void>(r => { img.onload = () => r(); });

      const frameW = Math.floor(img.naturalWidth / totalFrames);
      const frameH = Math.floor(img.naturalHeight / 2);

      app = new PIXI.Application();
      await app.init({
        width: frameW * scale,
        height: frameH * scale,
        background: 0x0a0f1e,
        antialias: true,
      });
      container.appendChild(app.canvas as HTMLCanvasElement);

      await PIXI.Assets.load(src);
      const base = PIXI.Texture.from(src);
      const textures = Array.from({ length: totalFrames }, (_, i) =>
        new PIXI.Texture({
          source: base.source,
          frame: new PIXI.Rectangle(i * frameW, row * frameH, frameW, frameH),
        })
      );

      const sprite = new PIXI.AnimatedSprite(textures);
      sprite.animationSpeed = 0.12;
      sprite.loop = true;
      sprite.width = frameW * scale;
      sprite.height = frameH * scale;
      sprite.play();
      app.stage.addChild(sprite);
    })();

    return () => { app?.destroy(true); };
  });
</script>

<div bind:this={container}></div>
