import type { Language, I18n } from '../types';

class UIState {
    lang = $state<Language>('en');

    private readonly en: I18n = {
        greeting: 'Hello, World.',
    };
    private readonly ja: I18n = {
        greeting: 'こんにちわ、世界',
    };
    s: I18n = $derived(this.lang == 'en' ? this.en : this.ja);
}

export const uiState = new UIState();
