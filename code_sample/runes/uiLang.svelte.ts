import type { Language } from '../types';

class UILang {
    lang = $state<Language>('en');
}
export const uiLang = new UILang();