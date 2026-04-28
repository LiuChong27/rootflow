import { getStoredTheme, offThemeChange, onThemeChange } from '../services/themeService';
import ThemeToggleFab from '../components/ThemeToggleFab/ThemeToggleFab.vue';

export default {
  components: {
    ThemeToggleFab,
  },
  data() {
    return {
      currentTheme: getStoredTheme(),
    };
  },
  onLoad() {
    this.syncThemeState();
    this.bindThemeState();
  },
  onShow() {
    this.syncThemeState();
  },
  onUnload() {
    this.unbindThemeState();
  },
  methods: {
    syncThemeState() {
      this.currentTheme = getStoredTheme();
    },
    bindThemeState() {
      if (this.__themeChangeHandler) return;
      this.__themeChangeHandler = (theme) => {
        this.currentTheme = theme;
      };
      onThemeChange(this.__themeChangeHandler);
    },
    unbindThemeState() {
      if (!this.__themeChangeHandler) return;
      offThemeChange(this.__themeChangeHandler);
      this.__themeChangeHandler = null;
    },
  },
};
