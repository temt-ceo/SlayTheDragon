class Viewport {
    width = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
    
    isMobile = $derived(this.width <= 768);
}

export const viewport = new Viewport();