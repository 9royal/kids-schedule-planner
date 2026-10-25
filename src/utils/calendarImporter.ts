import ICAL from 'ical.js';
import { ParentCategoryId, ScheduleBlock } from '../types/schedule';
import { PARENT_CATEGORIES } from '../data/categories';
import { autoGenerateZhuyin } from './zhuyin';
import {
  getCurrentWeekMonday,
  resolveDateToWeekOffsetAndDay,
} from '../store/usePlannerStore';

export interface ParsedCalendarEvent {
  id: string;
  title: string;
  dayIndex: number; // 0 = Mon, 6 = Sun
  weekOffset: number; // 0 = 本週, >= 1 = 未來週次 (< 0 為過去週次，將自動阻擋匯入)
  dateLabel: string; // e.g., "10/26"
  startMinute: number;
  durationMinutes: number;
  suggestedCategory: ParentCategoryId;
}

const KEYWORD_RULES: { category: ParentCategoryId; keywords: string[]; icon: string }[] = [
  {
    category: 'study',
    keywords: ['讀書', '功課', '作業', '英文', '英語', '數學', '閱讀', '複習', '補習', '溫習', 'study', 'homework', 'read', 'english', 'math'],
    icon: 'homework',
  },
  {
    category: 'school',
    keywords: ['學校', '上課', '社團', '班會', '早自習', '課後', 'school', 'class', 'club'],
    icon: 'school',
  },
  {
    category: 'sports',
    keywords: ['運動', '球', '游泳', '跑步', '跳繩', '體能', '單車', '直排輪', '體操', 'sport', 'swim', 'run', 'gym', 'basketball', 'soccer'],
    icon: 'sports',
  },
  {
    category: 'creative',
    keywords: ['琴', '音樂', '畫', '美術', '手作', '舞蹈', '書法', '圍棋', '創作', '才藝', 'music', 'piano', 'art', 'draw', 'dance'],
    icon: 'music',
  },
  {
    category: 'daily',
    keywords: ['餐', '飯', '洗澡', '盥洗', '家事', '整理', '刷牙', '早餐', '午餐', '晚餐', 'meal', 'lunch', 'dinner', 'breakfast', 'chore', 'bath'],
    icon: 'meal',
  },
  {
    category: 'leisure',
    keywords: ['遊戲', '玩', '電視', '卡通', '親子', '公園', '散步', '電影', 'play', 'game', 'movie', 'park', 'family'],
    icon: 'game',
  },
  {
    category: 'sleep',
    keywords: ['睡', '眠', '午休', '休息', '小憩', 'sleep', 'nap', 'rest', 'bed'],
    icon: 'sleep',
  },
];

export function classifyActivityTitle(title: string): { category: ParentCategoryId; icon: string } {
  const lower = title.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { category: rule.category, icon: rule.icon };
    }
  }
  return { category: 'other', icon: 'star' };
}

export function snapToGrid(minutes: number, grid = 15): number {
  return Math.round(minutes / grid) * grid;
}

export function parseIcsContent(icsText: string): {
  validEvents: ParsedCalendarEvent[];
  skippedPastCount: number;
} {
  const jcalData = ICAL.parse(icsText);
  const vcalendar = new ICAL.Component(jcalData);
  const vevents = vcalendar.getAllSubcomponents('vevent');
  const validEvents: ParsedCalendarEvent[] = [];
  let skippedPastCount = 0;

  vevents.forEach((vevent: any, idx: number) => {
    const event = new ICAL.Event(vevent);
    const title = event.summary || '未命名行程';
    const startDate = event.startDate?.toJSDate();
    const endDate = event.endDate?.toJSDate();

    if (!startDate || !endDate) return;

    const { weekOffset, dayIndex } = resolveDateToWeekOffsetAndDay(startDate);
    if (weekOffset < 0) {
      skippedPastCount++;
      return; // 不能往前排前一周以及之前的活動
    }

    const rawStartMin = startDate.getHours() * 60 + startDate.getMinutes();
    const rawEndMin = endDate.getHours() * 60 + endDate.getMinutes();
    const startMinute = Math.max(0, Math.min(1410, snapToGrid(rawStartMin, 15)));
    let durationMinutes = snapToGrid(rawEndMin - rawStartMin, 15);
    if (durationMinutes <= 0) durationMinutes = 60;
    if (startMinute + durationMinutes > 1440) {
      durationMinutes = 1440 - startMinute;
    }

    const { category } = classifyActivityTitle(title);
    const mm = String(startDate.getMonth() + 1).padStart(2, '0');
    const dd = String(startDate.getDate()).padStart(2, '0');

    validEvents.push({
      id: `ics-${idx}-${Date.now()}`,
      title,
      dayIndex,
      weekOffset,
      dateLabel: `${mm}/${dd}`,
      startMinute,
      durationMinutes,
      suggestedCategory: category,
    });
  });

  return { validEvents, skippedPastCount };
}

