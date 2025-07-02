export class MessageSanitizer {
  private filters: string[];

  constructor(filters: string[]) {
    this.filters = filters;
  }

  sanitize(content: string): string {
    if (!content) return '';

    let sanitized = content;

    // Apply all configured filters
    for (const filter of this.filters) {
      // Use global flag to replace all occurrences
      const regex = new RegExp(this.escapeRegExp(filter), 'gi');
      sanitized = sanitized.replace(regex, '').trim();
    }

    // Clean up extra whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  private escapeRegExp(string: string): string {
    // Escape special regex characters
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  hasFilteredContent(content: string): boolean {
    if (!content) return false;

    return this.filters.some(filter =>
      content.toLowerCase().includes(filter.toLowerCase())
    );
  }
}
