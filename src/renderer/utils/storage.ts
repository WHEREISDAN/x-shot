// Safe localStorage utilities with proper error handling
import { createRendererLogger } from './logger';

const logger = createRendererLogger('storage');

const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      logger.warn(`Failed to read from localStorage (key: ${key})`, error);
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      logger.warn(`Failed to write to localStorage (key: ${key})`, error);
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logger.warn(`Failed to remove from localStorage (key: ${key})`, error);
      return false;
    }
  },
};

export default safeLocalStorage;
