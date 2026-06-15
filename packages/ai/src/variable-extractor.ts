import {
  validateVariableValue,
  type VariableDefinition,
  type VariableExtractionContext,
  type VariableExtractionResult
} from "./variables";

export class VariableExtractor {
  extract(variables: VariableDefinition[], context: VariableExtractionContext) {
    return variables.map((variable) => this.extractOne(variable, context));
  }

  buildInput(variables: VariableDefinition[], context: VariableExtractionContext) {
    return {
      variables: variables.map((variable) => ({
        id: variable.id,
        key: variable.key,
        type: variable.type,
        prompt: variable.extraction_prompt,
        options: variable.options
      })),
      lead: context.lead,
      conversation: context.conversation,
      messages: context.messages.slice(-12)
    };
  }

  private extractOne(
    variable: VariableDefinition,
    context: VariableExtractionContext,
  ): VariableExtractionResult {
    const sources = [
      ...context.messages.map((message) => ({ id: message.id, text: message.body })),
      { id: null, text: context.lead?.notes ?? "" },
      { id: null, text: context.lead?.email ?? "" },
      { id: null, text: context.lead?.phone ?? "" }
    ];
    const joined = sources.map((source) => source.text).join(" ");
    const prompt = `${variable.name} ${variable.key} ${variable.extraction_prompt}`.toLowerCase();
    const source = sources.find((item) => this.guessRawValue(variable, item.text, prompt) !== null);
    const rawValue = this.guessRawValue(variable, source?.text ?? joined, prompt);

    if (rawValue === null) {
      return {
        variableId: variable.id,
        extracted: false,
        value: null,
        confidence: 0.1,
        sourceMessageId: source?.id,
        reason: "No se encontro valor en modo demo."
      };
    }

    try {
      const value = validateVariableValue(variable.type, rawValue, variable.options);
      return {
        variableId: variable.id,
        extracted: value !== null,
        value,
        confidence: 0.82,
        sourceMessageId: source?.id,
        reason: "Valor extraido por heuristica demo."
      };
    } catch {
      return {
        variableId: variable.id,
        extracted: false,
        value: null,
        confidence: 0.2,
        sourceMessageId: source?.id,
        reason: "El valor encontrado no cumple el tipo configurado."
      };
    }
  }

  private guessRawValue(variable: VariableDefinition, text: string, prompt: string) {
    if (!text) return null;
    if (variable.type === "link") return text.match(/https?:\/\/\S+/)?.[0] ?? null;
    if (variable.type === "boolean") {
      if (/\b(si|sí|yes|true)\b/i.test(text)) return true;
      if (/\b(no|false)\b/i.test(text)) return false;
      return null;
    }
    if (variable.type === "number" || variable.type === "price") {
      const number = text.match(/(?:usd|us\$|\$)?\s?([0-9]+(?:[.,][0-9]+)?)/i)?.[0];
      return number ?? null;
    }
    if (variable.type === "option") {
      return variable.options.find((option) => text.toLowerCase().includes(option.toLowerCase())) ?? null;
    }
    if (prompt.includes("email")) return text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] ?? null;
    if (prompt.includes("telefono") || prompt.includes("phone")) return text.match(/\+?[0-9][0-9\s-]{6,}/)?.[0] ?? null;
    const labeled = text.match(new RegExp(`${variable.key}[:=]\\s*([^.;\\n]+)`, "i"))?.[1];
    if (labeled) return labeled.trim();
    return null;
  }
}
