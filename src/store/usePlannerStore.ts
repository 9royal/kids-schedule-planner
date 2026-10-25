import { create } from 'zustand';
import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, Database, off } from 'firebase/database';
import {
  ActivityTemplate,
  ClassroomSummaryInfo,
  FirebaseConfigInput,
  LeaderboardEntry,
  NameDisplayPreference,
  ParentCategoryId,
  ScheduleBlock,
  StudentInfo,
} from '../types/schedule';
import {
  createStarterSchedule,
  DEFAULT_ACTIVITY_TEMPLATES,
  PARENT_CATEGORIES,
} from '../data/categories';
import { generateDefaultAvatar } from '../utils/avatarCompressor';

const STORAGE_PREFIX = 'kids_schedule_planner_v2_';
const CHANNEL_NAME = 'kids_schedule_realtime_channel';

/**
 * 全校所有班級預設共用的 Firebase Realtime Database 設定
 * 不同班級會自動分流在 /rooms/{roomId} 底下，學生與老師打開網頁即自動跨裝置同步
 */
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigInput = {
  apiKey: 'demo-key',
  databaseURL: 'https://kids-planner-c7e84-default-rtdb.firebaseio.com',
  projectId: 'kids-planner-c7e84',
};

export const SAMPLE_NAMES = [
  '林小宇', '陳品妍', '張宥廷', '黃子晴', '李承恩', '吳語彤', '王品睿', '劉芷瑜',
  '蔡宇軒', '楊詠晴', '許哲瑋', '鄭心妤', '謝宥辰', '郭采潔', '洪宇澤', '邱子涵',
  '曾品碩', '廖思妤', '賴柏翰', '徐若瑄', '周子軒', '葉品希', '蘇宥安', '莊語昕',
  '呂承諺', '江采恩', '何柏叡', '蕭子芸', '羅宥翔', '高語柔', '潘品言', '簡心彤',
  '朱宇航', '鍾芷晴', '彭承翰', '游語安', '詹柏宇', '胡子晴', '施宥廷', '沈品妍',
];

export const SAMPLE_NICKNAMES: Record<number, string> = {
  1: '小宇隊長',
  2: '妍妍星星',
  3: '宥廷超人',
  4: '子晴小太陽',
  5: '承恩小博士',
  6: '語彤小畫家',
  7: '品睿閃電',
};

/**
 * 取得本週一 00:00:00 的 Date 物件
 */
export function getCurrentWeekMonday(baseDate = new Date()): Date {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 依據 weekOffset (0 = 本週, 1 = 下週, ...) 取得該週一的 Date 與 YYYY-MM-DD key
 * 嚴格限制 weekOffset >= 0（不可往前排前週以前的活動）
 */
export function getWeekMondayByOffset(weekOffset: number): Date {
  const safeOffset = Math.max(0, Math.floor(weekOffset));
  const monday = getCurrentWeekMonday();
  monday.setDate(monday.getDate() + safeOffset * 7);
  return monday;
}

export function formatDateKeyYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekKeyByOffset(weekOffset: number): string {
  return formatDateKeyYYYYMMDD(getWeekMondayByOffset(weekOffset));
}

/**
 * 將任意日期換算為相對於本週一的 weekOffset 與 dayIndex (0=週一..6=週日)
 * 若該日期早於本週一 00:00，回傳 weekOffset < 0 代表屬於過去週次
 */
export function resolveDateToWeekOffsetAndDay(targetDate: Date): {
  weekOffset: number;
  dayIndex: number;
  weekKey: string;
} {
  const currentMonday = getCurrentWeekMonday();
  const d = new Date(targetDate);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - currentMonday.getTime()) / (1000 * 60 * 60 * 24));
  const weekOffset = Math.floor(diffDays / 7);
  const jsDay = d.getDay();
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
  const targetMonday = new Date(currentMonday);
  targetMonday.setDate(currentMonday.getDate() + weekOffset * 7);
  return {
    weekOffset,
    dayIndex,
    weekKey: formatDateKeyYYYYMMDD(targetMonday),
  };
}

/**
 * 取得今日對應的星期索引 (0=週一 .. 6=週日)
 */
