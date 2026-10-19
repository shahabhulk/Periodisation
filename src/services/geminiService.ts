import type {
  AIAnalysisReport,
  CalculatedSessionMetrics,
  CalculatedMicrocycleMetrics,
  CalculatedMesocycleMetrics,
  CalculatedMacrocycleMetrics,
} from './periodisationMetrics';
import { generateOfflineAnalysis } from './periodisationMetrics';
import {
  buildComprehensiveTrainingContext,
  type ComprehensiveTrainingContext,
} from './appDataService';

const STORAGE_API_KEY = 'gemini_api_key';
const STORAGE_MODEL_KEY = 'gemini_selected_model';
const DEFAULT_MODEL = 'gemini-3.8-flash';

export function getGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem(STORAGE_API_KEY) ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    ''
  );
}

export function setGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const clean = key.trim();
  if (clean) {
    localStorage.setItem(STORAGE_API_KEY, clean);
  } else {
    localStorage.removeItem(STORAGE_API_KEY);
  }
}

export function getSelectedGeminiModel(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL;
  const stored = localStorage.getItem(STORAGE_MODEL_KEY);
  // Migrate away from deprecated older models (1.5, 2.0, 2.5)
  if (
    !stored ||
    stored.includes('1.5') ||
    stored.includes('2.0') ||
    stored.includes('2.5')
  ) {
    localStorage.setItem(STORAGE_MODEL_KEY, DEFAULT_MODEL);
    return DEFAULT_MODEL;
  }
  return stored;
}

export function setSelectedGeminiModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_MODEL_KEY, model);
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey());
}

// Active supported models in 2026
export const ACTIVE_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

// Quick validation test with auto-fallback to active working model
export async function validateGeminiApiKey(
  apiKey: string,
  requestedModel?: string
): Promise<{ valid: boolean; resolvedModel?: string; error?: string }> {
  if (!apiKey.trim()) return { valid: false, error: 'API key is empty.' };

  const candidateModels = [
    requestedModel,
    getSelectedGeminiModel(),
    ...ACTIVE_GEMINI_MODELS,
  ].filter(Boolean) as string[];

  const uniqueModels = Array.from(new Set(candidateModels));
  let lastError = '';

  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with the word OK if you receive this.' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      if (response.ok) {
        setSelectedGeminiModel(model);
        return { valid: true, resolvedModel: model };
      }

      const errData = await response.json().catch(() => ({}));
      lastError = errData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;

      // If invalid key error, don't loop endlessly
      if (lastError.toLowerCase().includes('api_key_invalid') || lastError.toLowerCase().includes('api key not valid')) {
        return { valid: false, error: 'API Key not valid. Please check your key from Google AI Studio.' };
      }
    } catch (err: any) {
      lastError = err?.message || 'Network error connecting to Gemini.';
    }
  }

  return { valid: false, error: lastError };
}

// -----------------------------------------------------------------
// Cache Helpers
// -----------------------------------------------------------------
const memoryCache: Record<string, AIAnalysisReport> = {};

function getCacheKey(level: string, id: string, signature: string): string {
  return `ai_analysis_${level}_${id}_${signature}`;
}

export function clearAnalysisCache(): void {
  Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ai_analysis_')) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

// -----------------------------------------------------------------
// Core AI Analysis Dispatcher
// -----------------------------------------------------------------

interface AnalyzeParams {
  level: 'session' | 'microcycle' | 'mesocycle' | 'macrocycle';
  targetId: string;
  targetName: string;
  metrics: CalculatedSessionMetrics | CalculatedMicrocycleMetrics | CalculatedMesocycleMetrics | CalculatedMacrocycleMetrics;
  meta?: {
    phaseKey?: string;
    strategyNotes?: string;
    targets?: any[];
    dietNote?: string;
    statusNote?: string;
    recentPRs?: string[];
    selectedLift?: string;
    equipmentFilter?: string;
    trainingContext?: ComprehensiveTrainingContext;
    allMesocycles?: any[];
    allPrs?: any[];
    workoutEntries?: any[];
  };
  forceRefresh?: boolean;
}

export async function requestPeriodisationAnalysis({
  level,
  targetId,
  targetName,
  metrics,
  meta,
  forceRefresh = false,
}: AnalyzeParams): Promise<AIAnalysisReport> {
  const apiKey = getGeminiApiKey();

  // Signature based on metrics to invalidate cache when data changes
  const signature = `${JSON.stringify(metrics).length}_${meta?.strategyNotes?.slice(0, 20) || ''}`;
  const cacheKey = getCacheKey(level, targetId, signature);

  if (!forceRefresh) {
    if (memoryCache[cacheKey]) return memoryCache[cacheKey];
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache[cacheKey] = parsed;
        return parsed;
      }
    } catch {
      // Continue
    }
  }

  // Build or resolve comprehensive training context covering all 12 phases & history
  const trainingContext =
    meta?.trainingContext ||
    buildComprehensiveTrainingContext({
      mesocycles: meta?.allMesocycles,
      prLog: meta?.allPrs,
      workoutEntries: meta?.workoutEntries,
      selectedLift: meta?.selectedLift,
    });

  // If no API key is available, run local deterministic sports-science engine immediately
  if (!apiKey) {
    const offlineReport = generateOfflineAnalysis(level, metrics, { ...meta, trainingContext });
    offlineReport.targetName = targetName;
    memoryCache[cacheKey] = offlineReport;
    return offlineReport;
  }

  // Build System Prompt & Full Cross-Phase Context for Gemini
  const prompt = buildPeriodisationPrompt(level, targetName, metrics, meta, trainingContext);

  const candidateModels = Array.from(
    new Set([getSelectedGeminiModel(), ...ACTIVE_GEMINI_MODELS])
  );

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25, // low temperature for precise, disciplined sports science
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = cleanAndParseJSON(rawText);
      const report: AIAnalysisReport = {
        level,
        targetName,
        status: parsed.status || 'Optimal Adaptation',
        statusColor: getStatusColor(parsed.status),
        score: typeof parsed.score === 'number' ? parsed.score : 85,
        summary: parsed.summary || 'Training metrics evaluated against periodisation targets.',
        diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : ['Adaptation trajectory matches expected response.'],
        prescriptions: Array.isArray(parsed.prescriptions) ? parsed.prescriptions : ['Proceed with planned progressive overload.'],
        metricsHighlights: Array.isArray(parsed.metricsHighlights) ? parsed.metricsHighlights : [],
        isOfflineHeuristic: false,
        timestamp: new Date().toISOString(),
      };

      // Cache result & remember working model
      setSelectedGeminiModel(model);
      memoryCache[cacheKey] = report;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(report));
      } catch {
        // Ignore storage quota
      }

      return report;
    } catch (err) {
      console.warn(`Error generating AI analysis with model ${model}:`, err);
    }
  }

  // Fallback to local deterministic engine if all models fail
  console.warn('All Gemini models failed, falling back to local deterministic S&C engine.');
  const fallback = generateOfflineAnalysis(level, metrics, { ...meta, trainingContext });
  fallback.targetName = targetName;
  return fallback;
}

