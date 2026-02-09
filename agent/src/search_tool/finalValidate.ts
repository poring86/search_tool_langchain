import { RunnableLambda } from "@langchain/core/runnables";
import { candidate } from "./types";
import { SearchAnswerSchema } from "../utils/schemas";
import { getChatModel } from "../shared/models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// --- 1. FUNÇÕES AUXILIARES ---

/**
 * Tenta extrair um objeto JSON de dentro de uma string de texto.
 * Útil quando a IA manda texto antes ou depois do JSON.
 */
function extractJson(input: string) {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}"); // Usei lastIndexOf para pegar o objeto inteiro

  if (start === -1 || end === -1 || end <= start) return {};

  try {
    return JSON.parse(input.slice(start, end + 1));
  } catch {
    return {};
  }
}

/**
 * Chama a IA para consertar um objeto que não passou na validação.
 */
async function repairSearchAns(
  obj: any,
): Promise<{ answer: string; sources: string[] }> {
  const model = getChatModel({ temperature: 0.2 });

  const response = await model.invoke([
    new SystemMessage(
      [
        "You fix json objects to match a given schema",
        "Respond only with valid json object",
        "Schema: {answer: string; sources: string[] (urls as strings) }",
      ].join("\n"),
    ),
    new HumanMessage(
      [
        "Make this exactly to the schema. Ensure sources is an array of URL strings",
        "Input JSON:",
        JSON.stringify(obj),
      ].join("\n\n"),
    ),
  ]);

  const text = String(response.content);
  const json = extractJson(text);

  return {
    answer: String(json?.answer ?? "").trim(),
    sources: Array.isArray(json?.sources) ? json?.sources.map(String) : [],
  };
}

// --- 2. O RUNNABLE PRINCIPAL ---

export const finalValidateAndPolish = RunnableLambda.from(
  async (candidate: candidate) => {
    // Prepara o rascunho inicial
    const finalDraft = {
      answer: candidate.answer,
      sources: candidate.sources ?? [],
    };

    // TENTATIVA 1: Validação direta
    const parsed1 = SearchAnswerSchema.safeParse(finalDraft);
    if (parsed1.success) return parsed1.data;

    // TENTATIVA 2: Se falhou, pede para a IA consertar (One-shot repair)
    console.log("⚠️ Validacao 1 falhou. Tentando reparar com IA...");
    const repaired = await repairSearchAns(finalDraft);

    const parsed2 = SearchAnswerSchema.safeParse(repaired);

    // Retorna o reparado se estiver ok, ou o rascunho original se tudo falhar
    return parsed2.success ? parsed2.data : finalDraft;
  },
);
