export const onboardingUseCases = [
  "products",
  "services",
  "support",
  "scheduling",
  "quotes",
  "after_sales",
  "collections",
  "other"
] as const;

export type OnboardingUseCase = (typeof onboardingUseCases)[number];

export type OnboardingTemplate = {
  key: string;
  name: string;
  description: string;
  useCases: OnboardingUseCase[];
  assistantTemplates: string[];
  knowledgeSuggestions: string[];
};

export const onboardingTemplates: OnboardingTemplate[] = [
  setup("general", "Negocio general", "Atencion inicial y derivacion inteligente.", ["other"], ["general"], ["Preguntas frecuentes", "Horarios", "Politicas y datos de contacto"]),
  setup("sales", "Ventas", "Consultas comerciales, productos y precios.", ["products"], ["sales-prices", "general"], ["Catalogo de productos", "Lista de precios", "Stock y disponibilidad"]),
  setup("support", "Soporte", "Incidencias, garantias y reclamos.", ["support"], ["support", "general"], ["Preguntas frecuentes", "Garantias", "Procedimientos de soporte"]),
  setup("ecommerce", "Ecommerce", "Ventas, cotizaciones y postventa.", ["products", "quotes", "after_sales"], ["sales-prices", "quote", "after-sales"], ["Catalogo con SKU", "Precios y stock", "Envios, cambios y devoluciones"]),
  setup("professional-services", "Servicios profesionales", "Consultas, propuestas y seguimiento.", ["services", "quotes"], ["general", "quote"], ["Servicios y alcance", "Honorarios", "Proceso de trabajo"]),
  setup("scheduling", "Turnos y reservas", "Agenda, disponibilidad y confirmaciones.", ["scheduling"], ["scheduling", "general"], ["Servicios reservables", "Horarios", "Politicas de cancelacion"]),
  setup("quotes", "Cotizaciones", "Precios verificados y presupuestos conversacionales.", ["quotes", "products", "services"], ["quote", "sales-prices"], ["Catalogo", "Lista de precios", "Condiciones comerciales"]),
  setup("collections", "Cobranza", "Facturas, vencimientos y derivacion segura.", ["collections"], ["collections", "general"], ["Medios de pago", "Vencimientos", "Politicas de cobranza"])
];

function setup(key: string, name: string, description: string, useCases: OnboardingUseCase[], assistantTemplates: string[], knowledgeSuggestions: string[]): OnboardingTemplate {
  return { key, name, description, useCases, assistantTemplates, knowledgeSuggestions };
}

export function recommendAssistantTemplates(useCases: string[]) {
  const selected = new Set(useCases);
  const recommended = onboardingTemplates
    .filter((template) => template.useCases.some((useCase) => selected.has(useCase)))
    .flatMap((template) => template.assistantTemplates);
  return Array.from(new Set(recommended.length ? recommended : ["general"]));
}

export function recommendKnowledge(useCases: string[]) {
  const selected = new Set(useCases);
  return Array.from(new Set(onboardingTemplates.filter((template) => template.useCases.some((useCase) => selected.has(useCase))).flatMap((template) => template.knowledgeSuggestions)));
}