export async function fetchGoogleCalendarEvents(
  accessToken: string
): Promise<ParsedCalendarEvent[]> {
  const monday = getCurrentWeekMonday();
  // 拉取本週一至未來 4 週的行程（不拉取前週以前的過去行程）
  const futureEnd = new Date(monday);
  futureEnd.setDate(monday.getDate() + 28);
  futureEnd.setHours(23, 59, 59, 999);

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', monday.toISOString());
  url.searchParams.set('timeMax', futureEnd.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Google Calendar API 回應錯誤 (${res.status})`);
  }

  const data = await res.json();
  const items = data.items || [];
  const results: ParsedCalendarEvent[] = [];

  items.forEach((item: any, idx: number) => {
    const startStr = item.start?.dateTime;
    const endStr = item.end?.dateTime;
    if (!startStr || !endStr) return;

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const { weekOffset, dayIndex } = resolveDateToWeekOffsetAndDay(startDate);
    if (weekOffset < 0) return;

    const rawStartMin = startDate.getHours() * 60 + startDate.getMinutes();
    const rawEndMin = endDate.getHours() * 60 + endDate.getMinutes();
    const startMinute = Math.max(0, Math.min(1410, snapToGrid(rawStartMin, 15)));
    let durationMinutes = snapToGrid(rawEndMin - rawStartMin, 15);
    if (durationMinutes <= 0) durationMinutes = 60;
    if (startMinute + durationMinutes > 1440) {
      durationMinutes = 1440 - startMinute;
    }

    const title = item.summary || 'Google 日曆行程';
    const { category } = classifyActivityTitle(title);
    const mm = String(startDate.getMonth() + 1).padStart(2, '0');
    const dd = String(startDate.getDate()).padStart(2, '0');

    results.push({
      id: `gcal-${idx}-${Date.now()}`,
      title,
      dayIndex,
      weekOffset,
      dateLabel: `${mm}/${dd}`,
      startMinute,
      durationMinutes,
      suggestedCategory: category,
    });
  });

  return results;
}

function formatIcsLocalDateTime(baseMonday: Date, addDays: number, hour: number, minute: number): string {
  const d = new Date(baseMonday);
  d.setDate(baseMonday.getDate() + addDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${min}00`;
}

export function generateSampleIcsText(): string {
  const monday = getCurrentWeekMonday();
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kids Schedule Planner//TW',
    'BEGIN:VEVENT',
    'SUMMARY:英文會話練習',
    `DTSTART:${formatIcsLocalDateTime(monday, 0, 16, 0)}`,
    `DTEND:${formatIcsLocalDateTime(monday, 0, 17, 30)}`,
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:足球體能訓練',
    `DTSTART:${formatIcsLocalDateTime(monday, 2, 16, 0)}`,
    `DTEND:${formatIcsLocalDateTime(monday, 2, 18, 0)}`,
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:烏克麗麗音樂課',
    `DTSTART:${formatIcsLocalDateTime(monday, 4, 19, 0)}`,
    `DTEND:${formatIcsLocalDateTime(monday, 4, 20, 30)}`,
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:下週科學閱讀與實驗',
    `DTSTART:${formatIcsLocalDateTime(monday, 8, 16, 0)}`,
    `DTEND:${formatIcsLocalDateTime(monday, 8, 18, 0)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function convertParsedEventToBlock(ev: ParsedCalendarEvent): ScheduleBlock {
  const parentCat = PARENT_CATEGORIES.find((c) => c.id === ev.suggestedCategory) || PARENT_CATEGORIES[7];
  const { icon } = classifyActivityTitle(ev.title);
  return {
    id: `imported-${ev.id}-${Math.random().toString(36).slice(2, 6)}`,
    dayIndex: ev.dayIndex,
    startMinute: ev.startMinute,
    durationMinutes: ev.durationMinutes,
    activityId: `imported-${ev.suggestedCategory}`,
    parentId: ev.suggestedCategory,
    name: ev.title.slice(0, 8),
    zhuyin: autoGenerateZhuyin(ev.title.slice(0, 8)),
    english: parentCat.english,
    color: parentCat.color,
    iconName: icon,
  };
}
