export class KeywordExtractor {
  async extract(project: any): Promise<string[]> {
    const text = `${project.name} ${project.description}`.toLowerCase();

    // Simple keyword extraction
    const words = text
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            "the",
            "and",
            "for",
            "with",
            "this",
            "that",
            "will",
            "can",
          ].includes(word)
      );

    return [...new Set(words)].slice(0, 10);
  }
}
