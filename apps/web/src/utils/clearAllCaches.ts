/**
 * Utility to clear all application caches
 * Use this when switching cache implementations or troubleshooting cache issues
 */

/**
 * Clear all browser storage caches
 */
export async function clearAllBrowserCaches(): Promise<void> {
  console.log('🧹 Starting cache cleanup...');
  
  // Clear localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('cache') || key.includes('tenant') || key.includes('user') || key.includes('directory')) {
          localStorage.removeItem(key);
        }
      });
      console.log(`✅ Cleared ${keys.length} localStorage items`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to clear localStorage:', error);
  }

  // Clear sessionStorage
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.includes('cache') || key.includes('tenant') || key.includes('user')) {
          sessionStorage.removeItem(key);
        }
      });
      console.log(`✅ Cleared ${keys.length} sessionStorage items`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to clear sessionStorage:', error);
  }

  // Clear IndexedDB
  try {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && (db.name.includes('cache') || db.name.includes('tenant') || db.name.includes('user'))) {
          await indexedDB.deleteDatabase(db.name);
          console.log(`✅ Deleted IndexedDB: ${db.name}`);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to clear IndexedDB:', error);
  }

  console.log('🎉 Cache cleanup completed!');
}

/**
 * Clear caches with confirmation (for UI usage)
 */
export async function clearCachesWithConfirmation(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const confirmed = window.confirm(
      'This will clear all cached data including:\n' +
      '• Directory listings\n' +
      '• User preferences\n' +
      '• Product data\n' +
      '• Session data\n\n' +
      'The app will reload with fresh data. Continue?'
    );
    
    if (confirmed) {
      await clearAllBrowserCaches();
      window.location.reload();
      return true;
    }
  }
  return false;
}

/**
 * Quick cache clear for development
 */
export async function devClearCaches(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    await clearAllBrowserCaches();
    console.log('🔧 Development caches cleared - refresh recommended');
  }
}