// -----------------------------------------------------------------
// Mesocycle Strategy Generation
// -----------------------------------------------------------------

export async function suggestMesocycleStrategy(
  phase: string,
  microcycleCount: number,
  previousMesoSummary?: string,
  userGoal?: string,
  trainingContextParam?: ComprehensiveTrainingContext
): Promise<{ strategyNotes: string; suggestedTargets: { exercise: string; target: string }[] }> {
  const apiKey = getGeminiApiKey();

  // Resolve training context across all phases
  const trainingContext =
    trainingContextParam ||
    buildComprehensiveTrainingContext();

  const priorPhase =
    trainingContext.previousPhases.length > 0
      ? trainingContext.previousPhases[trainingContext.previousPhases.length - 1]
      : null;

  const priorSummaryText = priorPhase
    ? `Phase ${priorPhase.index} (${priorPhase.name} - ${priorPhase.phaseKey}): Total volume ${(priorPhase.totalVolume / 1000).toFixed(1)}k kg across ${priorPhase.workoutDaysCount} workouts. Peak lifts: ${Object.entries(priorPhase.peakLifts).map(([n, s]) => `${n} ${s.weight}kg`).join(', ') || 'steady compound work'}. PRs hit: ${priorPhase.prsLogged.map((p) => p.text).join(', ') || 'None'}. Strategy: "${priorPhase.notes || 'None'}"`
    : previousMesoSummary || 'First block in periodisation macrocycle.';

  if (!apiKey) {
    // Deterministic fallback templates informed by actual previous block data
    const benchPeak = priorPhase?.peakLifts?.['Bench Press']?.weight || 100;
    const squatPeak = priorPhase?.peakLifts?.['Squat']?.weight || 120;

    if (phase === 'Hypertrophy') {
      return {
        strategyNotes: `Accumulate high-quality volume over ${microcycleCount} microcycles building on your previous block (${priorPhase ? priorPhase.phaseKey : 'baseline'}). Keep primary compound lifts at RPE 7.5–8.5 in weeks 1–${Math.max(1, microcycleCount - 2)}, then push to RPE 9. Progress through adding working sets before adding weight.`,
        suggestedTargets: [
          { exercise: 'Bench Press', target: `${Math.round(benchPeak * 0.8)}kg for 3-4 sets x 8 reps` },
          { exercise: 'Squat', target: `${Math.round(squatPeak * 0.78)}kg for 3 sets x 8-10 reps` },
          { exercise: 'Volume Milestone', target: '+10% volume load over block' },
        ],
      };
    }
    if (phase === 'Strength') {
      return {
        strategyNotes: `Progressive overload with intensity ramp building upon your previous ${priorPhase ? priorPhase.phaseKey : 'foundation'}. Hold total sets moderate while ramping intensity from 80% to 90% of 1RM. Top sets should be kept clean at RPE 8–9 without grinding to failure.`,
        suggestedTargets: [
          { exercise: 'Bench Press', target: `Top triple at ${Math.round(benchPeak * 0.92)}kg by week ${Math.max(1, microcycleCount - 1)}` },
          { exercise: 'Squat', target: `Top set of 4 at ${Math.round(squatPeak * 0.9)}kg` },
          { exercise: 'Heavy Compound', target: '3x3-5 reps progressive' },
        ],
      };
    }
    if (phase === 'Deload') {
      return {
        strategyNotes: `Dissipate acute and systemic fatigue accumulated from ${priorPhase ? `Phase ${priorPhase.index} (${priorPhase.phaseKey})` : 'recent hard training'}. Cut working sets by 45–50% while maintaining load intensity at ~80% of current 1RM to keep motor unit firing patterns primed. Zero failure sets.`,
        suggestedTargets: [
          { exercise: 'Bench Press', target: `2 sets x 3 reps @ ${Math.round(benchPeak * 0.75)}kg (fast velocity)` },
        ],
      };
    }
    return {
      strategyNotes: `Focused training phase balancing technical execution with sustainable progressive overload over ${microcycleCount} microcycles.`,
      suggestedTargets: [{ exercise: 'Primary Movement', target: 'Technical mastery & consistent progression' }],
    };
  }

  const prompt = `
You are an elite Strength & Conditioning Scientist. Suggest a concise, highly actionable periodisation strategy and 2-3 specific measurable targets for an upcoming mesocycle.

PHASE TYPE: ${phase}
DURATION: ${microcycleCount} microcycles (weeks)
PRIOR MESOCYCLE PERFORMANCE & CONTEXT:
${priorSummaryText}

ALL-TIME PERSONAL RECORDS:
${Object.values(trainingContext.allTimeRecords).map((r) => `• ${r.lift}: ${r.maxWeight}kg on ${r.date}`).join('\n')}

${userGoal ? `ATHLETE GOAL: ${userGoal}` : ''}

CRITICAL RULES:
1. Ground your targets directly in their REAL past numbers (look at the peak lifts and PRs above!).
2. For ${phase} phase: recommend concrete weights and sets based on their peak numbers.
3. Speak in clear, friendly, motivating coach terms.

Respond in strict JSON format:
{
  "strategyNotes": "2-3 sentences of exact coaching strategy, RPE boundaries, volume accumulation rate, and fatigue management rules.",
  "suggestedTargets": [
    { "exercise": "Bench Press", "target": "e.g. 125kg x 3 by week 4" },
    { "exercise": "Volume Milestone", "target": "e.g. +10% chest tonnage without RPE > 9" }
  ]
}
`;

  try {
    const model = getSelectedGeminiModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        return cleanAndParseJSON(rawText);
      }
    }
  } catch (err) {
    console.error('Failed to generate AI mesocycle strategy:', err);
  }

  // Fallback
  return {
    strategyNotes: `Progressive overload block focusing on ${phase.toLowerCase()} adaptations with disciplined volume and RPE management.`,
    suggestedTargets: [{ exercise: 'Main Lift', target: 'Progressive overload across the block' }],
  };
}