export function getTodayDayIndex(baseDate = new Date()): number {
  const jsDay = baseDate.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * 判斷指定週次與星期是否已經過完（跨過午夜 00:00 後，已過去的那一天即自動鎖定不可修改）
 */
export function isPastDayInWeek(
  weekOffset: number,
  dayIndex: number,
  baseDate = new Date()
): boolean {
  if (weekOffset < 0) return true;
  if (weekOffset > 0) return false;
  return dayIndex < getTodayDayIndex(baseDate);
}

/**
 * 自動整併同一天中「相同活動且時間相連（或重疊）」的兩個積木為單一積木
 */
export function mergeAdjacentSameActivityBlocks(
  blocks: ScheduleBlock[],
  preferKeepId?: string
): ScheduleBlock[] {
  const byDay: Record<number, ScheduleBlock[]> = {};
  for (const b of blocks) {
    if (!byDay[b.dayIndex]) byDay[b.dayIndex] = [];
    byDay[b.dayIndex].push({ ...b });
  }

  const mergedAll: ScheduleBlock[] = [];

  for (const dayKey of Object.keys(byDay)) {
    const dIdx = Number(dayKey);
    const sorted = byDay[dIdx].sort((a, b) => a.startMinute - b.startMinute);
    const dayResult: ScheduleBlock[] = [];

    for (const curr of sorted) {
      if (dayResult.length === 0) {
        dayResult.push(curr);
        continue;
      }
      const prev = dayResult[dayResult.length - 1];
      const prevEnd = prev.startMinute + prev.durationMinutes;
      const currEnd = curr.startMinute + curr.durationMinutes;

      const isSameActivity =
        prev.name.trim() === curr.name.trim() && prev.parentId === curr.parentId;

      // 若為相同活動且時間相連（prevEnd === curr.startMinute）或重疊（prevEnd >= curr.startMinute）
      if (isSameActivity && prevEnd >= curr.startMinute) {
        const newStart = Math.min(prev.startMinute, curr.startMinute);
        const newEnd = Math.min(1440, Math.max(prevEnd, currEnd));
        const keptId =
          curr.id === preferKeepId ? curr.id : prev.id === preferKeepId ? prev.id : prev.id;
        dayResult[dayResult.length - 1] = {
          ...prev,
          id: keptId,
          startMinute: newStart,
          durationMinutes: newEnd - newStart,
        };
      } else {
        dayResult.push(curr);
      }
    }

    mergedAll.push(...dayResult);
  }

  return mergedAll;
}

/**
 * 當某個積木被調整時間或時長（例如：提早30分、延後30分、時長+30分、時長-30分，或拖曳拉伸）時，
 * 自動讓前後相鄰或重疊的活動積木跟隨調整時間（絕不讓兩個活動重疊）。
 */
export function adjustNeighborsForBlockUpdate(
  baseSchedule: ScheduleBlock[],
  targetBlockId: string,
  updates: Partial<ScheduleBlock>,
  autoMerge = true
): ScheduleBlock[] {
  const oldBlock = baseSchedule.find((b) => b.id === targetBlockId);
  if (!oldBlock) return baseSchedule;

  const updatedBlock: ScheduleBlock = {
    ...oldBlock,
    ...updates,
  };

  const oldDay = oldBlock.dayIndex;
  const newDay = updatedBlock.dayIndex;
  const oldStart = oldBlock.startMinute;
  const oldEnd = oldBlock.startMinute + oldBlock.durationMinutes;
  const newStart = updatedBlock.startMinute;
  const newEnd = updatedBlock.startMinute + updatedBlock.durationMinutes;
  const isSameDay = oldDay === newDay;

  const adjustedOthers: ScheduleBlock[] = [];

  for (const existing of baseSchedule) {
    if (existing.id === targetBlockId) continue;
    if (existing.dayIndex !== newDay) {
      adjustedOthers.push(existing);
      continue;
    }

    const eStart = existing.startMinute;
    const eEnd = existing.startMinute + existing.durationMinutes;

    const isSameActivity =
      existing.name.trim() === updatedBlock.name.trim() &&
      existing.parentId === updatedBlock.parentId;
    if (autoMerge && isSameActivity && !(eEnd < newStart || eStart > newEnd)) {
      adjustedOthers.push(existing);
      continue;
    }

    // 1. 若為同一天內調整，且原本與此積木「前／後無縫相連」：當邊界內縮時，前後活動自動跟隨填補時間
    if (isSameDay) {
      // 前方緊鄰的活動：當目標積木往後延（newStart > oldStart），前方活動結束時間跟隨延伸至 newStart
      if (eEnd === oldStart && newStart > oldStart) {
        adjustedOthers.push({
          ...existing,
          durationMinutes: newStart - eStart,
        });
        continue;
      }
      // 後方緊鄰的活動：當目標積木提早結束（newEnd < oldEnd），後方活動開始時間跟隨往前移至 newEnd
      if (eStart === oldEnd && newEnd < oldEnd) {
        adjustedOthers.push({
          ...existing,
          startMinute: newEnd,
          durationMinutes: eEnd - newEnd,
        });
        continue;
      }
    }

    // 2. 無重疊的活動直接保留
    if (eEnd <= newStart || eStart >= newEnd) {
      adjustedOthers.push(existing);
      continue;
    }

    // 3. 有重疊的活動（例如提早30分壓到前一個活動、或時長+30分／延後30分壓到後一個活動）：自動裁切／推移前後活動時間，絕不重疊
    if (eStart < newStart && eEnd > newStart) {
      const trimmedDuration = newStart - eStart;
      if (trimmedDuration >= 15) {
        adjustedOthers.push({
          ...existing,
          durationMinutes: trimmedDuration,
        });
      }
    }

    if (eEnd > newEnd && eStart < newEnd) {
      const afterDuration = eEnd - newEnd;
      if (afterDuration >= 15) {
        const isSplit = eStart < newStart;
        adjustedOthers.push({
          ...existing,
          id: isSplit
            ? `${existing.id}-tail-${Date.now().toString(36).slice(-3)}`
            : existing.id,
          startMinute: newEnd,
          durationMinutes: afterDuration,
        });
      }
    }
  }

  adjustedOthers.push(updatedBlock);

  if (autoMerge) {
    return mergeAdjacentSameActivityBlocks(adjustedOthers, updatedBlock.id);
  }
  return adjustedOthers;
}

function computeCategoryTotals(schedule: ScheduleBlock[]) {
  const totals: Record<ParentCategoryId, number> = {
    study: 0,
    school: 0,
    sports: 0,
    creative: 0,
    daily: 0,
    leisure: 0,
    sleep: 0,
    other: 0,
  };
  const dailyBreakdown: Record<number, Record<ParentCategoryId, number>> = {};
  for (let d = 0; d < 7; d++) {
    dailyBreakdown[d] = {
      study: 0,
      school: 0,
      sports: 0,
      creative: 0,
      daily: 0,
      leisure: 0,
      sleep: 0,
      other: 0,
    };
  }

  for (const block of schedule) {
    const pid = block.parentId || 'other';
    totals[pid] = (totals[pid] || 0) + block.durationMinutes;
    if (dailyBreakdown[block.dayIndex]) {
      dailyBreakdown[block.dayIndex][pid] =
        (dailyBreakdown[block.dayIndex][pid] || 0) + block.durationMinutes;
    }
  }

  return { totals, dailyBreakdown };
}

interface PlannerStore {
  // Class & Student Identity (persisted across reloads so user only sets up once)
  roomId: string;
  student: StudentInfo;
  hasCompletedOnboarding: boolean;
  syncMode: 'local' | 'firebase';
  firebaseConnected: boolean;
  firebaseConfig: FirebaseConfigInput | null;
  lastSyncLatencyMs: number | null;

  // Multi-Week Scheduling (0 = 本週, >= 1 = 未來週次; 嚴格禁止 < 0)
  selectedWeekOffset: number;
  schedulesByWeek: Record<string, ScheduleBlock[]>;

  // Active Week Schedule & Deletable Templates (both default & custom)
  schedule: ScheduleBlock[];
  undoStack: ScheduleBlock[][];
  redoStack: ScheduleBlock[][];
  templates: ActivityTemplate[];
  snapMinutes: 15 | 30;

  // Manually Adjustable Focus Time Window (0 ~ 24)
  focusStartHour: number;
  focusEndHour: number;

  // Clock Preview when dragging/selecting a block
  previewTimeMinutes: number | null;
  selectedBlockId: string | null;

  // UI Layout states
  isLeaderboardCollapsed: boolean;
  isPaletteOpen: boolean;

  // Leaderboard Data & Classroom Seat Limit Control
  maxSeatCount: number;
  leaderboardMap: Record<number, LeaderboardEntry>;
  allClassroomsMap: Record<string, ClassroomSummaryInfo>;
  teacherPin: string;

  // Actions
  setRoomAndStudent: (
    roomId: string,
    seatNumber: number,
    name?: string,
    nickname?: string,
    displayPreference?: NameDisplayPreference
  ) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setMaxSeatCount: (count: number) => void;
  removeLeaderboardStudent: (seatNumber: number) => void;
  clearOtherLeaderboardStudents: () => void;

  // Teacher Multi-Classroom Management Actions (無須扮演學生即可管理與唯讀檢視所有班級)
  setTeacherPin: (pin: string) => void;
  refreshAllClassrooms: () => void;
  previewClassroomAsTeacher: (targetRoomId: string) => void;
  createOrUpdateClassroom: (targetRoomId: string, maxSeatCount?: number) => void;
  deleteClassroom: (targetRoomId: string) => void;
  removeStudentFromRoom: (targetRoomId: string, seatNumber: number) => void;
  clearSimulatedInRoom: (targetRoomId: string) => void;
  simulateStudentsInRoom: (targetRoomId: string) => Promise<number>;

  updateStudentProfile: (updates: Partial<StudentInfo>) => void;
  setSnapMinutes: (snap: 15 | 30) => void;
  setFocusHours: (startHour: number, endHour: number) => void;
  setPreviewTimeMinutes: (mins: number | null) => void;
  setSelectedBlockId: (id: string | null) => void;
  toggleLeaderboardCollapsed: () => void;
  setPaletteOpen: (open: boolean) => void;

  // Week Navigation (Current week & future weeks only)
  setSelectedWeekOffset: (offset: number) => void;
  jumpToFutureDate: (yyyyMmDd: string) => { ok: boolean; message?: string };

  // Schedule CRUD (with automatic adjacent same-activity merging + Undo/Redo history)
  pushUndoSnapshot: () => void;
  undoSchedule: () => void;
  redoSchedule: () => void;
  moveBlockToDay: (blockId: string, targetDayIndex: number) => void;
  addBlock: (block: Omit<ScheduleBlock, 'id'>) => ScheduleBlock;
  updateBlock: (id: string, updates: Partial<ScheduleBlock>, autoMerge?: boolean) => void;
  removeBlock: (id: string) => void;
  replaceSchedule: (blocks: ScheduleBlock[]) => void;
  importBlocksAcrossWeeks: (
    items: { weekOffset: number; block: ScheduleBlock }[],
    mode: 'fill-empty' | 'overwrite'
  ) => void;
  resetToStarterSchedule: () => void;
  clearDaySchedule: (dayIndex: number) => void;

  // Activity Templates (Default + Custom, all deletable)
  addCustomTemplate: (tpl: Omit<ActivityTemplate, 'id' | 'isCustom'>) => ActivityTemplate;
  removeTemplate: (id: string) => void;
  restoreDefaultTemplates: () => void;

  // Cloud / 40-Student Simulation
  simulate40Students: () => Promise<number>;
  connectFirebase: (config: FirebaseConfigInput) => void;
  disconnectFirebase: () => void;
}

let broadcastChannel: BroadcastChannel | null = null;
let firebaseApp: FirebaseApp | null = null;
let firebaseDb: Database | null = null;
let activeLeaderboardPath: string | null = null;
let activeAllRoomsPath: string | null = null;

function loadRoomMaxSeatsRegistry(): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}room_max_seats_map`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { '301': 40 };
}

function saveRoomMaxSeatsRegistry(map: Record<string, number>) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}room_max_seats_map`, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function loadRoomLeaderboardFromStorage(roomId: string): Record<number, LeaderboardEntry> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}room_${roomId}_leaderboard`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveRoomLeaderboardToStorage(roomId: string, map: Record<number, LeaderboardEntry>) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}room_${roomId}_leaderboard`, JSON.stringify(map));
    const maxSeatsMap = loadRoomMaxSeatsRegistry();
    if (!maxSeatsMap[roomId]) {
      maxSeatsMap[roomId] = Number(localStorage.getItem(`${STORAGE_PREFIX}max_seat_count`)) || 40;
      saveRoomMaxSeatsRegistry(maxSeatsMap);
    }
  } catch {
    // ignore
  }
}

