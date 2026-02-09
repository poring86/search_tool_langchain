import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { webSearch } from "../utils/webSearch";
import { openUrl } from "../utils/openUrl";
import { summarize } from "../utils/summarize";
import { candidate } from "./types";
import { getChatModel } from "../shared/models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const TOP_RESULTS_LIMIT = 5;

// --- 1. FUNÇÕES DE SUPORTE (Lógica Pura) ---

// Função para buscar e resumir o conteúdo de cada URL encontrada
async function fetchAndSummarizeLinks(results: any[]) {
  const topLinks = results.slice(0, TOP_RESULTS_LIMIT);

  const tasks = topLinks.map(async (res) => {
    try {
      const page = await openUrl(res.url);
      const { summary } = await summarize(page.content);
      return { url: page.url, summary };
    } catch {
      // Se falhar ao abrir a página, usamos o snippet do Google/Tavily como fallback
      return { url: res.url, summary: res.snippet || res.title };
    }
  });

  const processed = await Promise.all(tasks);
  return processed.filter((p) => p.summary); // Remove resultados vazios
}

// --- 2. OS PASSOS DO RUNNABLE (Os "Canos") ---

// PASSO 1: Busca na Web
const webSearchStep = RunnableLambda.from(async (input: { q: string }) => {
  const results = await webSearch(input.q);
  return { ...input, results };
});

// PASSO 2: Acesso aos links e Resumo
const openAndSummarizeStep = RunnableLambda.from(async (input: any) => {
  const pageSummaries = await fetchAndSummarizeLinks(input.results || []);
  return { ...input, pageSummaries };
});

// PASSO 3: Composição da Resposta Final pela IA
const composeStep = RunnableLambda.from(
  async (input: any): Promise<candidate> => {
    const model = getChatModel({ temperature: 0.2 });
    const hasPages = input.pageSummaries?.length > 0;

    // Prompt Dinâmico
    const systemPrompt = hasPages
      ? "Use the provided summaries to answer accurately. Max 8 sentences."
      : "Answer briefly as a general assistant. If unsure, say so.";

    const userContent = hasPages
      ? `Question: ${input.q}\n\nContext:\n${JSON.stringify(input.pageSummaries)}`
      : input.q;

    const res = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userContent),
    ]);

    return {
      answer: String(res.content).trim(),
      sources: hasPages ? input.pageSummaries.map((s: any) => s.url) : [],
      mode: hasPages ? "web" : "direct",
    };
  },
);

// --- 3. A ESTEIRA FINAL (LCEL) ---

export const webPath = RunnableSequence.from([
  webSearchStep,
  openAndSummarizeStep,
  composeStep,
]);