// -----------------------------------------------------------------
// Interactive Conversational Chat with Coach AI
// -----------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export function generateOfflineCoachReply(
  userMessage: string,
  context: {
    level: string;
    targetName: string;
    selectedLift?: string;
    phaseKey?: string;
    metrics: any;
    strategyNotes?: string;
    trainingContext?: ComprehensiveTrainingContext;
    allMesocycles?: any[];
    allPrs?: any[];
    workoutEntries?: any[];
  }
): string {
  const msgLower = (userMessage || '').toLowerCase();
  const selectedLift = context.selectedLift && context.selectedLift !== 'all' ? context.selectedLift : 'training';
  const phase = context.phaseKey || 'Hypertrophy';
  const metrics = context.metrics || {};
  const peak1RM = metrics.peak1RM || metrics.peakWeight || 110;
  const totalVolume = metrics.totalVolume || 9800;
  const avgWeeklyVolume = metrics.avgWeeklyVolume || totalVolume;
  const totalSets = metrics.totalSets || metrics.workingSets || 17;
  const volProg = metrics.volumeProgressionRatePct || metrics.volumeChangeFromPriorPct || 14;

  const trainingCtx =
    context.trainingContext ||
    buildComprehensiveTrainingContext({
      mesocycles: context.allMesocycles,
      prLog: context.allPrs,
      workoutEntries: context.workoutEntries,
      selectedLift: context.selectedLift,
    });

  // 1. Asking about previous phases, all phases, or cross-phase comparisons
  if (
    msgLower.includes('previous phase') ||
    msgLower.includes('last phase') ||
    msgLower.includes('earlier phase') ||
    msgLower.includes('all phase') ||
    msgLower.includes('phase 1') ||
    msgLower.includes('phase 2') ||
    msgLower.includes('compare') ||
    msgLower.includes('progression') ||
    msgLower.includes('across phase')
  ) {
    const prior = trainingCtx.previousPhases.length > 0
      ? trainingCtx.previousPhases[trainingCtx.previousPhases.length - 1]
      : null;
    const curr = trainingCtx.currentPhase;

    if (prior && curr) {
      const volDelta = trainingCtx.crossPhaseProgression.currentVsPreviousComparison.volumeDeltaPct;
      const deltaText = volDelta !== undefined ? (volDelta >= 0 ? `+${volDelta}%` : `${volDelta}%`) : 'calibrated';
      return `Looking across all your phases in Iron Ledger:
• Preceding Block (Phase ${prior.index} - ${prior.name}): Accumulated ${(prior.totalVolume / 1000).toFixed(1)}k kg of volume across ${prior.workoutDaysCount} workouts with peak ${selectedLift} at ${prior.peak1RM}kg.
• Current Block (Phase ${curr.index} - ${curr.name}): You have logged ${(curr.totalVolume / 1000).toFixed(1)}k kg volume (${deltaText} compared to Phase ${prior.index}) with top strength at ${curr.peak1RM}kg.
${curr.phaseKey === 'Peaking' ? 'Because this is a Peaking phase, your volume naturally tapers so your fatigue drops and your power explodes for heavy singles!' : 'You are maintaining sustainable progressive overload across blocks!'} You have completed ${trainingCtx.totalWorkoutsLogged} total sessions across all ${trainingCtx.allPhases.length} phases!`;
    }

    const phasesOverview = trainingCtx.allPhases
      .slice(0, 4)
      .map((p) => `Phase ${p.index} (${p.phaseKey}): ${(p.totalVolume / 1000).toFixed(1)}k kg`)
      .join(', ');
    return `You have a comprehensive record of ${trainingCtx.allPhases.length} phases (${trainingCtx.totalWorkoutsLogged} sessions logged). Early blocks (${phasesOverview}) laid your foundation, and your strength has progressed steadily up to ${peak1RM}kg today!`;
  }

  // 2. Asking about all-time PRs or personal bests
  if (
    msgLower.includes('pr') ||
    msgLower.includes('personal record') ||
    msgLower.includes('best lift') ||
    msgLower.includes('max lift') ||
    msgLower.includes('all time')
  ) {
    const prLines = Object.values(trainingCtx.allTimeRecords)
      .map((r) => `• ${r.lift}: ${r.maxWeight}kg (${r.date}${r.notes ? ` - ${r.notes}` : ''})`)
      .join('\n');
    return `Here are your all-time recorded personal records from the app:
${prLines || `• ${selectedLift}: ${peak1RM}kg`}
Great lifting history! Keep focusing on clean execution and progressive overload to set your next milestone.`;
  }

  // 3. Asking about diet or nutrition
  if (msgLower.includes('diet') || msgLower.includes('food') || msgLower.includes('eat') || msgLower.includes('protein') || msgLower.includes('nutrition')) {
    const recentMeals = trainingCtx.recentDiets.slice(0, 3).map((d) => `• [${d.date}]: ${d.diet}`).join('\n');
    return `Here is a review of your recent nutrition logs:
${recentMeals || '• Ensure 1.6–2.2g of protein per kg of bodyweight daily.'}
For this ${phase} phase, focus on eating a high-protein meal 2 hours before heavy training and getting enough carbohydrates to recharge your muscle glycogen!`;
  }

  // 4. Asking about volume appropriateness
  if (
    msgLower.includes('volume') &&
    (msgLower.includes('appropriate') ||
      msgLower.includes('enough') ||
      msgLower.includes('too much') ||
      msgLower.includes('good') ||
      msgLower.includes('right') ||
      msgLower.includes('safe'))
  ) {
    if (phase === 'Hypertrophy') {
      return `Yes, your volume for this Hypertrophy phase is looking really solid! You have completed ${totalSets} working sets with around ${(avgWeeklyVolume / 1000).toFixed(1)}k kg of volume per week for ${selectedLift}. For building muscle (Hypertrophy), the sweet spot is typically 12–18 hard working sets per muscle group each week with 1–2 reps in reserve. Since your volume expanded cleanly without extreme rep drop-offs, you are creating the progressive overload needed for growth. Keep adding 1–2.5kg when sets feel smooth!`;
    }
    if (phase === 'Peaking') {
      if (volProg > 15) {
        return `Right now, your volume is actually running a bit high for a Peaking phase (+${volProg}% growth). In Peaking, doing too many working sets builds up fatigue and makes you too tired to express your heaviest 1RM single. Next week, cut your back-off sets in half, keep 1–2 heavy singles at ~90% with 3–5 minutes rest, and stay fresh to test your max (${peak1RM}kg)!`;
      }
      return `Your volume is right where it needs to be for Peaking! You are keeping total sets controlled (${totalSets} sets) so fatigue stays low while holding heavy weights. Stick to crisp singles with 1 rep in reserve.`;
    }
    if (phase === 'Strength') {
      return `Your volume is well-balanced for a Strength block: ${totalSets} working sets with steady weekly load (${(avgWeeklyVolume / 1000).toFixed(1)}k kg). Keep your sets in the 3–5 rep range at 80–88% intensity. Focus on moving the bar fast on the way up rather than adding extra junk sets.`;
    }
    if (phase === 'Deload') {
      return `For a Deload phase, cut your volume in half (${Math.round(totalSets * 0.5)} sets max). Lift around 65–70% of your max and stop every set with 3–4 reps left in the tank so your joints and muscles can fully recharge.`;
    }
    return `Your volume is steady at ${totalSets} sets (~${(avgWeeklyVolume / 1000).toFixed(1)}k kg/week). As long as your joints feel good and you have 1–2 reps in reserve, you are in the optimal training zone.`;
  }

  // 5. Asking how to adjust volume or sets next week
  if (msgLower.includes('adjust') || (msgLower.includes('next week') && (msgLower.includes('volume') || msgLower.includes('sets')))) {
    if (phase === 'Peaking') {
      return `Here is your game plan for next week: Cut your back-off volume by 40% to 50%! Keep only 1–2 heavy top singles or doubles with your top weight (~${peak1RM}kg) and drop the extra sets. Resting 3 to 5 minutes between sets will allow you to hit a personal record.`;
    }
    if (phase === 'Hypertrophy') {
      return `Next week: Add 1–2.5kg to your primary ${selectedLift} working sets if you completed all target reps with 1–2 reps in reserve. If recovery feels green, you can add 1 extra set on your secondary accessory lift.`;
    }
    if (phase === 'Deload') {
      return `Next week is an easy deload: cut your working sets down to just 2 easy sets per exercise at 65–70% of your max. Zero grinding, zero failure sets.`;
    }
    return `Next week, keep your sets the same and aim to add 1–2.5kg to your top working weight, or add 1 clean rep to your working sets while keeping solid technique.`;
  }

  // 6. Asking about warm-ups and top sets
  if (msgLower.includes('warm') || msgLower.includes('top set') || msgLower.includes('warmup')) {
    const topWt = peak1RM > 0 ? peak1RM : 100;
    return `Here is the recommended warmup and working set structure for ${selectedLift} (based on your ~${topWt}kg peak):
• Warmup 1: Empty bar × 10 reps (warm up joints and groove bar path)
• Warmup 2: ${Math.round(topWt * 0.5)}kg × 6 reps
• Warmup 3: ${Math.round(topWt * 0.72)}kg × 3 reps
• Top Set: ${Math.round(topWt * 0.88)}kg for 3–5 reps (RPE 8, keep 2 reps in the tank)
• Back-off Volume: 2–3 sets of 5 reps at ${Math.round(topWt * 0.8)}kg with 3 minutes rest.`;
  }

  // 7. Asking about deload timing
  if (msgLower.includes('deload') || msgLower.includes('rest') || msgLower.includes('tired')) {
    return `You should schedule a deload week if:
1. Your top strength drops for 2 weeks in a row on ${selectedLift}.
2. Your joints, shoulders, or lower back feel consistently achy.
3. You have completed 4 to 6 weeks of hard progressive overload.
During your deload week, cut your total sets in half and keep the weights at 65–70% so you bounce back fresh and explosive!`;
  }

  // 8. Default intelligent coaching advice with cross-phase grounding
  return `Looking at your ${selectedLift} data for ${context.targetName} (${phase} phase): Your peak strength is at ${peak1RM}kg across ${totalSets} working sets (with ${trainingCtx.allPhases.length} total phases logged). Focus on crisp bar speed, keep 1–2 reps in reserve, and ensure you are getting 8+ hours of sleep and adequate protein to fuel recovery. Let me know if you want to compare your numbers to previous phases or get a custom set adjustment!`;
}

