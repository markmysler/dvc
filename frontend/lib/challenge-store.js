/**
 * Unified Challenge Store
 *
 * Manages both built-in and imported challenges with a unified interface.
 * Provides persistence for imported challenges and seamless integration
 * with the discovery interface.
 */

// Storage keys for localStorage
const STORAGE_KEYS = {
  IMPORTED_CHALLENGES: 'importedChallenges',
  IMPORT_METADATA: 'importMetadata'
};

/**
 * Challenge storage abstraction that handles both built-in and imported challenges
 */
class ChallengeStore {
  constructor() {
    this.builtInChallenges = [];
    this.importedChallenges = this.loadImportedChallenges();
  }

  /**
   * Load imported challenges from localStorage
   * @returns {Array} Array of imported challenges
   */
  loadImportedChallenges() {
    // Imported challenges are now managed server-side
    // Return empty array to avoid duplicates
    return [];
  }

  /**
   * Save imported challenges to localStorage
   * @param {Array} challenges - Array of challenges to save
   */
  saveImportedChallenges(challenges) {
    // Imported challenges are now managed server-side
    // No need to save to localStorage
    console.log('Imported challenges are now persisted server-side');
    this.importedChallenges = [];
  }

  /**
   * Set built-in challenges from API response
   * @param {Array} challenges - Array of built-in challenges
   */
  setBuiltInChallenges(challenges) {
    this.builtInChallenges = challenges.map(challenge => ({
      ...challenge,
      imported: false,
      builtIn: true
    }));
  }

