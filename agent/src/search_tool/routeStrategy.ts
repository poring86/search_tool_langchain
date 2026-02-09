import { RunnableLambda } from "@langchain/core/runnables";
import { SearchInputSchema } from "../utils/schemas";

/**
 * CONFIGURAÇÕES (Abstração de Dados)
 * Tiramos as Regex de dentro da função para reduzir a Complexidade Acidental.
 * Se as palavras mudarem, você mexe aqui, não na lógica.
 */
const WEB_SEARCH_PATTERNS: RegExp[] = [
  /\btop[-\s]*\d+\b/u,
  /\bbest\b/u,
  /\brank(?:ing|ings)?\b/u,
  /\bwhich\s+is\s+better\b/u,
  /\b(?:vs\.?|versus)\b/u,
  /\bcompare|comparison\b/u,
  /\bprice|prices|pricing|cost|costs|cheapest|cheaper|affordable\b/u,
  /\bunder\s*\d+(?:\s*[kK])?\b/u,
  /\p{Sc}\s*\d+/u,
  /\blatest|today|now|current\b/u,
  /\bnews|breaking|trending\b/u,
  /\b(released?|launch|launched|announce|announced|update|updated)\b/u,
  /\bchangelog|release\s*notes?\b/u,
  /\bdeprecated|eol|end\s*of\s*life|sunset\b/u,
  /\broadmap\b/u,
  /\bworks\s+with|compatible\s+with|support(?:ed)?\s+on\b/u,
  /\binstall(ation)?\b/u,
  /\bnear\s+me|nearby\b/u,
];

const MIN_QUERY_LENGTH_FOR_WEB = 70;
const RECENT_YEAR_THRESHOLD = /\b20(2[4-9]|3[0-9])\b/;

/**
 * REGRAS DE NEGÓCIO (Funções Puras e Coesas)
 * Cada função faz apenas UMA coisa (Single Responsibility).
 */
const hasRecentYear = (query: string): boolean =>
  RECENT_YEAR_THRESHOLD.test(query);

const isLongQuery = (query: string): boolean =>
  query.length > MIN_QUERY_LENGTH_FOR_WEB;

const matchesWebPattern = (query: string): boolean =>
  WEB_SEARCH_PATTERNS.some((pattern) => pattern.test(query));

/**
 * ESTRATÉGIA DE ROTEAMENTO
 * Agora a complexidade ciclomática é fácil de ler.
 * É quase uma frase em inglês.
 */
export function routeStrategy(query: string): "web" | "direct" {
  const normalizedQuery = query.toLowerCase().trim();

  const shouldGoToWeb =
    isLongQuery(normalizedQuery) ||
    hasRecentYear(normalizedQuery) ||
    matchesWebPattern(normalizedQuery);

  return shouldGoToWeb ? "web" : "direct";
}

/**
 * RUNNABLE STEP (Ponto de Entrada)
 * Baixa instabilidade: depende de interfaces do LangChain.
 */
export const routerStep = RunnableLambda.from(async (input: { q: string }) => {
  const { q } = SearchInputSchema.parse(input);
  const mode = routeStrategy(q);

  return { q, mode };
});
