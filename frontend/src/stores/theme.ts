// File: src/stores/theme.ts

import { defineStore } from 'pinia';

export const useThemeStore = defineStore('theme', {
    state: () => ({
        current: 'light' as 'light' | 'dark',
    }),
    actions: {
        toggle() {
            this.current = this.current === 'light' ? 'dark' : 'light';
        }
    }
});
