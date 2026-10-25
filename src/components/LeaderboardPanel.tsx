import React, { useState } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  PARENT_CATEGORIES,
  formatLeaderboardDisplayName,
  getWeeklyQuoteSetForCategory,
} from '../data/categories';
import { LeaderboardEntry, ParentCategoryId } from '../types/schedule';
import { RubyText } from '../utils/zhuyin';
import {
  Zap,
  Sparkles,
  HeartHandshake,
  RefreshCw,
  BookOpen,
  ExternalLink,
  Puzzle,
} from 'lucide-react';

function formatHoursAndMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}小時`;
  return `${h}時${m}分`;
}

interface LeaderboardPanelProps {
  selectedCategory: ParentCategoryId;
  onSelectCategory: (catId: ParentCategoryId) => void;
  timeScope: 'weekly' | 'today';
  onChangeTimeScope: (scope: 'weekly' | 'today') => void;
  onGoToPlannerTab: () => void;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  selectedCategory,
  onSelectCategory,
  timeScope,
  onChangeTimeScope,
  onGoToPlannerTab,
}) => {
  const {
    student,
    leaderboardMap,
    lastSyncLatencyMs,
  } = usePlannerStore();

  const [quoteIdx, setQuoteIdx] = useState(0);

  const isTeacherMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mode') === 'teacher';

  const myDisplayPref = student.displayPreference || 'nickname';

  const activeCategoryObj =
    PARENT_CATEGORIES.find((c) => c.id === selectedCategory) || PARENT_CATEGORIES[6];

  // 每週自動輪替一組（每主題每週固定 3 句、週週不重複；若有查證屬實之出處則附上參考連結，無確切出處則不標示人名或著作）
  const { quotes: weeklyQuotes, weekCycleIndex, totalCycles } =
    getWeeklyQuoteSetForCategory(activeCategoryObj);
  const currentQuoteObj = weeklyQuotes[quoteIdx % weeklyQuotes.length] || {
    text: '每一分努力的時光，都在為更好的自己累積能量！',
  };

  const now = new Date();
  const jsDay = now.getDay();
  const todayIndex = jsDay === 0 ? 6 : jsDay - 1;

  const getScoreForEntry = (entry: LeaderboardEntry, catId: ParentCategoryId): number => {
    if (timeScope === 'today' && entry.dailyBreakdown && entry.dailyBreakdown[todayIndex]) {
      return entry.dailyBreakdown[todayIndex][catId] || 0;
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

  const allEntries = Object.values(leaderboardMap);
  const sortedEntries = [...allEntries].sort(
    (a, b) => getScoreForEntry(b, selectedCategory) - getScoreForEntry(a, selectedCategory)
  );
  // 每個項目 TOP 達人列 6 人
  const topList = sortedEntries.slice(0, 6);
  const maxScore = Math.max(60, ...topList.map((e) => getScoreForEntry(e, selectedCategory)));

  const myEntry = leaderboardMap[student.seatNumber];

  return (
    <section className="w-full bg-white border-2 border-amber-200/90 rounded-3xl shadow-sm flex flex-col overflow-hidden transition-all duration-300">
      {/* 暖心哲思與格言佳句（每週自動更換不重複，每主題三句；有確切來源才顯示人名／著作與參考連結） */}
      <div
        className="mx-5 mt-5 p-4 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
        style={{
          backgroundColor: activeCategoryObj.bgLight,
          borderColor: activeCategoryObj.borderColor,
        }}
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{ backgroundColor: activeCategoryObj.color }}
          >
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-black px-2.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: activeCategoryObj.color }}
              >
                {activeCategoryObj.name}榜 · 本週暖心哲思與格言佳句（第 {weekCycleIndex + 1}/{totalCycles} 週輪替）
              </span>
              <span className="text-xs font-bold text-slate-500">
                {activeCategoryObj.english}
              </span>
            </div>
            <p className="text-sm sm:text-base font-black text-slate-800 mt-1.5 leading-relaxed">
              「
              <RubyText
                text={currentQuoteObj.text}
                rtClassName="text-slate-600"
              />
              」
            </p>
            {currentQuoteObj.source && currentQuoteObj.sourceUrl && (
              <div className="mt-1.5 inline-flex items-center gap-2 flex-wrap text-xs font-bold text-slate-700 bg-white/90 border border-slate-200 px-3 py-1 rounded-full shadow-2xs">
                <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>出處：{currentQuoteObj.source}</span>
                <a
                  href={currentQuoteObj.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-black"
                  title={`前往查閱「${currentQuoteObj.source}」典籍或權威參考來源`}
                >
                  <span>參考連結</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setQuoteIdx((prev) => (prev + 1) % weeklyQuotes.length)}
          className="inline-flex items-center gap-1.5 text-xs font-black bg-white/90 hover:bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs shrink-0 transition cursor-pointer"
          title="切換本週此主題的下一句暖心格言（每週固定 3 句，每週自動更換不重複）"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
          <span>
            本週佳句 ({(quoteIdx % weeklyQuotes.length) + 1}/{weeklyQuotes.length})
          </span>
        </button>
      </div>

      {/* Main Grid: Left = My 8-Category Time Distribution | Right = Top 6 Rankings List */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols on lg): My 8 Categories Overview Grid */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>我的 8 大領域時數總覽（點擊可切換排行榜）</span>
              </span>
              <button
                type="button"
                onClick={onGoToPlannerTab}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 border-2 border-amber-600 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-2xs shrink-0 transition cursor-pointer"
                title="前往規劃作息表"
              >
                <Puzzle className="w-3.5 h-3.5 shrink-0" />
                <span>規劃作息表</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 flex-1">
              {PARENT_CATEGORIES.map((cat) => {
                const mins = myEntry ? getScoreForEntry(myEntry, cat.id) : 0;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat.id);
                      setQuoteIdx(0);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-white border-amber-400 ring-2 ring-amber-200 shadow-2xs'
                        : 'bg-white/80 border-slate-200/80 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs sm:text-sm font-black text-slate-800 truncate">
                        {cat.name}
                      </span>
                    </div>
                    <span
                      className="text-xs sm:text-sm font-black tabular-nums shrink-0"
                      style={{ color: cat.color }}
                    >
                      {formatHoursAndMinutes(mins)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (7 cols on lg): Active Category Leaderboard TOP 6 (由左上空間開始排列，即使只有1-2人也不會沉底) */}
        <div className="lg:col-span-7 flex flex-col justify-start bg-slate-50/60 border border-slate-200/90 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full inline-block"
                style={{ backgroundColor: activeCategoryObj.color }}
              />
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                🏆 {activeCategoryObj.name}榜 TOP 6 達人
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {/* 本週 / 本日累積切換 */}
              <div className="inline-flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => onChangeTimeScope('weekly')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    timeScope === 'weekly'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  本週累積
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTimeScope('today')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    timeScope === 'today'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  本日累積
                </button>
              </div>

              {lastSyncLatencyMs !== null && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <Zap className="w-3.5 h-3.5" /> 即時同步 {lastSyncLatencyMs}ms
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start items-start">
            {topList.map((entry, idx) => {
              const score = getScoreForEntry(entry, selectedCategory);
              const pct = Math.min(100, Math.round((score / maxScore) * 100));
              const isMe = !isTeacherMode && entry.seatNumber === student.seatNumber;
              const medalColors = [
                'bg-amber-400 text-amber-950 ring-2 ring-amber-200',
                'bg-slate-300 text-slate-900 ring-2 ring-slate-200',
                'bg-amber-600 text-white ring-2 ring-amber-300',
              ];

              const entryPref = isMe
                ? myDisplayPref
                : entry.displayPreference || 'nickname';
              const displayName = formatLeaderboardDisplayName(
                entry.name,
                entry.nickname,
                entryPref
              );

              return (
                <div
                  key={entry.seatNumber}
                  className={`p-3 rounded-2xl border transition ${
                    isMe
                      ? 'bg-amber-50/95 border-amber-400 ring-2 ring-amber-300 shadow-xs'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                          idx < 3 ? medalColors[idx] : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <img
                        src={entry.avatarUrl}
                        alt={displayName}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0 bg-white"
                      />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-black text-slate-800 truncate flex items-center gap-1">
                          <span>
                            {entry.seatNumber}號 {displayName}
                          </span>
                          {isMe && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full shrink-0">
                              我
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold text-slate-400">
                          {entryPref === 'nickname' && entry.nickname
                            ? '顯示暱稱'
                            : '顯示圈圈姓名'}
                        </div>
                      </div>
                    </div>

                    <span
                      className="text-xs sm:text-sm font-black tabular-nums shrink-0"
                      style={{ color: activeCategoryObj.color }}
                    >
                      {formatHoursAndMinutes(score)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: activeCategoryObj.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
