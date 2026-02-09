import { RunnableBranch, RunnableSequence } from "@langchain/core/runnables";
import { webPath } from "./webPipeline";
import { directPath } from "./directPipeline";
import { routerStep } from "./routeStrategy";
import { finalValidateAndPolish } from "./finalValidate";
import { SearchInput } from "../utils/schemas";

/**
 * Interface que define o contrato de dados entre os passos.
 * Isso ajuda a evitar o 'any' e mantém o Acoplamento Eferente saudável.
 */
interface RoutedInput {
  q: string;
  mode: "web" | "direct";
}

/**
 * Definição do desvio de execução (Branching).
 * Nomeado de forma semântica para indicar que decide o pipeline de busca.
 */
const executionPathBranch = RunnableBranch.from<RoutedInput>([
  [(input) => input.mode === "web", webPath],
  directPath, // Caminho padrão (else)
]);

/**
 * ORQUESTRADOR DE BUSCA (Main Sequence)
 * Este é o coração do seu componente. Note como a leitura é linear:
 * 1. Roteia -> 2. Escolhe o Caminho -> 3. Valida e Refina
 */
export const searchChain = RunnableSequence.from([
  routerStep,
  executionPathBranch,
  finalValidateAndPolish,
]);

/**
 * PONTO DE ENTRADA (Facade)
 * Expõe a funcionalidade de forma simples para o resto do sistema.
 */
export async function runSearch(input: SearchInput) {
  try {
    return await searchChain.invoke(input);
  } catch (error) {
    // Aqui você separa a complexidade acidental de erros de infraestrutura
    console.error("Falha na execução do fluxo de busca:", error);
    throw error;
  }
}
