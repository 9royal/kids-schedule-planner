export type ParentCategoryId =
  | 'study'
  | 'school'
  | 'sports'
  | 'creative'
  | 'daily'
  | 'leisure'
  | 'sleep'
  | 'other';

export interface ZhuyinChar {
  char: string;
  zhuyin: string;
}

export interface CategoryQuote {
  text: string;
  source?: string; // 經查證屬實之格言出處（人名或著作）；若無確切出處則不標示
  sourceUrl?: string; // 對應之真實外部參考連結（如維基文庫、教育部辭典、維基語錄等）
}

export interface ParentCategory {
  id: ParentCategoryId;
  name: string;
  zhuyin: string; // space-separated per character
  english: string;
  color: string;
  bgLight: string;
  borderColor: string;
  leaderboardKey: string;
  quotes: string[]; // 相容舊版字串陣列
  weeklyQuoteSets: CategoryQuote[][]; // 每週更換一次不重複，每週每主題固定 3 句（含出處附註）
}

export interface ActivityTemplate {
  id: string;
  parentId: ParentCategoryId;
  name: string;
  zhuyin: string; // space-separated per character, e.g., "寫 功 課" -> "ㄒㄧㄝˇ ㄍㄨㄥ ㄎㄜˋ"
  english: string;
  color: string;
  iconName: string;
  defaultDurationMinutes: number;
  isCustom?: boolean;
}

export interface ScheduleBlock {
  id: string;
  dayIndex: number; // 0 = Monday, 6 = Sunday
  startMinute: number; // 0 to 1440 (24 * 60)
  durationMinutes: number; // multiples of 15 or 30
  activityId: string;
  parentId: ParentCategoryId;
  name: string;
  zhuyin: string;
  english: string;
  color: string;
  iconName: string;
  weekKey?: string; // Monday YYYY-MM-DD of the target week
}

export type NameDisplayPreference = 'nickname' | 'name';

export interface StudentInfo {
  seatNumber: number; // 1 ~ 40
  name: string;
  nickname?: string; // 暱稱
  displayPreference?: NameDisplayPreference; // 加入者自行選擇要顯示名字還是暱稱，預設是 'nickname'
  avatarUrl: string; // compressed 128x128 WebP/JPEG data URL (< 15KB)
}

export interface LeaderboardEntry {
  seatNumber: number;
  name: string;
  nickname?: string;
  displayPreference?: NameDisplayPreference;
  avatarUrl: string;
  studyMinutes: number;
  schoolMinutes: number;
  sportsMinutes: number;
  creativeMinutes: number;
  dailyMinutes: number;
  leisureMinutes: number;
  sleepMinutes: number;
  otherMinutes: number;
  dailyBreakdown?: Record<number, Record<ParentCategoryId, number>>;
  lastUpdated: number;
}

export interface FirebaseConfigInput {
  apiKey: string;
  authDomain?: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}