export async function sendAICoachChatMessage(
  history: ChatMessage[],
  userMessage: string,
  context: {
    level: string;
    targetName: string;
    selectedLift?: string;
    phaseKey?: string;
    metrics: any;
    strategyNotes?: string;
    trainingContext?: ComprehensiveTrainingContext;
    allMesocycles?: any[];
    allPrs?: any[];
    workoutEntries?: any[];
  }
): Promise<string> {
  const apiKey = getGeminiApiKey();

  const trainingCtx =
    context.trainingContext ||
    buildComprehensiveTrainingContext({
      mesocycles: context.allMesocycles,
      prLog: context.allPrs,
      workoutEntries: context.workoutEntries,
      selectedLift: context.selectedLift,
    });

  if (!apiKey) {
    return generateOfflineCoachReply(userMessage, { ...context, trainingContext: trainingCtx });
  }

  const selectedLift = context.selectedLift && context.selectedLift !== 'all' ? context.selectedLift : 'All Lifts';

  const systemPrompt = `
You are a knowledgeable, friendly Strength & Conditioning Coach talking directly with your lifter.

COMMUNICATION RULES (CRITICAL):
1. EXPLAIN EVERYTHING IN CLEAR, SIMPLE LAYMAN TERMS!
2. Absolutely DO NOT use dense academic or biological jargon.
   - BANNED WORDS/PHRASES: "motor unit recruitment", "ATP-CP resynthesis", "fatigue debt", "intra-cycle fatigue dissipation", "secondary overreaching", "tissue readiness", "glycogen depletion", "acute-to-chronic workload ratio".
   - INSTEAD USE PLAIN GYM WORDS: "your muscles were exhausted / running out of steam", "recharging your energy", "giving your joints time to heal", "resting 3 minutes between heavy sets so you're at 100%", "leaving 2 reps in the tank".
3. FULL ACCESS TO ALL DATA IN THE APP:
   - You have complete, live access to ALL 12 mesocycles (previous phases and current phase), all 377+ workout session logs, all-time PRs, nutrition/diet logs, and physio notes provided below.
   - When the lifter asks about PREVIOUS PHASES (e.g. Phase 1, Phase 2, prior volume, past PRs):
     Provide the EXACT numbers, dates, weights, sets, and volume from those phases!
   - Compare current performance directly to earlier phases (e.g. volume shifts, strength gains from Meso 1 to Meso 12).
   - When asked about all-time PRs or records, cite their real numbers (e.g. Bench 120kg, 125kg, 130kg, 130kg with elbow wraps, Squat 130kg, 140kg, DB Bench 60kg each side).
4. Speak like an experienced, real-world gym coach talking to a lifter: warm, direct, encouraging, practical, and clear.
5. FINISH YOUR THOUGHTS COMPLETELY. Do not stop mid-sentence.
6. If the user asks for a workout session or how to adjust their sets/volume, give them the exact exercises, warmup sets, working sets, weights, and reps in clean bullet points.

CURRENT LEVEL CONTEXT:
- Tier: ${context.level} (${context.targetName})
- Lift Focus: ${selectedLift}
- Current Phase: ${context.phaseKey || 'General'}
- Strategy Notes: "${context.strategyNotes || 'None'}"
- Training Numbers & Metrics: ${JSON.stringify(context.metrics)}

${trainingCtx.formattedContextString}
`;

  const contents: any[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: `Got it! I am ready to coach you on ${context.targetName} (${selectedLift}) with full access to all your 12 training phases and workout logs. What do you need help with?` }] },
  ];

  history.slice(-8).forEach((m) => {
    contents.push({
      role: m.role,
      parts: [{ text: m.text }],
    });
  });

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  const candidateModels = Array.from(
    new Set([getSelectedGeminiModel(), ...ACTIVE_GEMINI_MODELS])
  );

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2500, // Large ceiling to prevent cutting off mid-sentence
          },
        }),
      });

      if (!response.ok) {
        // If server is overloaded or model deprecated, try next model in fallback list
        continue;
      }

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply && reply.trim()) {
        setSelectedGeminiModel(model);
        return reply.trim();
      }
    } catch {
      // Continue to next model
    }
  }

  // Graceful intelligent fallback so the user NEVER sees an API error message
  return generateOfflineCoachReply(userMessage, { ...context, trainingContext: trainingCtx });
}

