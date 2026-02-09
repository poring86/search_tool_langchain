import { RunnableLambda } from "@langchain/core/runnables";
import { candidate } from "./types";
import { getChatModel } from "../shared/models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * 1. LÓGICA PURA (Apenas uma função de backend comum)
 */
async function callDirectLlm(input: { q: string }): Promise<candidate> {
  const model = getChatModel({ temperature: 0.2 });

  // Preparamos as mensagens
  const messages = [
    new SystemMessage(
      "You answer briefly and clearly for beginners. If unsure, say so.",
    ),
    new HumanMessage(input.q),
  ];

  // Chamamos o modelo
  const res = await model.invoke(messages);

  // Limpamos a string (convertendo para string se necessário e removendo espaços)
  const answer = String(res.content).trim();

  // Retornamos o objeto no formato "candidate"
  return {
    answer,
    sources: [],
    mode: "direct",
  };
}

/**
 * 2. O RUNNABLE (Apenas a exportação para o LangChain)
 */
export const directPath = RunnableLambda.from(callDirectLlm);
