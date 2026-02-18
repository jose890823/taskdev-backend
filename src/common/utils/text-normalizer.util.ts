export class TextNormalizer {
  static normalize(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static createSlug(text: string): string {
    return this.normalize(text).replace(/\s+/g, '-');
  }

  static matches(searchTerm: string, targetText: string): boolean {
    if (!searchTerm || !targetText) {
      return false;
    }

    const normalizedSearch = this.normalize(searchTerm);
    const normalizedTarget = this.normalize(targetText);

    return normalizedTarget.includes(normalizedSearch);
  }

  static fuzzyMatch(
    searchTerm: string,
    targetText: string,
    threshold: number = 0.6,
  ): boolean {
    if (!searchTerm || !targetText) {
      return false;
    }

    const normalizedSearch = this.normalize(searchTerm);
    const normalizedTarget = this.normalize(targetText);

    if (normalizedTarget.includes(normalizedSearch)) {
      return true;
    }

    const similarity = this.calculateSimilarity(
      normalizedSearch,
      normalizedTarget,
    );
    return similarity >= threshold;
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
