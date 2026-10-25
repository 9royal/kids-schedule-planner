import React, { useEffect, useRef, useState } from 'react';
import {
  usePlannerStore,
  getParentCategory,
  getWeekKeyByOffset,
} from '../store/usePlannerStore';
import {
  DAYS_OF_WEEK,
  PARENT_CATEGORIES,
  formatLeaderboardDisplayName,
} from '../data/categories';
import { LeaderboardEntry, ParentCategoryId, ScheduleBlock } from '../types/schedule';
import { compressAvatarImage } from '../utils/avatarCompressor';
import { RubyText } from '../utils/zhuyin';
import { CuteActivityIcon } from './CuteActivityIcon';
import {
  Sparkles,
  Clock,
  Puzzle,
  Camera,
  Settings,
  FastForward,
} from 'lucide-react';

function formatTime24(hours: number, minutes: number, seconds?: number): string {
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  if (typeof seconds === 'number') {
    const ss = String(seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}`;
}

function formatHoursAndMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}小時`;
  return `${h}時${m}分`;
}

interface DualClockDashboardProps {
  selectedCategory: ParentCategoryId;
  timeScope: 'weekly' | 'today';
  onGoToPlannerTab: () => void;
  onOpenManagementModal: () => void;
}

export const DualClockDashboard: React.FC<DualClockDashboardProps> = ({
  selectedCategory,
  timeScope,
  onGoToPlannerTab,
  onOpenManagementModal,
}) => {
  const {
    roomId,
    student,
    updateStudentProfile,
    leaderboardMap,
    schedule,
    schedulesByWeek,
  } = usePlannerStore();

  const [now, setNow] = useState<Date>(() => new Date());
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 時鐘永遠只顯示現在系統真實時間
  const displayHours = now.getHours();
  const displayMinutes = now.getMinutes();
  const displaySeconds = now.getSeconds();

  // Angles for SVG Analog Clock
  const secondAngle = displaySeconds * 6;
  const minuteAngle = displayMinutes * 6 + displaySeconds * 0.1;
  const hourAngle = (displayHours % 12) * 30 + displayMinutes * 0.5;

  // Determine current dayIndex (0=Mon .. 6=Sun)
  const jsDay = now.getDay();
  const currentDayIndex = jsDay === 0 ? 6 : jsDay - 1;
  const currentMinuteOfDay = displayHours * 60 + displayMinutes;

  // Find the active block right now in the current week
  const currentWeekSchedule = schedulesByWeek[getWeekKeyByOffset(0)] || schedule;
  const todayBlocks = currentWeekSchedule
    .filter((b) => b.dayIndex === currentDayIndex)
    .sort((a, b) => a.startMinute - b.startMinute);

  const activeBlock = todayBlocks.find(
    (b) =>
      currentMinuteOfDay >= b.startMinute &&
      currentMinuteOfDay < b.startMinute + b.durationMinutes
  );

  // 尋找「下個活動」（同日後續時段的第一個積木；若今日已無後續活動，則找明日第一個活動）
  let nextBlock: ScheduleBlock | undefined = todayBlocks.find(
    (b) =>
      b.id !== activeBlock?.id &&
      b.startMinute >= (activeBlock ? activeBlock.startMinute + activeBlock.durationMinutes : currentMinuteOfDay)
  );
  let isNextBlockTomorrow = false;

  if (!nextBlock) {
    const tomorrowDayIndex = (currentDayIndex + 1) % 7;
    const tomorrowBlocks = currentWeekSchedule
      .filter((b) => b.dayIndex === tomorrowDayIndex)
      .sort((a, b) => a.startMinute - b.startMinute);
    if (tomorrowBlocks.length > 0) {
      nextBlock = tomorrowBlocks[0];
      isNextBlockTomorrow = true;
    }
  }

  const parentCat = activeBlock ? getParentCategory(activeBlock.parentId) : null;
  const nextParentCat = nextBlock ? getParentCategory(nextBlock.parentId) : null;
  const dayInfo = DAYS_OF_WEEK[currentDayIndex];
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}/${String(now.getDate()).padStart(2, '0')}`;

  // 計算距離下個活動開始還有多久
  const minutesUntilNext = nextBlock
    ? isNextBlockTomorrow
      ? 1440 - currentMinuteOfDay + nextBlock.startMinute
      : Math.max(0, nextBlock.startMinute - currentMinuteOfDay)
    : null;

  // 計算個人在當前排行榜類別的名次與時數（對應右側個人資料卡）
  const activeCategoryObj =
    PARENT_CATEGORIES.find((c) => c.id === selectedCategory) || PARENT_CATEGORIES[6];
  const myDisplayPref = student.displayPreference || 'nickname';

  const getScoreForEntry = (entry: LeaderboardEntry, catId: ParentCategoryId): number => {
    if (
      timeScope === 'today' &&
      entry.dailyBreakdown &&
      entry.dailyBreakdown[currentDayIndex]
    ) {
      return entry.dailyBreakdown[currentDayIndex][catId] || 0;
    }
    switch (catId) {
      case 'study':
        return entry.studyMinutes || 0;
      case 'school':
        return entry.schoolMinutes || 0;
      case 'sports':
        return entry.sportsMinutes || 0;
      case 'creative':
        return entry.creativeMinutes || 0;
      case 'daily':
        return entry.dailyMinutes || 0;
      case 'leisure':
        return entry.leisureMinutes || 0;
      case 'sleep':
        return entry.sleepMinutes || 0;
      default:
        return entry.otherMinutes || 0;
    }
  };

  const sortedEntries = Object.values(leaderboardMap).sort(
    (a, b) => getScoreForEntry(b, selectedCategory) - getScoreForEntry(a, selectedCategory)
  );
  const myRank =
    sortedEntries.findIndex((e) => e.seatNumber === student.seatNumber) + 1;
  const myEntry = leaderboardMap[student.seatNumber];
  const myScore = myEntry ? getScoreForEntry(myEntry, selectedCategory) : 0;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, byteSize } = await compressAvatarImage(file);
      updateStudentProfile({ avatarUrl: dataUrl });
      const kb = (byteSize / 1024).toFixed(1);
      setAvatarNotice(`已壓縮至 ${kb} KB`);
      setTimeout(() => setAvatarNotice(null), 4000);
    } catch (err: any) {
      setAvatarNotice(err?.message || '頭像處理失敗');
    }
  };

  return (
    <section className="bg-white/95 backdrop-blur-md border-2 border-amber-200/80 rounded-3xl shadow-sm p-3.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-stretch">
      {/* 1. 第一格（xl:col-span-4）：時鐘方框 ＋ 規劃作息表連結（移入時鐘方框內右側） */}
      <div className="xl:col-span-4 flex items-center justify-between gap-2.5 bg-amber-50/45 border border-amber-200/70 rounded-2xl px-3.5 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Vector Analog Clock */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-sm">
              <circle
                cx="60"
                cy="60"
                r="56"
                fill="#FFFBEB"
                stroke="#F59E0B"
                strokeWidth="5"
              />
              {Array.from({ length: 12 }).map((_, i) => {
                const num = i === 0 ? 12 : i;
                const angleRad = ((i * 30 - 90) * Math.PI) / 180;
                const x1 = 60 + Math.cos(angleRad) * 46;
                const y1 = 60 + Math.sin(angleRad) * 46;
                const x2 = 60 + Math.cos(angleRad) * 51;
                const y2 = 60 + Math.sin(angleRad) * 51;
                const tx = 60 + Math.cos(angleRad) * 37;
                const ty = 60 + Math.sin(angleRad) * 37;
                return (
                  <g key={i}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#64748B"
                      strokeWidth={i % 3 === 0 ? '2.5' : '1.5'}
                      strokeLinecap="round"
                    />
                    <text
                      x={tx}
                      y={ty + 3.5}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="800"
                      fill="#334155"
                    >
                      {num}
                    </text>
                  </g>
                );
              })}

              {/* Hour Hand */}
              <g transform={`rotate(${hourAngle} 60 60)`}>
                <line
                  x1="60"
                  y1="62"
                  x2="60"
                  y2="34"
                  stroke="#1E293B"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </g>

              {/* Minute Hand */}
              <g transform={`rotate(${minuteAngle} 60 60)`}>
                <line
                  x1="60"
                  y1="64"
                  x2="60"
                  y2="22"
                  stroke="#2563EB"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </g>

              {/* Second Hand */}
              <g transform={`rotate(${secondAngle} 60 60)`}>
                <line
                  x1="60"
                  y1="68"
                  x2="60"
                  y2="18"
                  stroke="#EF4444"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>

              {/* Center Cap */}
              <circle
                cx="60"
                cy="60"
                r="4.5"
                fill="#F59E0B"
                stroke="#1E293B"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* 24-Hour Digital Clock (現在時間) */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">
                現在時間 · {dateStr} {dayInfo.full}
              </span>
            </div>

            <div className="font-rounded text-2xl sm:text-3xl font-black tracking-tight text-slate-800 tabular-nums leading-none mt-1">
              {formatTime24(displayHours, displayMinutes, displaySeconds)}
            </div>

            <div className="text-[11px] font-medium text-slate-500 mt-1 truncate">
              24小時制標準時鐘 · {displayHours < 12 ? '上午 AM' : '下午 PM'}
            </div>
          </div>
        </div>

        {/* 規劃作息表連結（移入時鐘方框內右側） */}
        <button
          type="button"
          onClick={onGoToPlannerTab}
          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 border-2 border-amber-600 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-sm shrink-0 transition cursor-pointer"
          title="前往規劃作息表"
        >
          <Puzzle className="w-4 h-4 shrink-0" />
          <span>規劃作息表</span>
        </button>
      </div>

      {/* 2. 第二格（xl:col-span-3）：現在進行中活動方框 */}
      <div
        className="xl:col-span-3 rounded-2xl border-2 px-3.5 py-2.5 flex items-center gap-3 transition-colors"
        style={{
          backgroundColor: parentCat ? parentCat.bgLight : '#F8FAFC',
          borderColor: parentCat ? parentCat.borderColor : '#E2E8F0',
        }}
      >
        {activeBlock && parentCat ? (
          <div className="flex items-center gap-3 min-w-0 w-full">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-sm border-2 bg-white shrink-0"
              style={{ borderColor: activeBlock.color }}
            >
              <CuteActivityIcon iconName={activeBlock.iconName} size={34} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white shadow-xs"
                  style={{ backgroundColor: activeBlock.color }}
                >
                  現在進行中 · {parentCat.name}
                </span>
                <span className="text-[11px] font-bold text-slate-600 tabular-nums">
                  {formatTime24(
                    Math.floor(activeBlock.startMinute / 60),
                    activeBlock.startMinute % 60
                  )}
                  –
                  {formatTime24(
                    Math.floor((activeBlock.startMinute + activeBlock.durationMinutes) / 60),
                    (activeBlock.startMinute + activeBlock.durationMinutes) % 60
                  )}
                </span>
              </div>

              <div className="text-lg sm:text-xl font-black text-slate-900 tracking-wide truncate">
                <RubyText
                  text={activeBlock.name}
                  zhuyin={activeBlock.zhuyin}
                  rtClassName="text-slate-700"
                  nowrap
                />
              </div>

              {activeBlock.english && (
                <div className="text-[11px] font-bold text-slate-600 tracking-wide truncate">
                  {activeBlock.english}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0 w-full">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-white border-2 border-dashed border-amber-300 shrink-0">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-amber-700 mb-0.5">
                現在進行中 · 尚未安排
              </div>
              <div className="text-base sm:text-lg font-black text-slate-800 truncate">
                <RubyText
                  text="自由探索時間"
                  zhuyin="ㄗˋ ㄧㄡˊ ㄊㄢˋ ㄙㄨㄛˇ ㄕˊ ㄐㄧㄢ"
                  rtClassName="text-slate-600"
                  nowrap
                />
              </div>
              <div className="text-[11px] font-bold text-slate-500 truncate">
                Free Exploration Time
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. 第三格（xl:col-span-2）：下個活動的提示方框（位於「現在進行中」與「個人資料」中間） */}
      <div
        className="xl:col-span-2 rounded-2xl border-2 px-3 py-2.5 flex items-center gap-2.5 transition-colors"
        style={{
          backgroundColor: nextParentCat ? `${nextParentCat.bgLight}` : '#F8FAFC',
          borderColor: nextParentCat ? nextParentCat.borderColor : '#CBD5E1',
        }}
      >
        {nextBlock && nextParentCat ? (
          <div className="flex items-center gap-2.5 min-w-0 w-full">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-2xs border-2 bg-white shrink-0"
              style={{ borderColor: nextBlock.color }}
            >
              <CuteActivityIcon iconName={nextBlock.iconName} size={28} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 flex-wrap mb-0.5">
                <span
                  className="text-[10px] font-black px-2 py-0.5 rounded-full text-white inline-flex items-center gap-0.5"
                  style={{ backgroundColor: nextBlock.color }}
                >
                  <FastForward className="w-2.5 h-2.5 shrink-0" />
                  <span>下個活動</span>
                </span>
                <span className="text-[11px] font-bold text-slate-600 tabular-nums">
                  {isNextBlockTomorrow ? '明日 ' : ''}
                  {formatTime24(
                    Math.floor(nextBlock.startMinute / 60),
                    nextBlock.startMinute % 60
                  )}
                </span>
              </div>

              <div className="text-base sm:text-lg font-black text-slate-900 tracking-wide truncate">
                <RubyText
                  text={nextBlock.name}
                  zhuyin={nextBlock.zhuyin}
                  rtClassName="text-slate-700"
                  nowrap
                />
              </div>

              <div className="text-[10px] font-bold text-slate-500 truncate">
                {minutesUntilNext !== null && minutesUntilNext > 0
                  ? `還有 ${formatHoursAndMinutes(minutesUntilNext)} 開始`
                  : nextBlock.english || nextParentCat.name}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 w-full">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white border-2 border-dashed border-slate-300 shrink-0">
              <FastForward className="w-5 h-5 text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-slate-500 mb-0.5">下個活動預告</div>
              <div className="text-sm font-black text-slate-700 truncate">
                尚無後續排程
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. 第四格（xl:col-span-3）：個人資料方框（移除修改暱稱与更換頭像文字，個資與系統管理 icon 移至名稱後面） */}
      <div className="xl:col-span-3 px-3.5 py-2.5 rounded-2xl bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white border-2 border-amber-200/90 flex flex-col justify-center">
        <div className="flex items-center gap-3">
          {/* 圓形大頭貼與相機按鈕 */}
          <div className="relative group shrink-0">
            <img
              src={student.avatarUrl}
              alt={student.name}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-amber-400 shadow-xs bg-white"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow border border-white transition cursor-pointer"
              title="點擊更換大頭貼"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          {/* 班級座號、暱稱＋個資與系統管理 icon、以及目前排行榜名次 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-amber-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full shrink-0">
                班級 {roomId} · {student.seatNumber} 號
              </span>
              <span className="font-black text-base text-slate-900 truncate">
                {formatLeaderboardDisplayName(
                  student.name,
                  student.nickname,
                  myDisplayPref
                )}
              </span>
              {/* 個資與系統管理 icon 移到名稱後面 */}
              <button
                type="button"
                onClick={onOpenManagementModal}
                className="w-7 h-7 rounded-full bg-orange-100 hover:bg-orange-200 border border-orange-300 text-orange-700 flex items-center justify-center shadow-2xs transition cursor-pointer shrink-0"
                title="開啟個人資料與系統管理介面（修改班級、座號、暱稱、頭像與班級管理）"
                aria-label="開啟個人資料與系統管理介面"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-xs font-bold text-slate-600 mt-1.5 truncate">
              目前【{activeCategoryObj.name}榜】排名：
              <strong className="text-amber-700 text-sm">第 {myRank || '-'} 名</strong>（
              {formatHoursAndMinutes(myScore)}）
            </div>

            {avatarNotice && (
              <div className="mt-1 text-[10px] font-bold text-emerald-700">
                ✅ {avatarNotice}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
