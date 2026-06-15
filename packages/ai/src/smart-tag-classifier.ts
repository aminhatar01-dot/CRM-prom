import type {
  SmartTagClassificationContext,
  SmartTagClassificationResult,
  SmartTagDefinition
} from "./smart-tags";

export type SmartTagClassifierConfig = {
  demoMode?: boolean;
};

export class SmartTagClassifier {
  private readonly demoMode: boolean;

  constructor(config: SmartTagClassifierConfig = {}) {
    this.demoMode = config.demoMode ?? true;
  }

  classify(tags: SmartTagDefinition[], context: SmartTagClassificationContext) {
    return this.demoMode ? this.classifyDemo(tags, context) : this.classifyDemo(tags, context);
  }

  buildInput(tags: SmartTagDefinition[], context: SmartTagClassificationContext) {
    return {
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        prompt: tag.classification_prompt
      })),
      lead: context.lead,
      conversation: context.conversation,
      messages: context.messages.slice(-12)
    };
  }

  private classifyDemo(
    tags: SmartTagDefinition[],
    context: SmartTagClassificationContext,
  ): SmartTagClassificationResult[] {
    const haystack = [
      context.lead?.name,
      context.lead?.company,
      context.lead?.status,
      context.lead?.notes,
      ...context.messages.map((message) => message.body)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return tags.map((tag) => {
      const terms = this.keywordsFor(tag);
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const matched = matchedTerms.length > 0;

      return {
        tagId: tag.id,
        matched,
        confidence: matched ? Math.min(0.95, 0.55 + matchedTerms.length * 0.15) : 0.1,
        reason: matched
          ? `Coincidencias demo: ${matchedTerms.join(", ")}`
          : "No hubo coincidencias suficientes en modo demo."
      };
    });
  }

  private keywordsFor(tag: SmartTagDefinition) {
    return [tag.name, tag.description, tag.classification_prompt]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9áéíóúñ_]+/i)
      .filter((term) => term.length >= 4);
  }
}