  /**
   * Get all challenges (built-in + imported) as unified array
   * @returns {Array} Combined array of all challenges
   */
  getChallenges() {
    const allChallenges = [...this.builtInChallenges, ...this.importedChallenges];

    // Sort by imported status (built-in first) then by name
    return allChallenges.sort((a, b) => {
      if (a.imported !== b.imported) {
        return a.imported ? 1 : -1; // Built-in challenges first
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get only built-in challenges
   * @returns {Array} Array of built-in challenges
   */
  getBuiltInChallenges() {
    return [...this.builtInChallenges];
  }

  /**
   * Get only imported challenges
   * @returns {Array} Array of imported challenges
   */
  getImportedChallenges() {
    return [...this.importedChallenges];
  }

  /**
   * Add new imported challenge(s)
   * @param {Array|Object} challenges - Single challenge or array of challenges
   * @returns {Array} Updated array of imported challenges
   */
  addImportedChallenge(challenges) {
    const challengesToAdd = Array.isArray(challenges) ? challenges : [challenges];

    // Validate and prepare challenges for storage
    const validatedChallenges = challengesToAdd.map(challenge => {
      // Check for duplicate IDs
      const existingIds = [...this.builtInChallenges, ...this.importedChallenges].map(c => c.id);
      if (existingIds.includes(challenge.id)) {
        throw new Error(`Challenge ID "${challenge.id}" already exists`);
      }

      return {
        ...challenge,
        imported: true,
        importedAt: new Date().toISOString(),
        importSource: challenge.importSource || 'manual-import'
      };
    });

    // Add to imported challenges
    const updatedImported = [...this.importedChallenges, ...validatedChallenges];
    this.saveImportedChallenges(updatedImported);

    return updatedImported;
  }

  /**
   * Remove imported challenge by ID
   * @param {string} challengeId - ID of challenge to remove
   * @returns {boolean} True if challenge was removed
   */
  removeImportedChallenge(challengeId) {
    const initialLength = this.importedChallenges.length;
    const updated = this.importedChallenges.filter(c => c.id !== challengeId);

    if (updated.length < initialLength) {
      this.saveImportedChallenges(updated);
      return true;
    }
    return false;
  }

  /**
   * Get challenge by ID from any source
   * @param {string} challengeId - ID of challenge to find
   * @returns {Object|null} Challenge object or null if not found
   */
  getChallengeById(challengeId) {
    const allChallenges = this.getChallenges();
    return allChallenges.find(c => c.id === challengeId) || null;
  }

  /**
   * Check if challenge is imported
   * @param {string} challengeId - ID of challenge to check
   * @returns {boolean} True if challenge is imported
   */
  isImported(challengeId) {
    return this.importedChallenges.some(c => c.id === challengeId);
  }

  /**
   * Get import statistics
   * @returns {Object} Import statistics
   */
  getImportStats() {
    try {
      const metadata = localStorage.getItem(STORAGE_KEYS.IMPORT_METADATA);
      const stats = metadata ? JSON.parse(metadata) : {};

      return {
        totalImported: this.importedChallenges.length,
        totalBuiltIn: this.builtInChallenges.length,
        lastUpdated: stats.lastUpdated || null,
        importSources: stats.importSources || [],
        categories: this.getCategoryStats(),
        difficulties: this.getDifficultyStats()
      };
    } catch (error) {
      console.error('Failed to get import stats:', error);
      return {
        totalImported: this.importedChallenges.length,
        totalBuiltIn: this.builtInChallenges.length,
        lastUpdated: null,
        importSources: [],
        categories: {},
        difficulties: {}
      };
    }
  }

  /**
   * Get category distribution
   * @returns {Object} Category statistics
   */
  getCategoryStats() {
    const allChallenges = this.getChallenges();
    const stats = {};

    allChallenges.forEach(challenge => {
      const category = challenge.category;
      if (!stats[category]) {
        stats[category] = { total: 0, imported: 0, builtIn: 0 };
      }
      stats[category].total++;
      if (challenge.imported) {
        stats[category].imported++;
      } else {
        stats[category].builtIn++;
      }
    });

    return stats;
  }

  /**
   * Get difficulty distribution
   * @returns {Object} Difficulty statistics
   */
  getDifficultyStats() {
    const allChallenges = this.getChallenges();
    const stats = {};

    allChallenges.forEach(challenge => {
      const difficulty = challenge.difficulty;
      if (!stats[difficulty]) {
        stats[difficulty] = { total: 0, imported: 0, builtIn: 0 };
      }
      stats[difficulty].total++;
      if (challenge.imported) {
        stats[difficulty].imported++;
      } else {
        stats[difficulty].builtIn++;
      }
    });

    return stats;
  }

  /**
   * Clear all imported challenges
   * @returns {boolean} True if cleared successfully
   */
  clearImported() {
    try {
      localStorage.removeItem(STORAGE_KEYS.IMPORTED_CHALLENGES);
      localStorage.removeItem(STORAGE_KEYS.IMPORT_METADATA);
      this.importedChallenges = [];
      return true;
    } catch (error) {
      console.error('Failed to clear imported challenges:', error);
      return false;
    }
  }

  /**
   * Export imported challenges for backup
   * @returns {Object} Export data with challenges and metadata
   */
  exportImported() {
    return {
      challenges: this.importedChallenges,
      metadata: this.getImportStats(),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Import challenges from backup data
   * @param {Object} exportData - Export data from exportImported()
   * @returns {number} Number of challenges imported
   */
  importFromBackup(exportData) {
    if (!exportData.challenges || !Array.isArray(exportData.challenges)) {
      throw new Error('Invalid backup data format');
    }

    const existingIds = this.getChallenges().map(c => c.id);
    const validChallenges = exportData.challenges.filter(challenge => {
      if (existingIds.includes(challenge.id)) {
        console.warn(`Skipping duplicate challenge: ${challenge.id}`);
        return false;
      }
      return true;
    });

    if (validChallenges.length > 0) {
      this.addImportedChallenge(validChallenges);
    }

    return validChallenges.length;
  }
}

// Create singleton instance
const challengeStore = new ChallengeStore();

// Export store instance and convenience functions
export default challengeStore;

// Convenience functions for easier usage
export const getChallenges = () => challengeStore.getChallenges();
export const getBuiltInChallenges = () => challengeStore.getBuiltInChallenges();
export const getImportedChallenges = () => challengeStore.getImportedChallenges();
export const addImportedChallenge = (challenges) => challengeStore.addImportedChallenge(challenges);
export const removeImportedChallenge = (challengeId) => challengeStore.removeImportedChallenge(challengeId);
export const getChallengeById = (challengeId) => challengeStore.getChallengeById(challengeId);
export const isImported = (challengeId) => challengeStore.isImported(challengeId);
export const getImportStats = () => challengeStore.getImportStats();
export const setBuiltInChallenges = (challenges) => challengeStore.setBuiltInChallenges(challenges);

// Export storage keys for testing
export { STORAGE_KEYS };