function loadAllClassroomsFromStorage(): Record<string, ClassroomSummaryInfo> {
  const result: Record<string, ClassroomSummaryInfo> = {};
  const maxSeatsMap = loadRoomMaxSeatsRegistry();
  const roomIds = new Set<string>(Object.keys(maxSeatsMap));

  try {
    const prefix = `${STORAGE_PREFIX}room_`;
    const suffix = `_leaderboard`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && k.endsWith(suffix)) {
        const extractedRoom = k.slice(prefix.length, k.length - suffix.length);
        if (extractedRoom) roomIds.add(extractedRoom);
      }
    }
  } catch {
    // ignore
  }

  for (const rId of roomIds) {
    const lb = loadRoomLeaderboardFromStorage(rId);
    let lastActive = 0;
    for (const entry of Object.values(lb)) {
      if (entry.lastUpdated && entry.lastUpdated > lastActive) {
        lastActive = entry.lastUpdated;
      }
    }
    result[rId] = {
      roomId: rId,
      maxSeatCount: maxSeatsMap[rId] || 40,
      leaderboardMap: lb,
      lastActiveAt: lastActive,
    };
  }

  return result;
}

function loadFocusHoursFromStorage(): { start: number; end: number } {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}focus_hours`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.start === 'number' &&
        typeof parsed.end === 'number' &&
        parsed.start >= 0 &&
        parsed.end <= 24 &&
        parsed.start < parsed.end
      ) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { start: 7, end: 22 };
}

function loadStudentDataFromStorage(roomId: string, seatNumber: number): {
  info: StudentInfo;
  schedulesByWeek: Record<string, ScheduleBlock[]>;
  templates: ActivityTemplate[];
} {
  const defaultName = SAMPLE_NAMES[(seatNumber - 1) % SAMPLE_NAMES.length] || `${seatNumber}號同學`;
  const defaultNick = SAMPLE_NICKNAMES[seatNumber] || `${defaultName.slice(-2)}`;
  const fallbackInfo: StudentInfo = {
    seatNumber,
    name: defaultName,
    nickname: defaultNick,
    displayPreference: 'nickname',
    avatarUrl: generateDefaultAvatar(seatNumber, defaultName),
  };

  const currentWeekKey = getWeekKeyByOffset(0);
  const starter = createStarterSchedule();

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}room_${roomId}_seat_${seatNumber}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const schedulesByWeek: Record<string, ScheduleBlock[]> =
        parsed.schedulesByWeek && typeof parsed.schedulesByWeek === 'object'
          ? parsed.schedulesByWeek
          : { [currentWeekKey]: Array.isArray(parsed.schedule) ? parsed.schedule : starter };
      if (!schedulesByWeek[currentWeekKey]) {
        schedulesByWeek[currentWeekKey] = starter;
      }
      return {
        info: {
          ...fallbackInfo,
          ...(parsed.info || {}),
          displayPreference: parsed.info?.displayPreference || 'nickname',
        },
        schedulesByWeek,
        templates: Array.isArray(parsed.templates)
          ? parsed.templates
          : [...DEFAULT_ACTIVITY_TEMPLATES],
      };
    }
  } catch {
    // ignore
  }

  return {
    info: fallbackInfo,
    schedulesByWeek: { [currentWeekKey]: starter },
    templates: [...DEFAULT_ACTIVITY_TEMPLATES],
  };
}

function persistAndSyncStudent(
  roomId: string,
  student: StudentInfo,
  schedulesByWeek: Record<string, ScheduleBlock[]>,
  activeWeekOffset: number,
  templates: ActivityTemplate[],
  syncMode: 'local' | 'firebase',
  currentLeaderboard: Record<number, LeaderboardEntry>,
  setStore: (partial: Partial<PlannerStore>) => void
) {
  const t0 = performance.now();
  const currentWeekKey = getWeekKeyByOffset(0);
  const activeWeekKey = getWeekKeyByOffset(activeWeekOffset);
  const currentWeekSchedule = schedulesByWeek[currentWeekKey] || createStarterSchedule();
  const activeSchedule = schedulesByWeek[activeWeekKey] || createStarterSchedule();

  const isTeacherUrl =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mode') === 'teacher';

  // 若為教師檢視模式 (?mode=teacher)，老師操作畫面僅供示範與預覽，絕不寫入或覆蓋任何學生座號至排行榜與雲端！
  if (isTeacherUrl) {
    const latency = Math.max(1, Math.round(performance.now() - t0));
    setStore({
      schedule: activeSchedule,
      schedulesByWeek,
      templates,
      lastSyncLatencyMs: latency,
    });
    return;
  }

  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}room_${roomId}_seat_${student.seatNumber}`,
      JSON.stringify({
        info: student,
        schedulesByWeek,
        templates,
      })
    );
  } catch {
    // ignore
  }

  // Leaderboard reflects the active/current week's schedule
  const { totals, dailyBreakdown } = computeCategoryTotals(activeSchedule);
  const entry: LeaderboardEntry = {
    seatNumber: student.seatNumber,
    name: student.name,
    nickname: student.nickname || '',
    displayPreference: student.displayPreference || 'nickname',
    avatarUrl: student.avatarUrl,
    studyMinutes: totals.study,
    schoolMinutes: totals.school,
    sportsMinutes: totals.sports,
    creativeMinutes: totals.creative,
    dailyMinutes: totals.daily,
    leisureMinutes: totals.leisure,
    sleepMinutes: totals.sleep,
    otherMinutes: totals.other,
    dailyBreakdown,
    lastUpdated: Date.now(),
    isSimulated: false,
  };

  const nextLeaderboard = {
    ...currentLeaderboard,
    [student.seatNumber]: entry,
  };
  saveRoomLeaderboardToStorage(roomId, nextLeaderboard);

  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'LEADERBOARD_UPDATE',
      roomId,
      entry,
    });
  }

  if (syncMode === 'firebase' && firebaseDb) {
    const infoRef = ref(firebaseDb, `/rooms/${roomId}/students/${student.seatNumber}/info`);
    const schedRef = ref(firebaseDb, `/rooms/${roomId}/students/${student.seatNumber}/schedule`);
    const lbRef = ref(firebaseDb, `/rooms/${roomId}/leaderboard/${student.seatNumber}`);
    Promise.all([
      set(infoRef, {
        name: student.name,
        nickname: student.nickname || '',
        displayPreference: student.displayPreference || 'nickname',
        avatarUrl: student.avatarUrl,
      }),
      set(schedRef, currentWeekSchedule),
      set(lbRef, entry),
    ]).catch((err) => console.warn('Firebase write error:', err));
  }

  const latency = Math.max(1, Math.round(performance.now() - t0));
  setStore({
    schedule: activeSchedule,
    schedulesByWeek,
    templates,
    leaderboardMap: nextLeaderboard,
    allClassroomsMap: loadAllClassroomsFromStorage(),
    lastSyncLatencyMs: latency,
  });
}

