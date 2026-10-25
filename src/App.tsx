import React, { useState } from 'react';
import {
  usePlannerStore,
  getWeekMondayByOffset,
  formatDateKeyYYYYMMDD,
  getCurrentWeekMonday,
} from './store/usePlannerStore';
import { DualClockDashboard } from './components/DualClockDashboard';
import { WeeklyPuzzlePlanner } from './components/WeeklyPuzzlePlanner';
import { ActivityPaletteDrawer } from './components/ActivityPaletteDrawer';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { RoomSeatModal } from './components/RoomSeatModal';
import { CalendarImportModal } from './components/CalendarImportModal';
import { formatLeaderboardDisplayName } from './data/categories';
import { ParentCategoryId } from './types/schedule';
import {
  Calendar,
  Clock,
  Focus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Settings,
  Grid,
  Undo2,
  XCircle,
} from 'lucide-react';

export type MainTabId = 'dashboard' | 'planner';

// 統一頂部橫排所有連結與控制項的膠囊格式（高度 h-9、圓角 rounded-xl、邊框 border-2、字級 text-xs font-black 皆一致，僅顏色不同）
const TOP_PILL_BASE =
  'h-9 px-3 rounded-xl border-2 inline-flex items-center gap-1.5 text-xs font-black whitespace-nowrap shrink-0 shadow-2xs transition';