// -----------------------------------------------------------------
// Prompt Construction
// -----------------------------------------------------------------

function buildPeriodisationPrompt(
  level: string,
  targetName: string,
  metrics: any,
  meta?: any,
  trainingContext?: ComprehensiveTrainingContext
): string {
  const selectedLift = meta?.selectedLift || metrics?.selectedLift || 'All Lifts';
  return `
You are an experienced, elite Strength & Conditioning Coach talking directly to your lifter in plain, everyday English.

COMMUNICATION RULES (STRICT):
1. EXPLAIN EVERYTHING IN SIMPLE, PLAIN ENGLISH LAYMAN TERMS!
2. DO NOT use dense academic or biological textbook jargon.
   - NEVER use words like: "compromised motor unit recruitment", "fatigue debt", "ATP-CP resynthesis", "intra-cycle fatigue dissipation", "secondary overreaching", "tissue readiness", "glycogen depletion", "acute-to-chronic workload ratio".
   - INSTEAD use clear gym words: "your muscles were completely exhausted / too tired to push the weight", "recharging your energy", "giving your joints and muscles time to heal", "resting 3 minutes between heavy sets so you have 100% power", "leaving 2 reps in the tank".
3. Speak like a real human coach in the gym talking to a lifter: clear, motivating, direct, and practical.
4. SPECIFIC LIFT FOCUS: "${selectedLift}".
   ${selectedLift !== 'all' ? `All your diagnostics, performance remarks, and prescriptions MUST specifically center around the athlete's ${selectedLift} performance, loads, and volume!` : ''}
5. In a Peaking phase: explain simply that doing too much volume builds fatigue and makes you too tired to hit your heaviest 1RM max. To peak, cut back-off sets in half and stay fresh.
6. Diagnostics: explain in plain words WHY things happened (e.g. "You jumped your volume too fast this week without enough rest days, which is why your muscles were exhausted and you missed reps on 100kg").
7. Prescriptions: give exact, simple directions (e.g. "Deload next week: drop bench to 2 light sets of 80kg with 3 reps in the tank to let your body heal and bounce back stronger").
8. CROSS-PHASE COMPARISON & HISTORICAL INTEGRATION:
   - You have complete access to the athlete's entire periodisation history below across all 12 mesocycle phases.
   - In your diagnostics and summary, COMPARE this ${level} performance to their previous phases (e.g., comparing volume growth, fatigue dissipation, strength progression from Phase 1 Hypertrophy to now).
   - Reference their real all-time PRs where appropriate.

EVALUATION TARGET CONTEXT:
- Periodisation Level: ${level.toUpperCase()} ("${targetName}")
- Targeted Lift Focus: ${selectedLift}
${meta?.phaseKey ? `- Current Phase: ${meta.phaseKey}` : ''}
${meta?.strategyNotes ? `- Planned Strategy Notes: "${meta.strategyNotes}"` : ''}
${meta?.statusNote ? `- Daily Status / Physio Note: "${meta.statusNote}"` : ''}
${meta?.dietNote ? `- Nutrition / Diet Note: "${meta.dietNote}"` : ''}
${meta?.targets ? `- Phase Targets: ${JSON.stringify(meta.targets)}` : ''}

METRICS DATA FOR CURRENT TARGET:
${JSON.stringify(metrics, null, 2)}

${trainingContext ? trainingContext.formattedContextString : ''}

You MUST return your answer in this exact JSON schema:
{
  "status": "Optimal Adaptation" | "Productive Accumulation" | "Peak Performance" | "Fatigue Accumulating" | "Deload Triggered" | "Active Recovery",
  "score": 85, // 0 to 100 execution score
  "summary": "Punchy 1-2 sentence coach summary of this ${selectedLift} cycle in plain English layman terms.",
  "diagnostics": [
    "Diagnostic point 1: plain explanation of how the body responded and why reps or strength changed.",
    "Diagnostic point 2: fatigue level, consistency, or lifting form/speed observation comparing to previous phases."
  ],
  "prescriptions": [
    "Prescriptive step 1: concrete, simple load/set/rep change or rest tweak for the next workout/cycle.",
    "Prescriptive step 2: recovery or accessory advice in plain words."
  ],
  "metricsHighlights": [
    { "label": "${selectedLift !== 'all' ? selectedLift : 'Top'} 1RM", "value": "120 kg", "hint": "Estimated max" }
  ]
}
`;
}

function cleanAndParseJSON(rawText: string): any {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Optimal Adaptation':
      return '#10b981'; // emerald
    case 'Productive Accumulation':
      return '#3b82f6'; // blue
    case 'Peak Performance':
      return '#8b5cf6'; // purple
    case 'Fatigue Accumulating':
      return '#f59e0b'; // amber
    case 'Deload Triggered':
      return '#06b6d4'; // cyan
    case 'Active Recovery':
      return '#ec4899'; // pink
    default:
      return '#10b981';
  }
}

// -----------------------------------------------------------------
// AI Workout Session Designer
// -----------------------------------------------------------------

export interface DesignedSet {
  type: string; // "W" or "1", "2", "3"
  weight: number | string;
  reps: number | string;
  rpe?: number;
}

export interface DesignedLift {
  name: string;
  unit: string;
  notes?: string;
  sets: DesignedSet[];
}

export interface DesignedWorkoutSession {
  title: string;
  bodyTags: string[];
  rationale: string; // Plain English layman explanation
  warmupNotes?: string;
  lifts: DesignedLift[];
  coachingTips: string[];
  isOfflineFallback?: boolean;
}

export interface DesignSessionParams {
  previousWorkouts: any[];
  currentPhase?: string;
  userNeed: string;
  targetDurationMinutes?: number;
  targetIntensity?: 'heavy' | 'moderate' | 'light';
  selectedLift?: string;
  trainingContext?: ComprehensiveTrainingContext;
}

export async function designWorkoutSession(params: {
  previousWorkouts: any[];
  currentPhase?: string;
  userNeed: string;
  targetDurationMinutes?: number;
  targetIntensity?: 'heavy' | 'moderate' | 'light';
  selectedLift?: string;
  trainingContext?: ComprehensiveTrainingContext;
}): Promise<DesignedWorkoutSession> {
  const apiKey = getGeminiApiKey();

  const trainingCtx = params.trainingContext || buildComprehensiveTrainingContext();

  // Prepare a compact summary of past workouts for context
  const historySummary = (params.previousWorkouts || []).slice(0, 5).map((w: any) => {
    const liftSummaries = (w.lifts || []).map((l: any) => {
      const setsStr = (l.sets || [])
        .map((s: any) => `${s.weight}kg x ${s.reps}${s.type === 'W' ? ' (warmup)' : ''}`)
        .join(', ');
      return `${l.name}: [${setsStr}]`;
    }).join('; ');
    return `- ${w.date || 'Recent'} (${w.title || 'Workout'}): ${liftSummaries || 'No lift data'}`;
  }).join('\n');

  const prSummary = Object.values(trainingCtx.allTimeRecords)
    .map((r) => `• ${r.lift}: ${r.maxWeight}kg (Est 1RM: ${r.peak1RM}kg) on ${r.date}`)
    .join('\n');

  if (apiKey) {
    const candidateModels = Array.from(
      new Set([getSelectedGeminiModel(), ...ACTIVE_GEMINI_MODELS])
    );

    const prompt = `
You are an experienced, supportive Strength & Conditioning Coach designing the athlete's next workout session.

ATHLETE'S DESIRED NEED / GOAL:
"${params.userNeed || 'General strength & hypertrophy workout'}"

CURRENT TRAINING PHASE: ${params.currentPhase || 'Hypertrophy'}
TARGET SESSION TIME: ${params.targetDurationMinutes || 60} minutes
INTENSITY LEVEL: ${params.targetIntensity || 'moderate'}

ATHLETE ALL-TIME PERSONAL RECORDS:
${prSummary || 'No PRs recorded yet.'}

ATHLETE'S PREVIOUS WORKOUT SESSIONS:
${historySummary || 'No prior workout history recorded yet. Program a well-balanced starter session.'}

CRITICAL RULES (STRICT):
1. EXPLAIN EVERYTHING IN CLEAR, SIMPLE LAYMAN TERMS!
   - Absolutely no medical or academic jargon.
   - Speak like a friendly coach in the gym giving your lifter their daily program.
2. BUILD ON THEIR PREVIOUS LIFTS:
   - Look at the weights they actually lifted recently.
   - If they hit Bench Press 100kg for reps recently, program weights around that number (e.g. warmup with 60kg, 80kg, then working sets with 90-105kg).
   - If user asks for a deload, drop working weights to 65-70% and reduce sets.
3. STRUCTURE:
   - 1-2 primary compound lifts with 1-2 warmup sets (type: "W") and 2-4 working sets (type: "1", "2", "3").
   - 2-3 accessory / hypertrophy exercises with 2-3 working sets each.
4. "rationale": write 2-3 clear, friendly sentences explaining in plain English WHY this workout was designed this way based on their previous training.
5. Return strictly valid JSON matching this schema:
{
  "title": "e.g. Heavy Bench Press & Chest Volume",
  "bodyTags": ["chest", "shoulders", "triceps"],
  "rationale": "Plain English explanation of why these exercises, sets, and weights were chosen.",
  "warmupNotes": "5-10 min light cardio and shoulder dislocations / arm swings",
  "lifts": [
    {
      "name": "Bench Press",
      "unit": "kg",
      "notes": "Keep shoulders pinched, push hard off the chest",
      "sets": [
        { "type": "W", "weight": 60, "reps": 8 },
        { "type": "W", "weight": 85, "reps": 4 },
        { "type": "1", "weight": 100, "reps": 5, "rpe": 8 },
        { "type": "2", "weight": 100, "reps": 5, "rpe": 8 },
        { "type": "3", "weight": 95, "reps": 6, "rpe": 8.5 }
      ]
    },
    {
      "name": "Incline Dumbbell Press",
      "unit": "kg",
      "notes": "Full stretch at the bottom",
      "sets": [
        { "type": "1", "weight": 32, "reps": 8 },
        { "type": "2", "weight": 32, "reps": 8 },
        { "type": "3", "weight": 32, "reps": 8 }
      ]
    }
  ],
  "coachingTips": [
    "Leave 1-2 reps in the tank on all working sets.",
    "Rest 2-3 minutes on main barbell movements."
  ]
}
`;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
              maxOutputTokens: 2800,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = cleanAndParseJSON(raw);
            if (parsed && parsed.title && Array.isArray(parsed.lifts)) {
              setSelectedGeminiModel(model);
              return {
                ...parsed,
                isOfflineFallback: false,
              };
            }
          }
        }
      } catch (err) {
        console.warn(`Error generating workout session with model ${model}:`, err);
      }
    }
  }

  // Deterministic Local Heuristic Fallback
  return generateOfflineDesignedSession(params);
}

function generateOfflineDesignedSession(params: {
  previousWorkouts: any[];
  currentPhase?: string;
  userNeed: string;
  targetIntensity?: string;
}): DesignedWorkoutSession {
  const needLower = (params.userNeed || '').toLowerCase();
  const phase = params.currentPhase || 'Hypertrophy';

  // Find recent top weights from previous workouts
  let benchTop = 100;
  let squatTop = 120;
  let deadliftTop = 140;

  (params.previousWorkouts || []).forEach((w: any) => {
    (w.lifts || []).forEach((l: any) => {
      const name = (l.name || '').toLowerCase();
      (l.sets || []).forEach((s: any) => {
        const wt = parseFloat(String(s.weight)) || 0;
        if (name.includes('bench') && wt > benchTop) benchTop = wt;
        if (name.includes('squat') && wt > squatTop) squatTop = wt;
        if (name.includes('deadlift') && wt > deadliftTop) deadliftTop = wt;
      });
    });
  });

  const isDeload = needLower.includes('deload') || needLower.includes('recovery') || phase === 'Deload';
  const isSquat = needLower.includes('squat') || needLower.includes('leg');
  const isDeadlift = needLower.includes('deadlift') || needLower.includes('back') || needLower.includes('pull');

  if (isSquat) {
    const workWt = Math.round(isDeload ? squatTop * 0.65 : squatTop * 0.82);
    const warmup1 = Math.round(squatTop * 0.5);
    const warmup2 = Math.round(squatTop * 0.7);

    return {
      title: isDeload ? 'Squat Recovery & Mobility' : 'Squat Strength & Quad Volume',
      bodyTags: ['legs', 'core'],
      rationale: isDeload
        ? `Since you requested a recovery session, we cut your squat weight down to ${workWt}kg with just 2 easy sets so your knees and lower back can heal.`
        : `Based on your recent squat workouts (top weight ~${squatTop}kg), today we work with ${workWt}kg for solid volume, followed by leg press and lunges to build your quads.`,
      warmupNotes: '5 mins bike + leg swings and bodyweight squats.',
      lifts: [
        {
          name: 'Squat',
          unit: 'kg',
          notes: 'Keep your chest tall, drive knees out, and control the descent',
          sets: isDeload
            ? [
                { type: 'W', weight: warmup1, reps: 6 },
                { type: '1', weight: workWt, reps: 5, rpe: 6 },
                { type: '2', weight: workWt, reps: 5, rpe: 6 },
              ]
            : [
                { type: 'W', weight: warmup1, reps: 6 },
                { type: 'W', weight: warmup2, reps: 3 },
                { type: '1', weight: workWt, reps: 5, rpe: 8 },
                { type: '2', weight: workWt, reps: 5, rpe: 8 },
                { type: '3', weight: workWt, reps: 5, rpe: 8.5 },
              ],
        },
        {
          name: 'Leg Press',
          unit: 'kg',
          notes: 'Full range of motion, do not lock out knees aggressively',
          sets: [
            { type: '1', weight: Math.round(workWt * 1.3), reps: 10 },
            { type: '2', weight: Math.round(workWt * 1.3), reps: 10 },
            { type: '3', weight: Math.round(workWt * 1.3), reps: 10 },
          ],
        },
        {
          name: 'Walking Lunges',
          unit: 'kg',
          notes: 'Hold light dumbbells, keep balance steady',
          sets: [
            { type: '1', weight: 16, reps: 10 },
            { type: '2', weight: 16, reps: 10 },
          ],
        },
      ],
      coachingTips: [
        'Rest 3 minutes between heavy squat sets.',
        'Keep 1-2 reps in reserve on all accessory exercises.',
      ],
      isOfflineFallback: true,
    };
  }

  if (isDeadlift) {
    const workWt = Math.round(isDeload ? deadliftTop * 0.65 : deadliftTop * 0.82);
    const warmup1 = Math.round(deadliftTop * 0.5);
    const warmup2 = Math.round(deadliftTop * 0.7);

    return {
      title: isDeload ? 'Deadlift Technical Flush' : 'Deadlift Power & Back Hypertrophy',
      bodyTags: ['back', 'legs', 'core'],
      rationale: isDeload
        ? `Light deadlift session with ${workWt}kg to groove proper hip hinge mechanics without stressing your spinal erectors.`
        : `Building upon your past deadlift work (~${deadliftTop}kg), we hit crisp working sets at ${workWt}kg then blast your lats and upper back with rows and pull-downs.`,
      warmupNotes: 'Cat-camel stretches, bird-dogs, and light Romanian deadlifts.',
      lifts: [
        {
          name: 'Deadlift',
          unit: 'kg',
          notes: 'Pull slack out of the bar, lock hips at the top',
          sets: [
            { type: 'W', weight: warmup1, reps: 5 },
            { type: 'W', weight: warmup2, reps: 3 },
            { type: '1', weight: workWt, reps: 4, rpe: 8 },
            { type: '2', weight: workWt, reps: 4, rpe: 8 },
            { type: '3', weight: workWt, reps: 4, rpe: 8 },
          ],
        },
        {
          name: 'Barbell Row',
          unit: 'kg',
          notes: 'Squeeze shoulder blades at top',
          sets: [
            { type: '1', weight: Math.round(workWt * 0.55), reps: 8 },
            { type: '2', weight: Math.round(workWt * 0.55), reps: 8 },
            { type: '3', weight: Math.round(workWt * 0.55), reps: 8 },
          ],
        },
        {
          name: 'Lat Pulldown',
          unit: 'kg',
          notes: 'Slow 2-second negative stretch',
          sets: [
            { type: '1', weight: 60, reps: 10 },
            { type: '2', weight: 60, reps: 10 },
          ],
        },
      ],
      coachingTips: [
        'Do not hitch or bounce the deadlifts.',
        'Reset your breath and brace before every single rep.',
      ],
      isOfflineFallback: true,
    };
  }

  // Default: Bench Press & Upper Body
  const workWt = Math.round(isDeload ? benchTop * 0.65 : benchTop * 0.85);
  const warmup1 = Math.round(benchTop * 0.5);
  const warmup2 = Math.round(benchTop * 0.72);

  return {
    title: isDeload ? 'Bench Press Active Recovery' : 'Bench Press Strength & Chest Hypertrophy',
    bodyTags: ['chest', 'shoulders', 'triceps'],
    rationale: isDeload
      ? `A recovery-oriented upper workout: dropping bench weight to ${workWt}kg with 2 light sets to let your shoulders and elbows recover.`
      : `Based on your recent bench training (top weight ~${benchTop}kg), we program ${workWt}kg for 3 strong working sets of 5, followed by dumbbell and tricep accessories to build chest and tricep mass without joint pain.`,
    warmupNotes: 'Arm circles, band pull-aparts, and 2 empty-bar warm-up sets.',
    lifts: [
      {
        name: 'Bench Press',
        unit: 'kg',
        notes: 'Pinch shoulder blades, tuck elbows slightly, drive with legs',
        sets: isDeload
          ? [
              { type: 'W', weight: warmup1, reps: 8 },
              { type: '1', weight: workWt, reps: 5, rpe: 6 },
              { type: '2', weight: workWt, reps: 5, rpe: 6 },
            ]
          : [
              { type: 'W', weight: warmup1, reps: 8 },
              { type: 'W', weight: warmup2, reps: 4 },
              { type: '1', weight: workWt, reps: 5, rpe: 8 },
              { type: '2', weight: workWt, reps: 5, rpe: 8 },
              { type: '3', weight: Math.round(workWt * 0.95), reps: 6, rpe: 8.5 },
            ],
      },
      {
        name: 'Incline Dumbbell Press',
        unit: 'kg',
        notes: 'Deep stretch at the bottom, squeeze chest at top',
        sets: [
          { type: '1', weight: 28, reps: 8 },
          { type: '2', weight: 28, reps: 8 },
          { type: '3', weight: 28, reps: 8 },
        ],
      },
      {
        name: 'Tricep Rope Pushdown',
        unit: 'kg',
        notes: 'Spread the rope at the bottom and lock out triceps',
        sets: [
          { type: '1', weight: 25, reps: 12 },
          { type: '2', weight: 25, reps: 12 },
          { type: '3', weight: 25, reps: 12 },
        ],
      },
    ],
    coachingTips: [
      'Take 2.5 to 3 minutes of rest between bench sets.',
      'Stop every accessory set with 1-2 reps left before failure.',
    ],
    isOfflineFallback: true,
  };
}
