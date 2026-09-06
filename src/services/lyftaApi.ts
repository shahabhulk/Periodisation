import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { ExerciseDBItem } from '../components/ExerciseKanbanView';

export interface LyftaRawItem {
  id?: string | number | null;
  name: string;
  image_name: string;
  equipment_id?: string | string[] | null;
  body_part_id?: string | string[] | null;
  Target_muscles_id?: string | string[] | null;
  Synergist_muscles_id?: string | string[] | null;
  exercise_type?: string | null;
}

export interface LyftaLibraryResponse {
  status: boolean;
  data: {
    results: LyftaRawItem[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  };
}

/**
 * Exact Equipment ID Mappings from Lyfta API Documentation
 */
export const LYFTA_EQUIPMENT_MAP: Record<string, string> = {
  "1": "Barbell",
  "2": "Body weight",
  "3": "Cable",
  "4": "Dumbbell",
  "5": "EZ Barbell",
  "6": "Leverage machine",
  "7": "Sled machine",
  "8": "Smith machine",
  "9": "Weighted",
  "10": "Assisted",
  "11": "Band",
  "12": "Battling Rope",
  "13": "Bosu ball",
  "14": "Hammer",
  "15": "Kettlebell",
  "16": "Medicine Ball",
  "17": "Olympic barbell",
  "18": "Power Sled",
  "19": "Resistance Band",
  "20": "Roll",
  "21": "Rollball",
  "22": "Rope",
  "23": "Stability ball",
  "24": "Stick",
  "25": "Suspension",
  "26": "Trap bar",
  "27": "Vibrate Plate",
  "28": "Wheel roller",
};

/**
 * Exact Body Part (Muscle Part) ID Mappings from Lyfta API Documentation
 */
export const LYFTA_BODY_PART_MAP: Record<string, string> = {
  "1": "Thighs",
  "2": "Chest",
  "3": "Hips",
  "4": "Back",
  "5": "Upper Arms",
  "6": "Shoulders",
  "7": "Forearms",
  "8": "Calves",
  "9": "Neck",
  "10": "Cardio",
  "11": "Full body",
  "12": "Waist",
  "13": "Plyometrics",
  "14": "Weightlifting",
  "15": "Yoga",
  "16": "Stretching",
  "17": "Biceps",
  "18": "Triceps",
  "19": "Quadriceps",
  "20": "Hamstrings",
};

/**
 * Exact Muscle ID Mappings from Lyfta API Documentation (Target & Synergist Muscles)
 */
export const LYFTA_MUSCLE_MAP: Record<string, string> = {
  "2": "Adductor Longus",
  "3": "Adductor Magnus",
  "4": "Biceps Brachii",
  "5": "Brachialis",
  "6": "Brachioradialis",
  "7": "Deep Hip External Rotators",
  "8": "Deltoid Anterior",
  "9": "Deltoid Lateral",
  "10": "Deltoid Posterior",
  "11": "Erector Spinae",
  "12": "Gastrocnemius",
  "13": "Gluteus Maximus",
  "14": "Gluteus Medius",
  "15": "Gluteus Minimus",
  "16": "Gracilis",
  "17": "Hamstrings",
  "18": "Iliopsoas",
  "19": "Infraspinatus",
  "20": "Latissimus Dorsi",
  "21": "Levator Scapulae",
  "22": "Obliques",
  "23": "Pectineous",
  "24": "Pectoralis Major Clavicular Head",
  "25": "Pectoralis Major Sternal Head",
  "26": "Popliteus",
  "27": "Quadriceps",
  "28": "Rectus Abdominis",
  "29": "Sartorius",
  "30": "Serratus Ante",
  "31": "Serratus Anterior",
  "32": "Soleus",
  "33": "Splenius",
  "34": "Sternocleidomastoid",
  "35": "Subscapularis",
  "36": "Tensor Fasciae Latae",
  "37": "Teres Major",
  "38": "Teres Minor",
  "39": "Tibialis Anterior",
  "40": "Transverse Abdominis",
  "41": "Trapezius Lower Fibers",
  "42": "Trapezius Middle Fibers",
  "43": "Trapezius Upper Fibers",
  "44": "Triceps Brachii",
  "45": "Wrist Extensors",
  "46": "Wrist Flexors",
};

/**
 * Full dropdown options matching Lyfta exactly
 */
export const LYFTA_BODY_PART_OPTIONS = [
  { value: 'all', label: 'All Muscle Parts' },
  { value: 'Chest', label: 'Chest' },
  { value: 'Back', label: 'Back' },
  { value: 'Shoulders', label: 'Shoulders' },
  { value: 'Upper Arms', label: 'Upper Arms' },
  { value: 'Biceps', label: 'Biceps' },
  { value: 'Triceps', label: 'Triceps' },
  { value: 'Forearms', label: 'Forearms' },
  { value: 'Thighs', label: 'Thighs' },
  { value: 'Adductors', label: 'Adductors / Inner Thighs' },
  { value: 'Quadriceps', label: 'Quadriceps' },
  { value: 'Hamstrings', label: 'Hamstrings' },
  { value: 'Calves', label: 'Calves' },
  { value: 'Hips', label: 'Hips / Glutes' },
  { value: 'Waist', label: 'Waist / Abs' },
  { value: 'Neck', label: 'Neck' },
  { value: 'Cardio', label: 'Cardio' },
  { value: 'Full body', label: 'Full body' },
  { value: 'Plyometrics', label: 'Plyometrics' },
  { value: 'Weightlifting', label: 'Weightlifting' },
  { value: 'Stretching', label: 'Stretching' },
  { value: 'Yoga', label: 'Yoga' },
];

export const LYFTA_EQUIPMENT_OPTIONS = [
  { value: 'all', label: 'All Equipment' },
  { value: 'Barbell', label: 'Barbell' },
  { value: 'Dumbbell', label: 'Dumbbell' },
  { value: 'Cable', label: 'Cable' },
  { value: 'Body weight', label: 'Body weight' },
  { value: 'Leverage machine', label: 'Leverage machine' },
  { value: 'Smith machine', label: 'Smith machine' },
  { value: 'EZ Barbell', label: 'EZ Barbell' },
  { value: 'Kettlebell', label: 'Kettlebell' },
  { value: 'Band', label: 'Band' },
  { value: 'Resistance Band', label: 'Resistance Band' },
  { value: 'Weighted', label: 'Weighted' },
  { value: 'Assisted', label: 'Assisted' },
  { value: 'Olympic barbell', label: 'Olympic barbell' },
  { value: 'Trap bar', label: 'Trap bar' },
  { value: 'Sled machine', label: 'Sled machine' },
  { value: 'Power Sled', label: 'Power Sled' },
  { value: 'Medicine Ball', label: 'Medicine Ball' },
  { value: 'Bosu ball', label: 'Bosu ball' },
  { value: 'Stability ball', label: 'Stability ball' },
  { value: 'Battling Rope', label: 'Battling Rope' },
  { value: 'Rope', label: 'Rope' },
  { value: 'Suspension', label: 'Suspension' },
  { value: 'Roll', label: 'Roll' },
  { value: 'Rollball', label: 'Rollball' },
  { value: 'Hammer', label: 'Hammer' },
  { value: 'Stick', label: 'Stick' },
  { value: 'Wheel roller', label: 'Wheel roller' },
  { value: 'Vibrate Plate', label: 'Vibrate Plate' },
];

export const LYFTA_TARGET_MUSCLE_OPTIONS = [
  { value: 'all', label: 'All Target Muscles' },
  { value: 'Pectoralis Major Sternal Head', label: 'Pectoralis Major (Sternal)' },
  { value: 'Pectoralis Major Clavicular Head', label: 'Pectoralis Major (Clavicular)' },
  { value: 'Latissimus Dorsi', label: 'Latissimus Dorsi' },
  { value: 'Deltoid Anterior', label: 'Deltoid Anterior (Front)' },
  { value: 'Deltoid Lateral', label: 'Deltoid Lateral (Side)' },
  { value: 'Deltoid Posterior', label: 'Deltoid Posterior (Rear)' },
  { value: 'Biceps Brachii', label: 'Biceps Brachii' },
  { value: 'Triceps Brachii', label: 'Triceps Brachii' },
  { value: 'Brachialis', label: 'Brachialis' },
  { value: 'Brachioradialis', label: 'Brachioradialis' },
  { value: 'Quadriceps', label: 'Quadriceps' },
  { value: 'Hamstrings', label: 'Hamstrings' },
  { value: 'Gluteus Maximus', label: 'Gluteus Maximus' },
  { value: 'Gluteus Medius', label: 'Gluteus Medius' },
  { value: 'Gluteus Minimus', label: 'Gluteus Minimus' },
  { value: 'Gastrocnemius', label: 'Gastrocnemius (Calf)' },
  { value: 'Soleus', label: 'Soleus (Deep Calf)' },
  { value: 'Rectus Abdominis', label: 'Rectus Abdominis (Abs)' },
  { value: 'Obliques', label: 'Obliques' },
  { value: 'Transverse Abdominis', label: 'Transverse Abdominis' },
  { value: 'Erector Spinae', label: 'Erector Spinae (Lower Back)' },
  { value: 'Trapezius Upper Fibers', label: 'Trapezius (Upper)' },
  { value: 'Trapezius Middle Fibers', label: 'Trapezius (Middle)' },
  { value: 'Trapezius Lower Fibers', label: 'Trapezius (Lower)' },
  { value: 'Infraspinatus', label: 'Infraspinatus' },
  { value: 'Subscapularis', label: 'Subscapularis' },
  { value: 'Teres Major', label: 'Teres Major' },
  { value: 'Teres Minor', label: 'Teres Minor' },
  { value: 'Serratus Anterior', label: 'Serratus Anterior' },
  { value: 'Adductors', label: 'All Adductors (Inner Thighs)' },
  { value: 'Adductor Longus', label: 'Adductor Longus' },
  { value: 'Adductor Magnus', label: 'Adductor Magnus' },
  { value: 'Gracilis', label: 'Gracilis' },
  { value: 'Iliopsoas', label: 'Iliopsoas' },
  { value: 'Pectineous', label: 'Pectineous' },
  { value: 'Sartorius', label: 'Sartorius' },
  { value: 'Tensor Fasciae Latae', label: 'Tensor Fasciae Latae' },
  { value: 'Tibialis Anterior', label: 'Tibialis Anterior' },
  { value: 'Wrist Extensors', label: 'Wrist Extensors' },
  { value: 'Wrist Flexors', label: 'Wrist Flexors' },
  { value: 'Sternocleidomastoid', label: 'Sternocleidomastoid' },
  { value: 'Splenius', label: 'Splenius' },
  { value: 'Levator Scapulae', label: 'Levator Scapulae' },
];

/**
 * Safely parse JSON-encoded ID string or array into string array
 */
function parseIdList(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return val.split(',').map((s) => s.trim().replace(/["'[\]]/g, '')).filter(Boolean);
    }
  }
  return [String(val)];
}

/**
 * Transforms a raw item from Lyfta's catalog into the app's ExerciseDBItem format
 */
export function transformLyftaExercise(item: LyftaRawItem): ExerciseDBItem {
  const eqIds = parseIdList(item.equipment_id);
  const bpIds = parseIdList(item.body_part_id);
  const targetMuscleIds = parseIdList(item.Target_muscles_id);
  const synergistMuscleIds = parseIdList(item.Synergist_muscles_id);

  const equipments = Array.from(
    new Set(eqIds.map((id) => LYFTA_EQUIPMENT_MAP[id] || '').filter(Boolean))
  );

  const bodyParts = Array.from(
    new Set(bpIds.map((id) => LYFTA_BODY_PART_MAP[id] || '').filter(Boolean))
  );

  const targetMuscles = Array.from(
    new Set(targetMuscleIds.map((id) => LYFTA_MUSCLE_MAP[id] || '').filter(Boolean))
  );

  const secondaryMuscles = Array.from(
    new Set(synergistMuscleIds.map((id) => LYFTA_MUSCLE_MAP[id] || '').filter(Boolean))
  );

  const rawId =
    item.id != null && String(item.id).trim() !== '' && String(item.id) !== 'null'
      ? String(item.id)
      : null;
  const exerciseId = rawId
    ? `lyfta-${rawId}`
    : `lyfta-${encodeURIComponent(item.name.trim().toLowerCase().replace(/\s+/g, '-'))}`;

  return {
    exerciseId,
    name: item.name,
    gifUrl: item.image_name,
    bodyParts: bodyParts.length > 0 ? bodyParts : ['Other'],
    equipments: equipments.length > 0 ? equipments : ['Other'],
    targetMuscles,
    secondaryMuscles,
    instructions: item.exercise_type ? [`Exercise type: ${item.exercise_type}`] : [],
  };
}

/**
 * Retrieves the Lyfta API key from environment variable or localStorage
 */
export function getLyftaApiKey(): string {
  const envKey = import.meta.env.VITE_LYFTA_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  return localStorage.getItem('lyfta_api_key')?.trim() || 'f2081a787f687bfd145d74da746c67410452cbde8a7430f4f837a3cb53f8f385';
}

export interface FetchLyftaOptions {
  search?: string;
  bodyPart?: string;
  equipment?: string;
  targetMuscle?: string;
  offset?: number;
  limit?: number;
}

export interface LyftaFetchResult {
  exercises: ExerciseDBItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

import fullCatalogRaw from '../data/lyftaFullCatalog.json';
import { LYFTA_OFFICIAL_SEED } from '../data/lyftaOfficialSeed';

// Pre-transform the official 2,100 exercises from Lyfta
const baseCatalog: ExerciseDBItem[] = (() => {
  const seen = new Set<string>();
  const list: ExerciseDBItem[] = [];
  for (const raw of (fullCatalogRaw as LyftaRawItem[])) {
    const ex = transformLyftaExercise(raw);
    if (!seen.has(ex.exerciseId)) {
      seen.add(ex.exerciseId);
      list.push(ex);
    }
  }
  return list;
})();

// In-memory master catalog of official Lyfta exercises, initialized with the 1,848 unique Lyfta exercises + seed
let masterCatalog: ExerciseDBItem[] = baseCatalog.length > 0 ? baseCatalog : [...LYFTA_OFFICIAL_SEED];
let highestPageLoaded = 21;
let isFetchingCatalog = false;
let rateLimitCooldownUntil = (() => {
  try {
    return parseInt(localStorage.getItem('lyfta_cooldown_until') || '0', 10);
  } catch {
    return 0;
  }
})();

function setRateLimitCooldown(ms = 60 * 60 * 1000) {
  rateLimitCooldownUntil = Date.now() + ms;
  try {
    localStorage.setItem('lyfta_cooldown_until', String(rateLimitCooldownUntil));
  } catch {}
}

// Initialize from localStorage cache if available, merging on top of seed
try {
  const cached = localStorage.getItem('lyfta_official_catalog');
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existingIds = new Set(masterCatalog.map((x) => x.exerciseId));
      for (const item of parsed) {
        if (!existingIds.has(item.exerciseId)) {
          existingIds.add(item.exerciseId);
          masterCatalog.push(item);
        }
      }
      highestPageLoaded = Math.floor(masterCatalog.length / 100);
    }
  }
} catch {
  // ignore
}

async function fetchExercisesPageFromLyfta(
  page: number,
  apiKey: string
): Promise<LyftaRawItem[]> {
  // If rate limit cooldown is active, return early without sending requests
  if (Date.now() < rateLimitCooldownUntil) {
    return [];
  }

  const isNative = Capacitor.isNativePlatform();
  const isDev = import.meta.env.DEV;

  let url = `https://my.lyfta.app/api/v1/exercises?limit=100&page=${page}`;
  if (!isNative && isDev) {
    url = `/lyfta-api/api/v1/exercises?limit=100&page=${page}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };

  try {
    if (isNative) {
      const res = await CapacitorHttp.get({ url, headers });
      if (res.status === 429) {
        setRateLimitCooldown();
        console.warn('Lyfta API rate limited (429). Serving from official cached catalog.');
        return [];
      }
      if (res.status >= 200 && res.status < 300) {
        const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (json?.status_code === 429 || json?.status === 'error') {
          setRateLimitCooldown();
          return [];
        }
        return Array.isArray(json?.exercises) ? json.exercises : [];
      }
    } else {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        setRateLimitCooldown();
        console.warn('Lyfta API rate limited (429). Serving from official cached catalog.');
        return [];
      }
      if (res.ok) {
        const json = await res.json();
        if (json?.status_code === 429 || json?.status === 'error') {
          setRateLimitCooldown();
          return [];
        }
        return Array.isArray(json?.exercises) ? json.exercises : [];
      }
    }
  } catch (e) {
    console.warn(`Error fetching Lyfta exercises page ${page}:`, e);
  }
  return [];
}

export async function ensureCatalogLoaded(): Promise<ExerciseDBItem[]> {
  if (Date.now() < rateLimitCooldownUntil) {
    return masterCatalog;
  }
  if (highestPageLoaded >= 21) {
    return masterCatalog;
  }
  if (isFetchingCatalog) {
    return masterCatalog;
  }

  isFetchingCatalog = true;
  const apiKey = getLyftaApiKey();

  try {
    const startPage = highestPageLoaded + 1;
    const pagesToFetch: number[] = [];
    for (let p = startPage; p < startPage + 3 && p <= 21; p++) {
      pagesToFetch.push(p);
    }

    if (pagesToFetch.length > 0) {
      const pageResults = await Promise.all(
        pagesToFetch.map((p) => fetchExercisesPageFromLyfta(p, apiKey))
      );

      const existingIds = new Set(masterCatalog.map((ex) => ex.exerciseId));
      let addedCount = 0;
      for (const list of pageResults) {
        for (const item of list) {
          const transformed = transformLyftaExercise(item);
          if (!existingIds.has(transformed.exerciseId)) {
            existingIds.add(transformed.exerciseId);
            masterCatalog.push(transformed);
            addedCount++;
          }
        }
      }
      highestPageLoaded = Math.max(highestPageLoaded, ...pagesToFetch);

      if (addedCount > 0) {
        try {
          localStorage.setItem('lyfta_official_catalog', JSON.stringify(masterCatalog.slice(0, 1000)));
        } catch {
          // storage quota limit
        }
      }
    }
  } finally {
    isFetchingCatalog = false;
  }

  return masterCatalog;
}

/**
 * Fetch official exercises from Lyfta catalog API
 */
export async function fetchLyftaExercises(
  options: FetchLyftaOptions = {}
): Promise<LyftaFetchResult> {
  const limit = options.limit || 40;
  const offset = options.offset || 0;

  // Background refresh if key is active
  ensureCatalogLoaded().catch(() => {});

  const catalog = masterCatalog;

  const rawSearch = options.search?.trim().toLowerCase() || '';
  const bodyPartLow = options.bodyPart && options.bodyPart !== 'all' ? options.bodyPart.toLowerCase() : '';
  const equipmentLow = options.equipment && options.equipment !== 'all' ? options.equipment.toLowerCase() : '';
  const targetMuscleLow = options.targetMuscle && options.targetMuscle !== 'all' ? options.targetMuscle.toLowerCase() : '';

  // Filter master catalog
  const filtered = catalog.filter((ex) => {
    if (rawSearch) {
      const searchWords = rawSearch.split(/\s+/).filter(Boolean);
      const exName = ex.name.toLowerCase();
      const matchExact = exName.includes(rawSearch);
      
      // Check if all search words appear across the exercise name, equipment, body parts, or target muscles
      const matchWords = searchWords.every((w) => {
        const stem = w.length > 5 ? w.slice(0, -2) : (w.endsWith('s') ? w.slice(0, -1) : w);
        return (
          exName.includes(w) ||
          exName.includes(stem) ||
          ex.equipments.some((eq) => eq.toLowerCase().includes(w) || eq.toLowerCase().includes(stem)) ||
          ex.bodyParts.some((bp) => bp.toLowerCase().includes(w) || bp.toLowerCase().includes(stem)) ||
          ex.targetMuscles.some((tm) => tm.toLowerCase().includes(w) || tm.toLowerCase().includes(stem)) ||
          ex.secondaryMuscles?.some((sm) => sm.toLowerCase().includes(w) || sm.toLowerCase().includes(stem))
        );
      });

      if (!matchExact && !matchWords) return false;
    }

    if (bodyPartLow) {
      if (bodyPartLow === 'adductors' || bodyPartLow === 'adductor') {
        const matchAdductor =
          ex.targetMuscles.some((tm) => tm.toLowerCase().includes('adductor')) ||
          ex.secondaryMuscles?.some((sm) => sm.toLowerCase().includes('adductor')) ||
          ex.name.toLowerCase().includes('adduct');
        if (!matchAdductor) return false;
      } else {
        const matchBp = ex.bodyParts.some((bp) => bp.toLowerCase() === bodyPartLow);
        if (!matchBp) return false;
      }
    }

    if (equipmentLow) {
      const matchEq = ex.equipments.some((eq) => eq.toLowerCase() === equipmentLow);
      if (!matchEq) return false;
    }

    if (targetMuscleLow) {
      const isAdductor = targetMuscleLow.includes('adductor');
      const matchTm =
        ex.targetMuscles.some((tm) => {
          const tLow = tm.toLowerCase();
          return tLow === targetMuscleLow || (isAdductor && tLow.includes('adductor'));
        }) ||
        ex.secondaryMuscles?.some((sm) => {
          const sLow = sm.toLowerCase();
          return sLow === targetMuscleLow || (isAdductor && sLow.includes('adductor'));
        });
      if (!matchTm) return false;
    }

    return true;
  });

  const pagedExercises = filtered.slice(offset, offset + limit);
  const hasMore = offset + limit < filtered.length || (highestPageLoaded < 21 && Date.now() >= rateLimitCooldownUntil);

  return {
    exercises: pagedExercises,
    total: filtered.length,
    offset,
    limit,
    hasMore,
  };
}