function loadActiveUserProfile(): {
  roomId: string;
  seatNumber: number;
  hasCompletedOnboarding: boolean;
  snapMinutes: 15 | 30;
} {
  let urlRoom: string | null = null;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (r && r.trim()) {
      urlRoom = r.trim();
    }
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}active_user_profile`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        roomId: urlRoom || (parsed.roomId || '301').trim(),
        seatNumber:
          typeof parsed.seatNumber === 'number' && parsed.seatNumber >= 1 && parsed.seatNumber <= 60
            ? parsed.seatNumber
            : 1,
        hasCompletedOnboarding: urlRoom && urlRoom !== parsed.roomId ? false : Boolean(parsed.hasCompletedOnboarding),
        snapMinutes: parsed.snapMinutes === 30 ? 30 : 15,
      };
    }
  } catch {
    // ignore
  }
  return {
    roomId: urlRoom || '301',
    seatNumber: 1,
    hasCompletedOnboarding: false,
    snapMinutes: 15,
  };
}

function saveActiveUserProfile(profile: {
  roomId: string;
  seatNumber: number;
  hasCompletedOnboarding: boolean;
  snapMinutes: 15 | 30;
}) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}active_user_profile`, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export const usePlannerStore = create<PlannerStore>((setState, getState) => {
  const savedProfile = loadActiveUserProfile();
  const initialRoomId = savedProfile.roomId;
  const initialSeat = savedProfile.seatNumber;
  const currentWeekKey = getWeekKeyByOffset(0);
  const loaded = loadStudentDataFromStorage(initialRoomId, initialSeat);
  const initialFocus = loadFocusHoursFromStorage();
  let initialLeaderboard = loadRoomLeaderboardFromStorage(initialRoomId);
  const initialSchedule = loaded.schedulesByWeek[currentWeekKey] || createStarterSchedule();

  if (Object.keys(initialLeaderboard).length === 0) {
    const { totals, dailyBreakdown } = computeCategoryTotals(initialSchedule);
    initialLeaderboard[initialSeat] = {
      seatNumber: initialSeat,
      name: loaded.info.name,
      nickname: loaded.info.nickname || '',
      displayPreference: loaded.info.displayPreference || 'nickname',
      avatarUrl: loaded.info.avatarUrl,
      studyMinutes: totals.study,
      schoolMinutes: totals.school,
      sportsMinutes: totals.sports,
      creativeMinutes: totals.creative,
      dailyMinutes: totals.daily,
      leisureMinutes: totals.leisure,
      sleepMinutes: totals.sleep,
      otherMinutes: totals.other,
      dailyBreakdown,
      lastUpdated: Date.now(),
      isSimulated: false,
    };
    for (let s = 2; s <= 7; s++) {
      if (s === initialSeat) continue;
      const sName = SAMPLE_NAMES[s - 1];
      const sNick = SAMPLE_NICKNAMES[s] || `${sName.slice(-2)}`;
      const study = 240 + ((s * 45) % 300);
      const sports = 180 + ((s * 60) % 240);
      const creative = 120 + ((s * 30) % 210);
      const school = 1950;
      const daily = 600 + ((s * 15) % 180);
      const leisure = 240 + ((s * 30) % 180);
      const sleep = 3780; // 9h * 7d = 3780m
      initialLeaderboard[s] = {
        seatNumber: s,
        name: sName,
        nickname: sNick,
        displayPreference: 'nickname',
        avatarUrl: generateDefaultAvatar(s, sName),
        studyMinutes: study,
        schoolMinutes: school,
        sportsMinutes: sports,
        creativeMinutes: creative,
        dailyMinutes: daily,
        leisureMinutes: leisure,
        sleepMinutes: sleep,
        otherMinutes: 60,
        lastUpdated: Date.now() - s * 10000,
        isSimulated: true,
      };
    }
    saveRoomLeaderboardToStorage(initialRoomId, initialLeaderboard);
  }

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window && !broadcastChannel) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (ev) => {
      const data = ev.data;
      if (!data) return;
      const state = getState();
      if (data.type === 'LEADERBOARD_UPDATE') {
        const nextAll = loadAllClassroomsFromStorage();
        if (data.roomId === state.roomId) {
          setState({
            leaderboardMap: {
              ...state.leaderboardMap,
              [data.entry.seatNumber]: data.entry,
            },
            allClassroomsMap: nextAll,
          });
        } else {
          setState({ allClassroomsMap: nextAll });
        }
      } else if (data.type === 'BULK_LEADERBOARD_UPDATE') {
        const nextAll = loadAllClassroomsFromStorage();
        if (data.roomId === state.roomId) {
          setState({
            leaderboardMap: data.leaderboardMap,
            allClassroomsMap: nextAll,
          });
        } else {
          setState({ allClassroomsMap: nextAll });
        }
      }
    };
  }

  const initialMaxSeatsMap = loadRoomMaxSeatsRegistry();
  const initialMaxSeatCount =
    initialMaxSeatsMap[initialRoomId] ||
    Number(localStorage.getItem(`${STORAGE_PREFIX}max_seat_count`)) ||
    40;
  const savedTeacherPin =
    (typeof window !== 'undefined' && localStorage.getItem(`${STORAGE_PREFIX}teacher_pin`)) ||
    '8888';

  return {
    roomId: initialRoomId,
    student: loaded.info,
    hasCompletedOnboarding: savedProfile.hasCompletedOnboarding,
    syncMode: 'local',
    firebaseConnected: false,
    firebaseConfig: null,
    lastSyncLatencyMs: 8,

    selectedWeekOffset: 0,
    schedulesByWeek: loaded.schedulesByWeek,
    schedule: initialSchedule,
    undoStack: [],
    redoStack: [],
    templates: loaded.templates,
    snapMinutes: savedProfile.snapMinutes,

    focusStartHour: initialFocus.start,
    focusEndHour: initialFocus.end,

    previewTimeMinutes: null,
    selectedBlockId: null,

    isLeaderboardCollapsed: false,
    isPaletteOpen: true,

    maxSeatCount: initialMaxSeatCount,
    leaderboardMap: initialLeaderboard,
    allClassroomsMap: loadAllClassroomsFromStorage(),
    teacherPin: savedTeacherPin,

    setRoomAndStudent: (roomId, seatNumber, customName, customNickname, displayPref) => {
      const prevState = getState();
      const prevRoom = prevState.roomId;
      const prevSeat = prevState.student.seatNumber;
      const cleanRoom = roomId.trim() || '301';
      const studentData = loadStudentDataFromStorage(cleanRoom, seatNumber);
      if (customName && customName.trim()) {
        studentData.info.name = customName.trim();
      }
      if (typeof customNickname === 'string') {
        studentData.info.nickname = customNickname.trim();
      }
      if (displayPref) {
        studentData.info.displayPreference = displayPref;
      }
      const roomLb = { ...loadRoomLeaderboardFromStorage(cleanRoom) };
      const wasTargetOccupiedByReal = Boolean(
        roomLb[seatNumber] && !roomLb[seatNumber].isSimulated
      );

      // 若同一位學生在同班級「選錯座號要搬移至空座號」（例如從 5 號改選空的 6 號），自動將舊座號 (5號) 從排行榜與雲端移除，搬移至新座號，避免排行榜留下分身！
      if (
        prevState.hasCompletedOnboarding &&
        prevRoom === cleanRoom &&
        prevSeat !== seatNumber &&
        !wasTargetOccupiedByReal
      ) {
        delete roomLb[prevSeat];
        saveRoomLeaderboardToStorage(cleanRoom, roomLb);
        if (prevState.syncMode === 'firebase' && firebaseDb) {
          set(ref(firebaseDb, `/rooms/${cleanRoom}/leaderboard/${prevSeat}`), null).catch((e) =>
            console.warn(e)
          );
          set(ref(firebaseDb, `/rooms/${cleanRoom}/students/${prevSeat}`), null).catch((e) =>
            console.warn(e)
          );
        }
      }

      const maxSeatsMap = loadRoomMaxSeatsRegistry();
      const roomMaxSeats = maxSeatsMap[cleanRoom] || getState().maxSeatCount || 40;
      const activeWeekKey = getWeekKeyByOffset(0);
      const activeSched = studentData.schedulesByWeek[activeWeekKey] || createStarterSchedule();

      saveActiveUserProfile({
        roomId: cleanRoom,
        seatNumber,
        hasCompletedOnboarding: true,
        snapMinutes: getState().snapMinutes,
      });

      setState({
        roomId: cleanRoom,
        student: studentData.info,
        hasCompletedOnboarding: true,
        selectedWeekOffset: 0,
        schedulesByWeek: studentData.schedulesByWeek,
        schedule: activeSched,
        undoStack: [],
        redoStack: [],
        templates: studentData.templates,
        maxSeatCount: roomMaxSeats,
        leaderboardMap: roomLb,
        selectedBlockId: null,
      });

      // 若已連線 Firebase 且切換了班級，重新掛載該班級的即時排行榜監聽器
      if (getState().syncMode === 'firebase' && firebaseDb) {
        const nextLbPath = `/rooms/${cleanRoom}/leaderboard`;
        if (activeLeaderboardPath && activeLeaderboardPath !== nextLbPath) {
          off(ref(firebaseDb, activeLeaderboardPath));
        }
        activeLeaderboardPath = nextLbPath;
        onValue(ref(firebaseDb, nextLbPath), (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            saveRoomLeaderboardToStorage(cleanRoom, val);
            if (getState().roomId === cleanRoom) {
              setState({
                leaderboardMap: val,
                allClassroomsMap: loadAllClassroomsFromStorage(),
                firebaseConnected: true,
              });
            }
          }
        });
      }

      persistAndSyncStudent(
        cleanRoom,
        studentData.info,
        studentData.schedulesByWeek,
        0,
        studentData.templates,
        getState().syncMode,
        roomLb,
        setState
      );
    },

    setOnboardingCompleted: (completed) => {
      const state = getState();
      saveActiveUserProfile({
        roomId: state.roomId,
        seatNumber: state.student.seatNumber,
        hasCompletedOnboarding: completed,
        snapMinutes: state.snapMinutes,
      });
      setState({ hasCompletedOnboarding: completed });
    },

    setMaxSeatCount: (count) => {
      const cleanCount = Math.max(5, Math.min(60, Math.floor(count)));
      const state = getState();
      try {
        localStorage.setItem(`${STORAGE_PREFIX}max_seat_count`, String(cleanCount));
        const maxSeatsMap = loadRoomMaxSeatsRegistry();
        maxSeatsMap[state.roomId] = cleanCount;
        saveRoomMaxSeatsRegistry(maxSeatsMap);
      } catch {
        // ignore
      }
      setState({
        maxSeatCount: cleanCount,
        allClassroomsMap: loadAllClassroomsFromStorage(),
      });
    },

    removeLeaderboardStudent: (seatNumber) => {
      const state = getState();
      if (seatNumber === state.student.seatNumber) return;
      const nextLb = { ...state.leaderboardMap };
      delete nextLb[seatNumber];
      saveRoomLeaderboardToStorage(state.roomId, nextLb);
      setState({
        leaderboardMap: nextLb,
        allClassroomsMap: loadAllClassroomsFromStorage(),
      });
      if (state.syncMode === 'firebase' && firebaseDb) {
        const roomLbRef = ref(firebaseDb, `/rooms/${state.roomId}/leaderboard`);
        set(roomLbRef, nextLb).catch((e) => console.warn(e));
      }
    },

    clearOtherLeaderboardStudents: () => {
      const state = getState();
      const mySeat = state.student.seatNumber;
      const myEntry = state.leaderboardMap[mySeat];
      const nextLb: Record<number, LeaderboardEntry> = {};
      if (myEntry) {
        nextLb[mySeat] = myEntry;
      }
      saveRoomLeaderboardToStorage(state.roomId, nextLb);
      if (broadcastChannel) {
        broadcastChannel.postMessage({
          type: 'BULK_LEADERBOARD_UPDATE',
          roomId: state.roomId,
          leaderboardMap: nextLb,
        });
      }
      if (state.syncMode === 'firebase' && firebaseDb) {
        const roomLbRef = ref(firebaseDb, `/rooms/${state.roomId}/leaderboard`);
        set(roomLbRef, nextLb).catch((e) => console.warn(e));
      }
      setState({
        leaderboardMap: nextLb,
        allClassroomsMap: loadAllClassroomsFromStorage(),
      });
    },

    setTeacherPin: (pin) => {
      const cleanPin = pin.trim() || '8888';
      try {
        localStorage.setItem(`${STORAGE_PREFIX}teacher_pin`, cleanPin);
      } catch {
        // ignore
      }
      setState({ teacherPin: cleanPin });
    },

    refreshAllClassrooms: () => {
      setState({ allClassroomsMap: loadAllClassroomsFromStorage() });
    },

    previewClassroomAsTeacher: (targetRoomId) => {
      const cleanRoom = targetRoomId.trim() || '301';
      const roomLb = loadRoomLeaderboardFromStorage(cleanRoom);
      const maxSeatsMap = loadRoomMaxSeatsRegistry();
      const roomMaxSeats = maxSeatsMap[cleanRoom] || 40;

      setState({
        roomId: cleanRoom,
        maxSeatCount: roomMaxSeats,
        leaderboardMap: roomLb,
        allClassroomsMap: loadAllClassroomsFromStorage(),
      });

      // 若已連線 Firebase，切換監聽該班級的雲端排行榜（唯讀監聽，絕不寫入任何學生座號）
      if (getState().syncMode === 'firebase' && firebaseDb) {
        const nextLbPath = `/rooms/${cleanRoom}/leaderboard`;
        if (activeLeaderboardPath && activeLeaderboardPath !== nextLbPath) {
          off(ref(firebaseDb, activeLeaderboardPath));
        }
        activeLeaderboardPath = nextLbPath;
        onValue(ref(firebaseDb, nextLbPath), (snapshot) => {
          const val = snapshot.val();
          const nextVal = val && typeof val === 'object' ? val : {};
          saveRoomLeaderboardToStorage(cleanRoom, nextVal);
          if (getState().roomId === cleanRoom) {
            setState({
              leaderboardMap: nextVal,
              allClassroomsMap: loadAllClassroomsFromStorage(),
              firebaseConnected: true,
            });
          }
        });
      }
    },

    createOrUpdateClassroom: (targetRoomId, maxSeatCount) => {
      const cleanRoom = targetRoomId.trim();
      if (!cleanRoom) return;
      const state = getState();
      const maxSeatsMap = loadRoomMaxSeatsRegistry();
      const targetMax = maxSeatCount
        ? Math.max(5, Math.min(60, Math.floor(maxSeatCount)))
        : maxSeatsMap[cleanRoom] || 40;
      maxSeatsMap[cleanRoom] = targetMax;
      saveRoomMaxSeatsRegistry(maxSeatsMap);

      const existingLb = loadRoomLeaderboardFromStorage(cleanRoom);
      saveRoomLeaderboardToStorage(cleanRoom, existingLb);

      if (state.syncMode === 'firebase' && firebaseDb) {
        const roomMetaRef = ref(firebaseDb, `/rooms/${cleanRoom}/maxSeatCount`);
        set(roomMetaRef, targetMax).catch((e) => console.warn(e));
      }

      setState({
        maxSeatCount: cleanRoom === state.roomId ? targetMax : state.maxSeatCount,
        allClassroomsMap: loadAllClassroomsFromStorage(),
      });
    },

    deleteClassroom: (targetRoomId) => {
      const cleanRoom = targetRoomId.trim();
      if (!cleanRoom) return;
      const state = getState();
      try {
        localStorage.removeItem(`${STORAGE_PREFIX}room_${cleanRoom}_leaderboard`);
        const maxSeatsMap = loadRoomMaxSeatsRegistry();
        delete maxSeatsMap[cleanRoom];
        saveRoomMaxSeatsRegistry(maxSeatsMap);
      } catch {
        // ignore
      }
      if (state.syncMode === 'firebase' && firebaseDb) {
        const roomRef = ref(firebaseDb, `/rooms/${cleanRoom}`);
        set(roomRef, null).catch((e) => console.warn(e));
      }
      setState({
        allClassroomsMap: loadAllClassroomsFromStorage(),
      });
    },

    removeStudentFromRoom: (targetRoomId, seatNumber) => {
      const cleanRoom = targetRoomId.trim();
      const state = getState();
      const nextLb = { ...loadRoomLeaderboardFromStorage(cleanRoom) };
      delete nextLb[seatNumber];
      saveRoomLeaderboardToStorage(cleanRoom, nextLb);
      if (broadcastChannel) {
        broadcastChannel.postMessage({
          type: 'BULK_LEADERBOARD_UPDATE',
          roomId: cleanRoom,
          leaderboardMap: nextLb,
        });
      }
      if (state.syncMode === 'firebase' && firebaseDb) {
        const roomLbRef = ref(firebaseDb, `/rooms/${cleanRoom}/leaderboard`);
        set(roomLbRef, nextLb).catch((e) => console.warn(e));
      }
      setState({
        leaderboardMap: cleanRoom === state.roomId ? nextLb : state.leaderboardMap,
        allClassroomsMap: loadAllClassroomsFromStorage(),
      });
    },

    clearSimulatedInRoom: (targetRoomId) => {
      const cleanRoom = targetRoomId.trim();
      const state = getState();
      const currentLb = loadRoomLeaderboardFromStorage(cleanRoom);
      const nextLb: Record<number, LeaderboardEntry> = {};
      for (const [seatKey, entry] of Object.entries(currentLb)) {
        if (!entry.isSimulated) {
          nextLb[Number(seatKey)] = entry;
        }
      }
      saveRoomLeaderboardToStorage(cleanRoom, nextLb);
      if (broadcastChannel) {
        broadcastChannel.postMessage({
          type: 'BULK_LEADERBOARD_UPDATE',
          roomId: cleanRoom,
          leaderboardMap: nextLb,
        });
      }
      if (state.syncMode === 'firebase' && firebaseDb) {
        const roomLbRef = ref(firebaseDb, `/rooms/${cleanRoom}/leaderboard`);
        set(roomLbRef, nextLb).catch((e) => console.warn(e));
      }
      setState({
        leaderboardMap: cleanRoom === state.roomId ? nextLb : state.leaderboardMap,
        allClassroomsMap: loadAllClassroomsFromStorage(),
      });
    },

    simulateStudentsInRoom: async (targetRoomId) => {
      const t0 = performance.now();
      const cleanRoom = targetRoomId.trim() || getState().roomId;
      const state = getState();
      const maxSeatsMap = loadRoomMaxSeatsRegistry();
      const limit = maxSeatsMap[cleanRoom] || state.maxSeatCount || 40;
      const currentLb = loadRoomLeaderboardFromStorage(cleanRoom);
      const nextMap: Record<number, LeaderboardEntry> = { ...currentLb };

      for (let seat = 1; seat <= limit; seat++) {
        // 保留已加入的真實學生資料，僅針對空座號或模擬座號產生測試排課
        if (nextMap[seat] && nextMap[seat].isSimulated === false) continue;
        const sName = SAMPLE_NAMES[(seat - 1) % SAMPLE_NAMES.length] || `${seat}號同學`;
        const sNick = SAMPLE_NICKNAMES[seat] || `${sName.slice(-2)}`;
        const rand15 = (min: number, max: number) =>
          Math.floor((min + Math.random() * (max - min)) / 15) * 15;

        const dailyBreakdown: Record<number, Record<ParentCategoryId, number>> = {};
        let studyTotal = 0;
        let schoolTotal = 0;
        let sportsTotal = 0;
        let creativeTotal = 0;
        let dailyTotal = 0;
        let leisureTotal = 0;
        let sleepTotal = 0;

        for (let d = 0; d < 7; d++) {
          const st = rand15(30, 150);
          const sc = d < 5 ? 390 : 0;
          const sp = rand15(15, 120);
          const cr = rand15(15, 105);
          const da = rand15(60, 150);
          const le = rand15(30, 120);
          const sl = 540;
          dailyBreakdown[d] = {
            study: st,
            school: sc,
            sports: sp,
            creative: cr,
            daily: da,
            leisure: le,
            sleep: sl,
            other: 15,
          };
          studyTotal += st;
          schoolTotal += sc;
          sportsTotal += sp;
          creativeTotal += cr;
          dailyTotal += da;
          leisureTotal += le;
          sleepTotal += sl;
        }

        nextMap[seat] = {
          seatNumber: seat,
          name: sName,
          nickname: sNick,
          displayPreference: 'nickname',
          avatarUrl: generateDefaultAvatar(seat, sName),
          studyMinutes: studyTotal,
          schoolMinutes: schoolTotal,
          sportsMinutes: sportsTotal,
          creativeMinutes: creativeTotal,
          dailyMinutes: dailyTotal,
          leisureMinutes: leisureTotal,
          sleepMinutes: sleepTotal,
          otherMinutes: 105,
          dailyBreakdown,
          lastUpdated: Date.now(),
          isSimulated: true,
        };
      }

      saveRoomLeaderboardToStorage(cleanRoom, nextMap);
      if (broadcastChannel) {
        broadcastChannel.postMessage({
          type: 'BULK_LEADERBOARD_UPDATE',
          roomId: cleanRoom,
          leaderboardMap: nextMap,
        });
      }
      if (state.syncMode === 'firebase' && firebaseDb) {
        const roomLbRef = ref(firebaseDb, `/rooms/${cleanRoom}/leaderboard`);
        await set(roomLbRef, nextMap).catch((e) => console.warn(e));
      }
      const elapsed = Math.max(1, Math.round(performance.now() - t0));
      setState({
        leaderboardMap: cleanRoom === state.roomId ? nextMap : state.leaderboardMap,
        allClassroomsMap: loadAllClassroomsFromStorage(),
        lastSyncLatencyMs: elapsed,
      });
      return elapsed;
    },

    updateStudentProfile: (updates) => {
      const state = getState();
      const updatedStudent: StudentInfo = {
        ...state.student,
        ...updates,
      };
      setState({ student: updatedStudent });
      persistAndSyncStudent(
        state.roomId,
        updatedStudent,
        state.schedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    setSnapMinutes: (snap) => {
      const state = getState();
      saveActiveUserProfile({
        roomId: state.roomId,
        seatNumber: state.student.seatNumber,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        snapMinutes: snap,
      });
      setState({ snapMinutes: snap });
    },
    setFocusHours: (startHour, endHour) => {
      const cleanStart = Math.max(0, Math.min(23, Math.floor(startHour)));
      const cleanEnd = Math.max(cleanStart + 1, Math.min(24, Math.floor(endHour)));
      try {
        localStorage.setItem(
          `${STORAGE_PREFIX}focus_hours`,
          JSON.stringify({ start: cleanStart, end: cleanEnd })
        );
      } catch {
        // ignore
      }
      setState({ focusStartHour: cleanStart, focusEndHour: cleanEnd });
    },
    setPreviewTimeMinutes: (mins) => setState({ previewTimeMinutes: mins }),
    setSelectedBlockId: (id) => setState({ selectedBlockId: id }),
    toggleLeaderboardCollapsed: () =>
      setState((s) => ({ isLeaderboardCollapsed: !s.isLeaderboardCollapsed })),
    setPaletteOpen: (open) => setState({ isPaletteOpen: open }),

    setSelectedWeekOffset: (offset) => {
      // 嚴格禁止往前排前一周以及之前的活動 (offset >= 0)
      const safeOffset = Math.max(0, Math.floor(offset));
      const state = getState();
      const targetWeekKey = getWeekKeyByOffset(safeOffset);
      const nextSchedulesByWeek = { ...state.schedulesByWeek };
      if (!nextSchedulesByWeek[targetWeekKey]) {
        nextSchedulesByWeek[targetWeekKey] = createStarterSchedule();
      }
      setState({
        selectedWeekOffset: safeOffset,
        schedulesByWeek: nextSchedulesByWeek,
        schedule: nextSchedulesByWeek[targetWeekKey],
        undoStack: [],
        redoStack: [],
        selectedBlockId: null,
      });
    },

    jumpToFutureDate: (yyyyMmDd) => {
      if (!yyyyMmDd) return { ok: false };
      const parts = yyyyMmDd.split('-').map(Number);
      if (parts.length !== 3) return { ok: false };
      const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
      const { weekOffset } = resolveDateToWeekOffsetAndDay(targetDate);
      if (weekOffset < 0) {
        return {
          ok: false,
          message: '不能往前排前一週以及之前的活動！系統已維持在本週。',
        };
      }
      getState().setSelectedWeekOffset(weekOffset);
      return { ok: true };
    },

    pushUndoSnapshot: () => {
      const state = getState();
      const snapshot = state.schedule.map((b) => ({ ...b }));
      const nextUndo = [...state.undoStack, snapshot].slice(-30);
      setState({ undoStack: nextUndo, redoStack: [] });
    },

    undoSchedule: () => {
      const state = getState();
      if (state.undoStack.length === 0) return;
      const previousSchedule = state.undoStack[state.undoStack.length - 1];
      const nextUndo = state.undoStack.slice(0, -1);
      const currentSnapshot = state.schedule.map((b) => ({ ...b }));
      const nextRedo = [...state.redoStack, currentSnapshot].slice(-30);

      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: previousSchedule,
      };
      setState({
        undoStack: nextUndo,
        redoStack: nextRedo,
        selectedBlockId: null,
      });
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    redoSchedule: () => {
      const state = getState();
      if (state.redoStack.length === 0) return;
      const nextSchedule = state.redoStack[state.redoStack.length - 1];
      const nextRedo = state.redoStack.slice(0, -1);
      const currentSnapshot = state.schedule.map((b) => ({ ...b }));
      const nextUndo = [...state.undoStack, currentSnapshot].slice(-30);

      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: nextSchedule,
      };
      setState({
        undoStack: nextUndo,
        redoStack: nextRedo,
        selectedBlockId: null,
      });
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    moveBlockToDay: (blockId, targetDayIndex) => {
      const state = getState();
      const targetBlock = state.schedule.find((b) => b.id === blockId);
      if (!targetBlock || targetBlock.dayIndex === targetDayIndex) return;
      if (targetDayIndex < 0 || targetDayIndex > 6) return;
      // 禁止將已過期日期的積木移出，或將積木移入已過期的日期
      if (
        isPastDayInWeek(state.selectedWeekOffset, targetBlock.dayIndex) ||
        isPastDayInWeek(state.selectedWeekOffset, targetDayIndex)
      ) {
        return;
      }

      getState().pushUndoSnapshot();

      const movedBlock: ScheduleBlock = {
        ...targetBlock,
        dayIndex: targetDayIndex,
      };

      const bStart = movedBlock.startMinute;
      const bEnd = movedBlock.startMinute + movedBlock.durationMinutes;
      const nextSchedule: ScheduleBlock[] = [];

      for (const existing of state.schedule) {
        if (existing.id === blockId) continue;
        if (existing.dayIndex !== targetDayIndex) {
          nextSchedule.push(existing);
          continue;
        }
        const eStart = existing.startMinute;
        const eEnd = existing.startMinute + existing.durationMinutes;

        const isSameActivity =
          existing.name.trim() === movedBlock.name.trim() &&
          existing.parentId === movedBlock.parentId;
        if (isSameActivity && !(eEnd < bStart || eStart > bEnd)) {
          nextSchedule.push(existing);
          continue;
        }

        if (eEnd <= bStart || eStart >= bEnd) {
          nextSchedule.push(existing);
          continue;
        }
        if (eStart < bStart && eEnd > bStart) {
          const trimmedDuration = bStart - eStart;
          if (trimmedDuration >= 15) {
            nextSchedule.push({ ...existing, durationMinutes: trimmedDuration });
          }
        }
        if (eEnd > bEnd && eStart < bEnd) {
          const afterDuration = eEnd - bEnd;
          if (afterDuration >= 15) {
            nextSchedule.push({
              ...existing,
              id: `${existing.id}-tail-${Date.now().toString(36).slice(-3)}`,
              startMinute: bEnd,
              durationMinutes: afterDuration,
            });
          }
        }
      }

      nextSchedule.push(movedBlock);
      const merged = mergeAdjacentSameActivityBlocks(nextSchedule, movedBlock.id);
      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: merged,
      };
      setState({
        selectedBlockId: merged.find((b) => b.id === movedBlock.id) ? movedBlock.id : null,
      });
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    addBlock: (newBlockData) => {
      const state = getState();
      // 已過去的日期鎖定不可新增積木
      if (isPastDayInWeek(state.selectedWeekOffset, newBlockData.dayIndex)) {
        return {
          ...newBlockData,
          id: `locked-${Date.now()}`,
        };
      }
      getState().pushUndoSnapshot();
      const block: ScheduleBlock = {
        ...newBlockData,
        id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };

      const adjustedOthers: ScheduleBlock[] = [];
      const bStart = block.startMinute;
      const bEnd = block.startMinute + block.durationMinutes;

      for (const existing of state.schedule) {
        if (existing.dayIndex !== block.dayIndex) {
          adjustedOthers.push(existing);
          continue;
        }
        const eStart = existing.startMinute;
        const eEnd = existing.startMinute + existing.durationMinutes;

        // 若為相同活動且相鄰或重疊，直接保留給 mergeAdjacentSameActivityBlocks 整併
        const isSameActivity =
          existing.name.trim() === block.name.trim() &&
          existing.parentId === block.parentId;
        if (isSameActivity && !(eEnd < bStart || eStart > bEnd)) {
          adjustedOthers.push(existing);
          continue;
        }

        // 不同活動且無重疊
        if (eEnd <= bStart || eStart >= bEnd) {
          adjustedOthers.push(existing);
          continue;
        }
        // 不同活動重疊：裁切舊積木前端
        if (eStart < bStart && eEnd > bStart) {
          const trimmedDuration = bStart - eStart;
          if (trimmedDuration >= 15) {
            adjustedOthers.push({ ...existing, durationMinutes: trimmedDuration });
          }
        }
        // 不同活動重疊：裁切舊積木後端
        if (eEnd > bEnd && eStart < bEnd) {
          const afterDuration = eEnd - bEnd;
          if (afterDuration >= 15) {
            adjustedOthers.push({
              ...existing,
              id: `${existing.id}-tail`,
              startMinute: bEnd,
              durationMinutes: afterDuration,
            });
          }
        }
      }

      // 自動整併相鄰的相同活動積木
      const nextSchedule = mergeAdjacentSameActivityBlocks(
        [...adjustedOthers, block],
        block.id
      );
      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: nextSchedule,
      };

      const finalSelected = nextSchedule.find((b) => b.id === block.id)
        ? block.id
        : null;
      setState({ selectedBlockId: finalSelected });

      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
      return block;
    },

    updateBlock: (id, updates, autoMerge = false) => {
      const state = getState();
      const existingBlock = state.schedule.find((b) => b.id === id);
      if (!existingBlock) return;
      // 已過去的日期鎖定不可調整積木時間或時長，亦不可拖移至已過去的日期
      if (
        isPastDayInWeek(state.selectedWeekOffset, existingBlock.dayIndex) ||
        (typeof updates.dayIndex === 'number' &&
          isPastDayInWeek(state.selectedWeekOffset, updates.dayIndex))
      ) {
        return;
      }
      if (autoMerge) {
        getState().pushUndoSnapshot();
      }
      const nextSchedule = adjustNeighborsForBlockUpdate(
        state.schedule,
        id,
        updates,
        autoMerge
      );
      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: nextSchedule,
      };
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    removeBlock: (id) => {
      const state = getState();
      const existingBlock = state.schedule.find((b) => b.id === id);
      if (!existingBlock) return;
      // 已過去的日期鎖定不可刪除積木
      if (isPastDayInWeek(state.selectedWeekOffset, existingBlock.dayIndex)) {
        return;
      }
      getState().pushUndoSnapshot();
      const nextSchedule = state.schedule.filter((b) => b.id !== id);
      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: nextSchedule,
      };
      setState({
        selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
      });
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    replaceSchedule: (blocks) => {
      const state = getState();
      const merged = mergeAdjacentSameActivityBlocks(blocks, state.selectedBlockId || undefined);
      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: merged,
      };
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    importBlocksAcrossWeeks: (items, mode) => {
      getState().pushUndoSnapshot();
      const state = getState();
      const nextSchedulesByWeek = { ...state.schedulesByWeek };
      let firstImportedOffset: number | null = null;

      for (const { weekOffset, block } of items) {
        if (weekOffset < 0 || isPastDayInWeek(weekOffset, block.dayIndex)) continue; // 忽略已過去的週次與已過完的日期
        if (firstImportedOffset === null) firstImportedOffset = weekOffset;
        const wkKey = getWeekKeyByOffset(weekOffset);
        const existingWeekBlocks = nextSchedulesByWeek[wkKey]
          ? [...nextSchedulesByWeek[wkKey]]
          : createStarterSchedule();

        if (mode === 'fill-empty') {
          const evStart = block.startMinute;
          const evEnd = block.startMinute + block.durationMinutes;
          const hasConflict = existingWeekBlocks.some(
            (b) =>
              b.dayIndex === block.dayIndex &&
              !(b.startMinute + b.durationMinutes <= evStart || b.startMinute >= evEnd)
          );
          if (!hasConflict) {
            existingWeekBlocks.push(block);
          }
          nextSchedulesByWeek[wkKey] = mergeAdjacentSameActivityBlocks(existingWeekBlocks);
        } else {
          // overwrite mode
          const bStart = block.startMinute;
          const bEnd = block.startMinute + block.durationMinutes;
          const adjusted: ScheduleBlock[] = [];
          for (const existing of existingWeekBlocks) {
            if (existing.dayIndex !== block.dayIndex) {
              adjusted.push(existing);
              continue;
            }
            const eStart = existing.startMinute;
            const eEnd = existing.startMinute + existing.durationMinutes;
            if (eEnd <= bStart || eStart >= bEnd) {
              adjusted.push(existing);
              continue;
            }
            if (eStart < bStart && eEnd > bStart) {
              const trimmed = bStart - eStart;
              if (trimmed >= 15) adjusted.push({ ...existing, durationMinutes: trimmed });
            }
            if (eEnd > bEnd && eStart < bEnd) {
              const tail = eEnd - bEnd;
              if (tail >= 15) {
                adjusted.push({
                  ...existing,
                  id: `${existing.id}-tail`,
                  startMinute: bEnd,
                  durationMinutes: tail,
                });
              }
            }
          }
          adjusted.push(block);
          nextSchedulesByWeek[wkKey] = mergeAdjacentSameActivityBlocks(adjusted, block.id);
        }
      }

      const targetOffset =
        firstImportedOffset !== null ? firstImportedOffset : state.selectedWeekOffset;
      setState({ selectedWeekOffset: targetOffset });
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        targetOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    resetToStarterSchedule: () => {
      getState().pushUndoSnapshot();
      const state = getState();
      const starter = createStarterSchedule();
      // 若為當週，保留已過期日期的原本紀錄，僅還原今日與未來日期的範本課表
      const mergedStarter =
        state.selectedWeekOffset === 0
          ? [
              ...state.schedule.filter((b) =>
                isPastDayInWeek(state.selectedWeekOffset, b.dayIndex)
              ),
              ...starter.filter(
                (b) => !isPastDayInWeek(state.selectedWeekOffset, b.dayIndex)
              ),
            ]
          : starter;
      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: mergedStarter,
      };
      setState({ selectedBlockId: null });
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    clearDaySchedule: (dayIndex) => {
      const state = getState();
      if (isPastDayInWeek(state.selectedWeekOffset, dayIndex)) return;
      getState().pushUndoSnapshot();
      const nextSchedule = state.schedule.filter((b) => b.dayIndex !== dayIndex);
      const activeWeekKey = getWeekKeyByOffset(state.selectedWeekOffset);
      const nextSchedulesByWeek = {
        ...state.schedulesByWeek,
        [activeWeekKey]: nextSchedule,
      };
      setState({ selectedBlockId: null });
      persistAndSyncStudent(
        state.roomId,
        state.student,
        nextSchedulesByWeek,
        state.selectedWeekOffset,
        state.templates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    addCustomTemplate: (tpl) => {
      const state = getState();
      const newTpl: ActivityTemplate = {
        ...tpl,
        id: `custom-${Date.now()}`,
        isCustom: true,
      };
      const nextTemplates = [...state.templates, newTpl];
      persistAndSyncStudent(
        state.roomId,
        state.student,
        state.schedulesByWeek,
        state.selectedWeekOffset,
        nextTemplates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
      return newTpl;
    },

    removeTemplate: (id) => {
      const state = getState();
      const nextTemplates = state.templates.filter((t) => t.id !== id);
      persistAndSyncStudent(
        state.roomId,
        state.student,
        state.schedulesByWeek,
        state.selectedWeekOffset,
        nextTemplates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    restoreDefaultTemplates: () => {
      const state = getState();
      const customOnly = state.templates.filter((t) => t.isCustom);
      const nextTemplates = [...DEFAULT_ACTIVITY_TEMPLATES, ...customOnly];
      persistAndSyncStudent(
        state.roomId,
        state.student,
        state.schedulesByWeek,
        state.selectedWeekOffset,
        nextTemplates,
        state.syncMode,
        state.leaderboardMap,
        setState
      );
    },

    simulate40Students: async () => {
      return getState().simulateStudentsInRoom(getState().roomId);
    },

    connectFirebase: (config) => {
      try {
        const existingApps = getApps();
        firebaseApp =
          existingApps.length > 0 ? existingApps[0] : initializeApp(config, 'kids-planner');
        firebaseDb = getDatabase(firebaseApp);

        const state = getState();
        const lbPath = `/rooms/${state.roomId}/leaderboard`;
        if (activeLeaderboardPath && firebaseDb) {
          off(ref(firebaseDb, activeLeaderboardPath));
        }
        activeLeaderboardPath = lbPath;

        const lbRef = ref(firebaseDb, lbPath);
        onValue(lbRef, (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            saveRoomLeaderboardToStorage(getState().roomId, val);
            setState({
              leaderboardMap: val,
              allClassroomsMap: loadAllClassroomsFromStorage(),
              firebaseConnected: true,
            });
          }
        });

        // 監聽全校所有班級 `/rooms`，讓老師後台能即時掌握所有班級與已加入學生人數
        if (activeAllRoomsPath && firebaseDb) {
          off(ref(firebaseDb, activeAllRoomsPath));
        }
        activeAllRoomsPath = '/rooms';
        onValue(ref(firebaseDb, '/rooms'), (snapshot) => {
          const allRoomsVal = snapshot.val();
          if (allRoomsVal && typeof allRoomsVal === 'object') {
            const maxSeatsMap = loadRoomMaxSeatsRegistry();
            for (const [rId, roomData] of Object.entries<any>(allRoomsVal)) {
              if (roomData?.maxSeatCount) {
                maxSeatsMap[rId] = Number(roomData.maxSeatCount) || 40;
              }
              if (roomData?.leaderboard && typeof roomData.leaderboard === 'object') {
                saveRoomLeaderboardToStorage(rId, roomData.leaderboard);
              }
            }
            saveRoomMaxSeatsRegistry(maxSeatsMap);
            setState({
              allClassroomsMap: loadAllClassroomsFromStorage(),
              firebaseConnected: true,
            });
          }
        });

        try {
          localStorage.setItem(
            `${STORAGE_PREFIX}firebase_config`,
            JSON.stringify(config)
          );
        } catch {
          // ignore
        }

        setState({
          syncMode: 'firebase',
          firebaseConnected: true,
          firebaseConfig: config,
        });

        // 僅在「非教師管理後台入口」且「已完成首次學生資料設定」時才將本機學生資料推上雲端，避免老師進入後台時誤產生 1號學生
        const isTeacherUrl =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('mode') === 'teacher';
        if (state.hasCompletedOnboarding && !isTeacherUrl) {
          persistAndSyncStudent(
            state.roomId,
            state.student,
            state.schedulesByWeek,
            state.selectedWeekOffset,
            state.templates,
            'firebase',
            state.leaderboardMap,
            setState
          );
        }
      } catch (err) {
        console.error('Firebase initialization failed:', err);
        throw err;
      }
    },

    disconnectFirebase: () => {
      if (firebaseDb && activeLeaderboardPath) {
        off(ref(firebaseDb, activeLeaderboardPath));
        activeLeaderboardPath = null;
      }
      if (firebaseDb && activeAllRoomsPath) {
        off(ref(firebaseDb, activeAllRoomsPath));
        activeAllRoomsPath = null;
      }
      try {
        localStorage.removeItem(`${STORAGE_PREFIX}firebase_config`);
      } catch {
        // ignore
      }
      setState({
        syncMode: 'local',
        firebaseConnected: false,
        firebaseConfig: null,
      });
    },
  };
});

// 啟動時自動連線全校預設 Firebase Realtime Database（亦支援 ?db= 參數或自訂儲存設定）
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlDb = params.get('db');
      if (urlDb && urlDb.startsWith('http')) {
        const cleanDb = urlDb.trim().replace(/\/$/, '');
        const hostPart = cleanDb.replace(/^https?:\/\//, '').split('.')[0] || 'kids-planner';
        const inferredProjectId = hostPart.replace(/-default-rtdb$/, '');
        usePlannerStore.getState().connectFirebase({
          apiKey: 'demo-key',
          databaseURL: cleanDb,
          projectId: inferredProjectId,
        });
        return;
      }
      const savedFb = localStorage.getItem(`${STORAGE_PREFIX}firebase_config`);
      if (savedFb) {
        const parsed = JSON.parse(savedFb);
        if (parsed?.databaseURL) {
          usePlannerStore.getState().connectFirebase(parsed);
          return;
        }
      }
      // 預設直接連線全校共用的 Realtime Database (https://kids-planner-c7e84-default-rtdb.firebaseio.com)
      usePlannerStore.getState().connectFirebase(DEFAULT_FIREBASE_CONFIG);
    } catch {
      // ignore auto-connect errors
    }
  }, 50);
}

export function getParentCategory(id: ParentCategoryId) {
  return PARENT_CATEGORIES.find((c) => c.id === id) || PARENT_CATEGORIES[7];
}