export function PlannerApp() {
  const {
    roomId,
    student,
    hasCompletedOnboarding,
    setOnboardingCompleted,
    snapMinutes,
    setSnapMinutes,
    focusStartHour,
    focusEndHour,
    setFocusHours,
    resetToStarterSchedule,
    undoStack,
    undoSchedule,
    selectedWeekOffset,
    setSelectedWeekOffset,
    jumpToFutureDate,
  } = usePlannerStore();

  // 預設首頁顯示「時間與排行榜」，「規劃作息表」在獨立分頁（亦支援 ?tab=planner 直接開啟）
  const [activeTab, setActiveTab] = useState<MainTabId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'planner') return 'planner';
    }
    return 'dashboard';
  });

  // 預設不預選右側積木 (null)，防止使用者剛進入規劃頁滑動或點擊時誤放積木
  const [activePaletteTemplateId, setActivePaletteTemplateId] = useState<string | null>(
    null
  );

  // 時間與排行榜頁面的目前排行榜類別與統計範圍（同步連動上方右側個人名次卡片與下方排行榜）
  const [selectedLeaderboardCategory, setSelectedLeaderboardCategory] =
    useState<ParentCategoryId>('sleep');
  const [leaderboardTimeScope, setLeaderboardTimeScope] = useState<'weekly' | 'today'>(
    'weekly'
  );

  // 若使用者是第一次使用 (!hasCompletedOnboarding)，自動開啟首次個資與偏好設定頁面；設定完成後永久記住，之後使用免重複設定
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(
    () => !hasCompletedOnboarding
  );
  const [isFirstTimeFlow, setIsFirstTimeFlow] = useState<boolean>(
    () => !hasCompletedOnboarding
  );
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [focusScrollTrigger, setFocusScrollTrigger] = useState(0);
  const [pastWeekHint, setPastWeekHint] = useState(false);

  const displayStudentName = formatLeaderboardDisplayName(
    student.name,
    student.nickname,
    student.displayPreference || 'nickname'
  );

  // 計算當前選擇週次的起訖日期（週一 ～ 週日）與最小可選日期（本週一）
  const currentMonday = getCurrentWeekMonday();
  const minAllowedDateStr = formatDateKeyYYYYMMDD(currentMonday);
  const weekMonday = getWeekMondayByOffset(selectedWeekOffset);
  const weekSunday = new Date(weekMonday);
  weekSunday.setDate(weekMonday.getDate() + 6);
  const selectedMondayStr = formatDateKeyYYYYMMDD(weekMonday);
  const weekRangeLabel = `${weekMonday.getMonth() + 1}/${weekMonday.getDate()}–${
    weekSunday.getMonth() + 1
  }/${weekSunday.getDate()}`;

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const res = jumpToFutureDate(val);
    if (!res.ok) {
      setPastWeekHint(true);
      setTimeout(() => setPastWeekHint(false), 3000);
    }
  };

  const handleOpenManagementModal = () => {
    setIsFirstTimeFlow(false);
    setIsRoomModalOpen(true);
  };

  const handleCloseManagementModal = () => {
    if (!hasCompletedOnboarding) {
      setOnboardingCompleted(true);
    }
    setIsFirstTimeFlow(false);
    setIsRoomModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-sky-50/60 text-slate-800">
      {/* 僅在「規劃作息表」頁面顯示頂部導覽與工具列（時間與排行頁面的連結已整合至時鐘與現在活動列內，並取消匯入行事曆連結） */}
      {activeTab === 'planner' && (
        <header className="px-3 py-2 bg-white/95 backdrop-blur-md border-b-2 border-amber-200/80 sticky top-0 z-40">
          <nav
            aria-label="主功能導覽與工具橫排"
            className="max-w-[1920px] mx-auto flex items-center justify-between gap-2 flex-wrap xl:flex-nowrap overflow-x-auto no-scrollbar"
          >
            {/* 左側：返回時間與排行榜 + 班級個資與管理介面 + 匯入行事曆 */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`${TOP_PILL_BASE} bg-amber-500 hover:bg-amber-600 border-amber-600 text-white cursor-pointer`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>時間與排行榜</span>
              </button>

              <button
                type="button"
                onClick={handleOpenManagementModal}
                className={`${TOP_PILL_BASE} bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-950 cursor-pointer`}
                title="開啟個人資料與系統管理介面"
              >
                <Settings className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                <span>
                  班級 {roomId} · {student.seatNumber}號 {displayStudentName} · 個資與管理
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsCalendarModalOpen(true)}
                className={`${TOP_PILL_BASE} bg-blue-600 hover:bg-blue-700 border-blue-700 text-white cursor-pointer`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>匯入 Google / .ics 行事曆</span>
              </button>
            </div>

            {/* 右側：日期/週次、聚焦時段、格點、回復上一步、範本課表 */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              {/* 1. 週次與未來日期選擇器 */}
              <div
                className={`${TOP_PILL_BASE} bg-sky-50 border-sky-300 text-sky-950`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <button
                  type="button"
                  disabled={selectedWeekOffset <= 0}
                  onClick={() => setSelectedWeekOffset(Math.max(0, selectedWeekOffset - 1))}
                  title={
                    selectedWeekOffset <= 0
                      ? '不可往前排過去的週次（僅開放當週與未來週次）'
                      : '返回前一週'
                  }
                  className={`p-0.5 rounded transition ${
                    selectedWeekOffset <= 0
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-sky-700 hover:bg-sky-200/70'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span>
                  {selectedWeekOffset === 0
                    ? `當週 ${weekRangeLabel}`
                    : `未來+${selectedWeekOffset}週 ${weekRangeLabel}`}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedWeekOffset(selectedWeekOffset + 1)}
                  title="預排下一週作息"
                  className="p-0.5 rounded text-sky-700 hover:bg-sky-200/70 transition"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {selectedWeekOffset > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedWeekOffset(0)}
                    className="px-1.5 py-0.5 rounded bg-sky-600 text-white text-[11px] font-black hover:bg-sky-700 transition"
                  >
                    回當週
                  </button>
                )}

                <input
                  type="date"
                  min={minAllowedDateStr}
                  value={selectedMondayStr}
                  onChange={handleDatePickerChange}
                  aria-label="選擇當週或未來日期預排"
                  title="選擇當週或未來日期預排（不可往前排前一周及之前的活動）"
                  className="h-6 bg-white border border-sky-300 rounded-md px-1.5 text-[11px] font-black text-sky-900 cursor-pointer w-[112px]"
                />
              </div>

              {pastWeekHint && (
                <span
                  className={`${TOP_PILL_BASE} bg-rose-50 border-rose-300 text-rose-700`}
                >
                  ⚠️ 僅可排當週與未來週次
                </span>
              )}

              {/* 2. 聚焦時段 */}
              <div
                className={`${TOP_PILL_BASE} bg-emerald-50 border-emerald-300 text-emerald-950`}
              >
                <Focus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>聚焦時段</span>
                <select
                  aria-label="聚焦開始時間"
                  value={focusStartHour}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFocusHours(val, Math.max(val + 1, focusEndHour));
                  }}
                  className="h-6 bg-white border border-emerald-300 rounded-md px-1 font-black text-emerald-900 text-xs cursor-pointer"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <span>~</span>
                <select
                  aria-label="聚焦結束時間"
                  value={focusEndHour}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFocusHours(Math.min(focusStartHour, val - 1), val);
                  }}
                  className="h-6 bg-white border border-emerald-300 rounded-md px-1 font-black text-emerald-900 text-xs cursor-pointer"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setFocusScrollTrigger((n) => n + 1)}
                  className="h-6 px-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] transition"
                >
                  定位
                </button>
              </div>

              {/* 3. 格點切換 */}
              <div
                className={`${TOP_PILL_BASE} bg-violet-50 border-violet-300 text-violet-950`}
              >
                <Grid className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                <span>格點</span>
                <button
                  type="button"
                  onClick={() => setSnapMinutes(15)}
                  className={`h-6 px-2 rounded-md font-black text-[11px] transition ${
                    snapMinutes === 15
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-violet-800 border border-violet-200 hover:bg-violet-100'
                  }`}
                >
                  15分
                </button>
                <button
                  type="button"
                  onClick={() => setSnapMinutes(30)}
                  className={`h-6 px-2 rounded-md font-black text-[11px] transition ${
                    snapMinutes === 30
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-violet-800 border border-violet-200 hover:bg-violet-100'
                  }`}
                >
                  30分
                </button>
              </div>

              {/* 4. 回復上一步（Undo） */}
              <button
                type="button"
                disabled={undoStack.length === 0}
                onClick={undoSchedule}
                className={`${TOP_PILL_BASE} ${
                  undoStack.length > 0
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-400 text-amber-950 cursor-pointer'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title="回復上一步 (快捷鍵 Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5 shrink-0" />
                <span>回復上一步{undoStack.length > 0 ? ` (${undoStack.length})` : ''}</span>
              </button>

              {/* 5. 快速放棄積木點選 */}
              {activePaletteTemplateId && (
                <button
                  type="button"
                  onClick={() => setActivePaletteTemplateId(null)}
                  className={`${TOP_PILL_BASE} bg-rose-600 hover:bg-rose-700 border-rose-700 text-white cursor-pointer`}
                  title="快速放棄目前點選的積木 (Esc)"
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>放棄積木點選</span>
                </button>
              )}

              {/* 6. 範本課表重置 */}
              <button
                type="button"
                onClick={resetToStarterSchedule}
                className={`${TOP_PILL_BASE} bg-slate-100 hover:bg-rose-50 border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-700`}
                title="還原為預設範本課表（含 22:00-07:00 晚間睡眠）"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>範本課表</span>
              </button>
            </div>
          </nav>
        </header>
      )}

      {/* Main Content Area by Active Tab */}
      <main className="flex-1 flex flex-col gap-3 p-3 sm:p-4 max-w-[1920px] w-full mx-auto">
        {activeTab === 'dashboard' ? (
          <>
            {/* 時間與排行頁面：左＝現在時間時鐘、中＝現在進行中活動（含規劃作息表連結）、右＝個人資訊卡與系統管理介面連結 */}
            <DualClockDashboard
              selectedCategory={selectedLeaderboardCategory}
              timeScope={leaderboardTimeScope}
              onGoToPlannerTab={() => setActiveTab('planner')}
              onOpenManagementModal={handleOpenManagementModal}
            />
            <LeaderboardPanel
              selectedCategory={selectedLeaderboardCategory}
              onSelectCategory={setSelectedLeaderboardCategory}
              timeScope={leaderboardTimeScope}
              onChangeTimeScope={setLeaderboardTimeScope}
            />
          </>
        ) : (
          /* 規劃作息表分頁：100% 畫面專注於 24H 拼圖時間軸與右側活動調色盤 */
          <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-[calc(100vh-76px)]">
            <WeeklyPuzzlePlanner
              activePaletteTemplateId={activePaletteTemplateId}
              onClearPaletteSelection={() => setActivePaletteTemplateId(null)}
              focusScrollTrigger={focusScrollTrigger}
            />
            <ActivityPaletteDrawer
              activeTemplateId={activePaletteTemplateId}
              onSelectTemplate={(id) => setActivePaletteTemplateId(id)}
            />
          </div>
        )}
      </main>

      {/* 首次使用設定精靈 & 系統管理介面 Modal */}
      <RoomSeatModal
        isOpen={isRoomModalOpen}
        onClose={handleCloseManagementModal}
        isFirstTimeOnboarding={isFirstTimeFlow}
      />
      <CalendarImportModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
      />
    </div>
  );
}

export default PlannerApp;
