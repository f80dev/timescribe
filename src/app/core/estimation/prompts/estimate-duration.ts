/**
 * Schéma JSON strict attendu du LLM (cf §5.4 du CDC + ADR-002).
 *
 * Le contrat de sortie est porté par le prompt, pas par `response_format`
 * (utilise `json_object`, pas `json_schema` — bug reasoning parser MiniMax).
 *
 * Validé côté service via Zod pour rejeter les réponses mal formées.
 */
export interface LlmEstimationResponse {
  durationMinutes: number;          // > 0
  confidence: number;               // 0..1
  rationale: string;                // explication markdown
  similarTaskIds?: string[];        // optionnel
}

export interface LlmEstimationRequest {
  taskTitle: string;
  taskNotes?: string;
  corpusText: string;               // tronqué à corpusMaxChars côté orchestrateur
  historicalTasks: Array<{
    id: string;
    title: string;
    durationMinutes: number;
    source: 'manual' | 'llm';
  }>;
}

/**
 * Version de prompt. Incrémenté à chaque modification du template.
 * Affiché dans le payload envoyé au LLM pour traçabilité.
 */
export const PROMPT_VERSION = '1.0.0';

/**
 * Construit le system + user prompt pour MiniMax M3.
 *
 * Le system prompt impose :
 * - sortie JSON strict (parseable par JSON.parse)
 * - pas de markdown autour
 * - pas de texte avant/après
 *
 * Le user prompt injecte le contexte (corpus + historique + tâche cible).
 */
export function buildEstimationPrompt(req: LlmEstimationRequest): {
  system: string;
  user: string;
} {
  const historicalLines = req.historicalTasks.length
    ? req.historicalTasks
        .slice(0, 50)
        .map((t) => `- ${t.title} → ${t.durationMinutes} min (source: ${t.source})`)
        .join('\n')
    : '(aucun historique disponible)';
  const corpusPreview = req.corpusText
    ? req.corpusText.slice(0, 100_000)
    : '(aucun corpus documentaire)';

  const system = `Tu es un estimateur de charge de travail. Tu analyses une tâche et tu produis une estimation en minutes.
RÉPONDS UNIQUEMENT par un objet JSON valide (parseable par JSON.parse) avec ces champs EXACTS :
{
  "durationMinutes": number,        // entier > 0
  "confidence": number,             // 0..1, ta confiance dans l'estimation
  "rationale": string,              // explication courte en markdown (1-3 phrases)
  "similarTaskIds": string[]        // IDs de tâches historiques similaires (peut être vide)
}
Aucun texte autour, aucun markdown (pas de \`\`\`json), aucun commentaire. JSON strict uniquement.

Prompt version: ${PROMPT_VERSION}.`;

  const user = `# Tâche cible
Titre : ${req.taskTitle}
${req.taskNotes ? `Notes : ${req.taskNotes}` : ''}

# Historique (${req.historicalTasks.length} tâches évaluées)
${historicalLines}

# Corpus documentaire (extrait, ${corpusPreview.length} chars)
${corpusPreview}

# Question
Estime la durée réaliste de la tâche cible en te basant sur l'historique et le corpus ci-dessus.
Renvoie UNIQUEMENT l'objet JSON décrit dans le system prompt.`;

  return { system, user };
}