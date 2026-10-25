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
import { LeaderboardEntry, ParentCategoryId } from '../types/schedule';
import { compressAvatarImage } from '../utils/avatarCompressor';
import { RubyText } from '../utils/zhuyin';
import { CuteActivityIcon } from './CuteActivityIcon';
import {
  Sparkles,
  Clock,
  Puzzle,
  Camera,
  Edit3,
  Check,
  Settings,
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
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(student.nickname || '');
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
  const activeBlock = currentWeekSchedule.find(
    (b) =>
      b.dayIndex === currentDayIndex &&
      currentMinuteOfDay >= b.startMinute &&
      currentMinuteOfDay < b.startMinute + b.durationMinutes
  );

  const parentCat = activeBlock ? getParentCategory(activeBlock.parentId) : null;
  const dayInfo = DAYS_OF_WEEK[currentDayIndex];
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}/${String(now.getDate()).padStart(2, '0')}`;

  // 計算個人在當前排行榜類別的名次與時數（對應右側附圖卡片）
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
      setAvatarNotice(`已自動圓形裁切 128×128 並壓縮至 ${kb} KB (<15KB)`);
      setTimeout(() => setAvatarNotice(null), 4500);
    } catch (err: any) {
      setAvatarNotice(err?.message || '頭像處理失敗');
    }
  };

  const handleSaveNickname = () => {
    updateStudentProfile({
      nickname: nicknameDraft.trim(),
      displayPreference: 'nickname',
    });
    setIsEditingNickname(false);
  };

  return (
    <section className="bg-white/95 backdrop-blur-md border-2 border-amber-200/80 rounded-3xl shadow-sm p-4 grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
      {/* 1. 左側：雙時鐘（指針時鐘 + 24小時制標準時鐘，只顯示現在時間） */}
      <div className="xl:col-span-4 flex items-center gap-4 bg-amber-50/45 border border-amber-200/70 rounded-2xl px-4 py-3">
        {/* Vector Analog Clock */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
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
            <circle cx="60" cy="60" r="4.5" fill="#F59E0B" stroke="#1E293B" strokeWidth="2" />
          </svg>
        </div>

        {/* 24-Hour Digital Clock (現在時間) */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              現在時間 · {dateStr} {dayInfo.full}
            </span>
          </div>

          <div className="font-rounded text-3xl sm:text-4xl font-black tracking-tight text-slate-800 tabular-nums leading-none mt-1">
            {formatTime24(displayHours, displayMinutes, displaySeconds)}
          </div>

          <div className="text-xs font-medium text-slate-500 mt-1">
            24小時制標準時鐘 · {displayHours < 12 ? '上午 AM' : '下午 PM'}
          </div>
        </div>
      </div>

      {/* 2. 中間：現在進行中活動方框（內含「規劃作息表」連結按鈕） */}
      <div
        className="xl:col-span-4 rounded-2xl border-2 px-4 py-3 flex items-center justify-between gap-3 transition-colors"
        style={{
          backgroundColor: parentCat ? parentCat.bgLight : '#F8FAFC',
          borderColor: parentCat ? parentCat.borderColor : '#E2E8F0',
        }}
      >
        {activeBlock && parentCat ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border-2 bg-white shrink-0"
              style={{ borderColor: activeBlock.color }}
            >
              <CuteActivityIcon iconName={activeBlock.iconName} size={38} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white shadow-xs"
                  style={{ backgroundColor: activeBlock.color }}
                >
                  現在進行中 · {parentCat.name}
                </span>
                <span className="text-xs font-bold text-slate-600 tabular-nums">
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

              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide truncate">
                <RubyText
                  text={activeBlock.name}
                  zhuyin={activeBlock.zhuyin}
                  rtClassName="text-slate-700"
                  nowrap
                />
              </div>

              {activeBlock.english && (
                <div className="text-xs font-bold text-slate-600 tracking-wide truncate">
                  {activeBlock.english}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white border-2 border-dashed border-amber-300 shrink-0">
              <Sparkles className="w-7 h-7 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-amber-700 mb-0.5">目前時段尚未安排活動</div>
              <div className="text-lg sm:text-xl font-black text-slate-800">
                <RubyText
                  text="自由探索時間"
                  zhuyin="ㄗˋ ㄧㄡˊ ㄊㄢˋ ㄙㄨㄛˇ ㄕˊ ㄐㄧㄢ"
                  rtClassName="text-slate-600"
                  nowrap
                />
              </div>
              <div className="text-xs font-bold text-slate-500">
                Free Exploration Time
              </div>
            </div>
          </div>
        )}

        {/* 規劃作息表連結（放置於現在進行中活動方框內右側） */}
        <button
          type="button"
          onClick={onGoToPlannerTab}
          className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 border-2 border-amber-600 text-white font-black text-xs sm:text-sm inline-flex items-center gap-1.5 shadow-sm shrink-0 transition cursor-pointer"
          title="前往規劃作息表"
        >
          <Puzzle className="w-4 h-4 shrink-0" />
          <span>規劃作息表</span>
        </button>
      </div>

      {/* 3. 右側：附圖個人資訊卡（班級座號、暱稱、目前排行榜名次、修改暱稱、更換頭像）＋ 個人資料與系統管理介面連結 */}
      <div className="xl:col-span-4 px-4 py-3 rounded-2xl bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white border-2 border-amber-200/90 flex flex-col justify-center gap-2">
        <div className="flex items-center gap-3.5">
          {/* 圓形大頭貼與相機按鈕 */}
          <div className="relative group shrink-0">
            <img
              src={student.avatarUrl}
              alt={student.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow-xs bg-white"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow border border-white transition cursor-pointer"
              title="上傳自訂大頭貼 (自動 Canvas 128x128 壓縮)"
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

          {/* 班級座號、暱稱、排名與操作按鈕 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-amber-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                班級 {roomId} · {student.seatNumber} 號
              </span>
              <span className="font-black text-base text-slate-900 truncate">
                {formatLeaderboardDisplayName(
                  student.name,
                  student.nickname,
                  myDisplayPref
                )}
              </span>
            </div>

            <div className="text-xs font-bold text-slate-600 mt-1">
              目前【{activeCategoryObj.name}榜】排名：
              <strong className="text-amber-700 text-sm">第 {myRank || '-'} 名</strong>（
              {formatHoursAndMinutes(myScore)}）
            </div>

            {/* 修改暱稱、更換頭像、以及「個人資料與系統管理介面」連結 */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {isEditingNickname ? (
                <div className="flex items-center gap-1 w-full">
                  <input
                    type="text"
                    maxLength={10}
                    value={nicknameDraft}
                    onChange={(e) => setNicknameDraft(e.target.value)}
                    placeholder="輸入暱稱"
                    className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleSaveNickname}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    儲存
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setNicknameDraft(student.nickname || '');
                      setIsEditingNickname(true);
                    }}
                    className="text-[11px] font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    {student.nickname ? `修改暱稱 (${student.nickname})` : '設定排行榜暱稱'}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-bold text-blue-600 hover:underline px-1 cursor-pointer"
                  >
                    更換頭像
                  </button>

                  <button
                    type="button"
                    onClick={onOpenManagementModal}
                    className="text-[11px] font-black bg-orange-100 hover:bg-orange-200 text-orange-950 border border-orange-300 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition cursor-pointer"
                    title="開啟個人資料與系統管理介面"
                  >
                    <Settings className="w-3 h-3 text-orange-600 shrink-0" />
                    <span>個資與系統管理</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {avatarNotice && (
          <div className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
            ✅ {avatarNotice}
          </div>
        )}
      </div>
    </section>
  );
};
