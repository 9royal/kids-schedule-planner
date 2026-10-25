import React, { useEffect, useRef, useState } from 'react';
import {
  usePlannerStore,
  getWeekMondayByOffset,
  mergeAdjacentSameActivityBlocks,
  adjustNeighborsForBlockUpdate,
} from '../store/usePlannerStore';
import {
  DAYS_OF_WEEK,
  formatLeaderboardDisplayName,
} from '../data/categories';
import { ScheduleBlock } from '../types/schedule';
import { RubyText } from '../utils/zhuyin';
import { CuteActivityIcon } from './CuteActivityIcon';
import {
  Trash2,
  GripVertical,
  Link2,
  XCircle,
  Undo2,
  Redo2,
  RotateCcw,
  Settings,
  ArrowRightLeft,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Move,
} from 'lucide-react';

const HOUR_WIDTH_PX = 120; // 120px per hour -> 2px per minute (30px per 15 mins, 60px per 30 mins)
const TOTAL_HOURS = 24;
const TOTAL_WIDTH_PX = HOUR_WIDTH_PX * TOTAL_HOURS; // 2880px
const PX_PER_MINUTE = HOUR_WIDTH_PX / 60;
const DAY_COL_WIDTH_PX = 116;
const DRAG_THRESHOLD_PX = 8; // 8px 防誤觸門檻：避免點擊或微小晃動時誤拉伸或誤移位

const QUICK_JUMP_HOURS = [
  { label: '🌙 00:00 凌晨', hour: 0 },
  { label: '☀️ 06:00 早晨', hour: 6 },
  { label: '🏫 08:00 上午', hour: 8 },
  { label: '🍱 12:00 中午', hour: 12 },
  { label: '🌆 16:00 放學', hour: 16 },
  { label: '💤 20:00 晚間', hour: 20 },
];

function formatHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(totalMinutes)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatMonthDay(baseMonday: Date, addDays: number): string {
  const d = new Date(baseMonday);
  d.setDate(baseMonday.getDate() + addDays);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

interface DragInteractionState {
  blockId: string;
  mode: 'move' | 'resize-left' | 'resize-right';
  startX: number;
  startY: number;
  hasExceededThreshold: boolean;
  initialDayIndex: number;
  initialStartMinute: number;
  initialDurationMinutes: number;
  initialSchedule: ScheduleBlock[];
}

interface PanCanvasState {
  startX: number;
  startY: number;
  initialScrollLeft: number;
  initialScrollTop: number;
  initialWindowScrollY: number;
  isPanning: boolean;
}

interface HoverPreviewState {
  dayIndex: number;
  startMinute: number;
}

interface CursorFollowerPos {
  x: number;
  y: number;
}

interface WeeklyPuzzlePlannerProps {
  activePaletteTemplateId: string | null;
  onClearPaletteSelection: () => void;
  onOpenManagementModal: () => void;
  focusScrollTrigger?: number;
}

export const WeeklyPuzzlePlanner: React.FC<WeeklyPuzzlePlannerProps> = ({
  activePaletteTemplateId,
  onClearPaletteSelection,
  onOpenManagementModal,
  focusScrollTrigger = 0,
}) => {
  const {
    roomId,
    student,
    schedule,
    undoStack,
    redoStack,
    pushUndoSnapshot,
    undoSchedule,
    redoSchedule,
    resetToStarterSchedule,
    moveBlockToDay,
    templates,
    snapMinutes,
    focusStartHour,
    focusEndHour,
    selectedWeekOffset,
    selectedBlockId,
    setSelectedBlockId,
    setPreviewTimeMinutes,
    updateBlock,
    removeBlock,
    addBlock,
    replaceSchedule,
  } = usePlannerStore();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragInteractionState | null>(null);
  const panStateRef = useRef<PanCanvasState | null>(null);
  const [dragState, setDragState] = useState<DragInteractionState | null>(null);
  const [isGrabPanning, setIsGrabPanning] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const [cursorPos, setCursorPos] = useState<CursorFollowerPos | null>(null);

  // 防誤放積木：記錄軌道 PointerDown 座標與最後一次積木拖拉／平移結束時間
  const trackPointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const lastBlockInteractionTimeRef = useRef<number>(0);

  // 嚴格對應點選狀態：只有當使用者明確點選右側積木時才啟用放置模式
  const activeTemplate = activePaletteTemplateId
    ? templates.find((t) => t.id === activePaletteTemplateId) || null
    : null;

  const weekMonday = getWeekMondayByOffset(selectedWeekOffset);

  const displayStudentName = formatLeaderboardDisplayName(
    student.name,
    student.nickname,
    student.displayPreference || 'nickname'
  );

  const updateDragStateBoth = (next: DragInteractionState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  };

  // Smoothly scroll to target hour
  const scrollToHour = (
    targetHour: number,
    behavior: ScrollBehavior = 'smooth'
  ) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const targetLeft = targetHour * HOUR_WIDTH_PX - 12;
    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior,
    });
  };

  const scrollHorizontalByHours = (deltaHours: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({
      left: deltaHours * HOUR_WIDTH_PX,
      behavior: 'smooth',
    });
  };

  const scrollVerticalByRows = (direction: 'up' | 'down') => {
    const container = scrollContainerRef.current;
    const deltaY = direction === 'up' ? -260 : 260;
    if (container && container.scrollHeight > container.clientHeight + 4) {
      container.scrollBy({ top: deltaY, behavior: 'smooth' });
    }
    window.scrollBy({ top: deltaY, behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToHour(focusStartHour, 'smooth');
    }, 80);
    return () => clearTimeout(timer);
  }, [focusStartHour, focusScrollTrigger]);

  // 支援鍵盤 Esc 快速放棄積木點選、Ctrl+Z 回復上一步、以及方向鍵輕鬆上下左右移動時間軸
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (activePaletteTemplateId) {
          onClearPaletteSelection();
          setHoverPreview(null);
          setCursorPos(null);
        } else if (selectedBlockId) {
          setSelectedBlockId(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redoSchedule();
        } else {
          undoSchedule();
        }
      } else if (e.key === 'ArrowLeft') {
        scrollHorizontalByHours(-2);
      } else if (e.key === 'ArrowRight') {
        scrollHorizontalByHours(2);
      } else if (e.key === 'ArrowUp') {
        scrollVerticalByRows('up');
      } else if (e.key === 'ArrowDown') {
        scrollVerticalByRows('down');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePaletteTemplateId,
    selectedBlockId,
    onClearPaletteSelection,
    setSelectedBlockId,
    undoSchedule,
    redoSchedule,
  ]);

  // 當取消選取積木時清除游標預覽
  useEffect(() => {
    if (!activeTemplate) {
      setHoverPreview(null);
      setCursorPos(null);
    }
  }, [activeTemplate]);

  // 空白處按住拖曳平移畫布 (Grab-to-Pan：同時支援左右滑動時間軸與上下捲動頁面)
  useEffect(() => {
    if (!isGrabPanning) return;

    const handlePanMove = (e: PointerEvent) => {
      const pan = panStateRef.current;
      const container = scrollContainerRef.current;
      if (!pan || !container) return;

      const dx = e.clientX - pan.startX;
      const dy = e.clientY - pan.startY;
      if (!pan.isPanning && Math.hypot(dx, dy) >= 5) {
        pan.isPanning = true;
      }
      if (pan.isPanning) {
        e.preventDefault();
        lastBlockInteractionTimeRef.current = Date.now();
        container.scrollLeft = pan.initialScrollLeft - dx;
        if (container.scrollHeight > container.clientHeight + 4) {
          container.scrollTop = pan.initialScrollTop - dy;
        } else {
          window.scrollTo({ top: pan.initialWindowScrollY - dy });
        }
      }
    };

    const handlePanUp = () => {
      if (panStateRef.current?.isPanning) {
        lastBlockInteractionTimeRef.current = Date.now();
      }
      panStateRef.current = null;
      setIsGrabPanning(false);
    };

    window.addEventListener('pointermove', handlePanMove, { passive: false });
    window.addEventListener('pointerup', handlePanUp);
    window.addEventListener('pointercancel', handlePanUp);
    return () => {
      window.removeEventListener('pointermove', handlePanMove);
      window.removeEventListener('pointerup', handlePanUp);
      window.removeEventListener('pointercancel', handlePanUp);
    };
  }, [isGrabPanning]);

  // Resolve overlaps for a modified block against other blocks on the same day,
  // AND automatically merge adjacent blocks if they are the same activity!
  const settleBlockOverlaps = (targetBlockId: string) => {
    const currentSchedule = usePlannerStore.getState().schedule;
    const movedBlock = currentSchedule.find((b) => b.id === targetBlockId);
    if (!movedBlock) return;

    const bStart = movedBlock.startMinute;
    const bEnd = movedBlock.startMinute + movedBlock.durationMinutes;
    const nextSchedule: ScheduleBlock[] = [];

    for (const existing of currentSchedule) {
      if (existing.id === movedBlock.id) continue;
      if (existing.dayIndex !== movedBlock.dayIndex) {
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
    replaceSchedule(merged);
  };

  // Global PointerMove / PointerUp listeners with 8px DRAG_THRESHOLD_PX to prevent accidental drag/resize
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag) return;

      const deltaX = e.clientX - currentDrag.startX;
      const deltaY = e.clientY - currentDrag.startY;
      const dist = Math.hypot(deltaX, deltaY);

      // 未達 8px 防誤觸門檻前，完全不觸發移動或拉伸
      if (!currentDrag.hasExceededThreshold) {
        if (dist < DRAG_THRESHOLD_PX) {
          return;
        }
        pushUndoSnapshot();
        const activated: DragInteractionState = {
          ...currentDrag,
          hasExceededThreshold: true,
        };
        updateDragStateBoth(activated);
      }

      e.preventDefault();
      lastBlockInteractionTimeRef.current = Date.now();

      const rawDeltaMinutes = deltaX / PX_PER_MINUTE;
      const snappedDelta = Math.round(rawDeltaMinutes / snapMinutes) * snapMinutes;

      if (currentDrag.mode === 'move') {
        const nextStart = Math.max(
          0,
          Math.min(
            1440 - currentDrag.initialDurationMinutes,
            currentDrag.initialStartMinute + snappedDelta
          )
        );

        let targetDayIndex = currentDrag.initialDayIndex;
        const elUnderPointer = document.elementFromPoint(e.clientX, e.clientY);
        const dayRowEl = elUnderPointer?.closest('[data-day-row-index]') as HTMLElement | null;
        if (dayRowEl && dayRowEl.dataset.dayRowIndex !== undefined) {
          const parsedDay = Number(dayRowEl.dataset.dayRowIndex);
          if (!Number.isNaN(parsedDay) && parsedDay >= 0 && parsedDay <= 6) {
            targetDayIndex = parsedDay;
          }
        }

        const adjusted = adjustNeighborsForBlockUpdate(
          currentDrag.initialSchedule,
          currentDrag.blockId,
          {
            dayIndex: targetDayIndex,
            startMinute: nextStart,
          },
          false
        );
        replaceSchedule(adjusted);
        setPreviewTimeMinutes(nextStart);
      } else if (currentDrag.mode === 'resize-right') {
        const maxDuration = 1440 - currentDrag.initialStartMinute;
        const nextDuration = Math.max(
          snapMinutes,
          Math.min(maxDuration, currentDrag.initialDurationMinutes + snappedDelta)
        );

        const adjusted = adjustNeighborsForBlockUpdate(
          currentDrag.initialSchedule,
          currentDrag.blockId,
          { durationMinutes: nextDuration },
          false
        );
        replaceSchedule(adjusted);
        setPreviewTimeMinutes(currentDrag.initialStartMinute + nextDuration);
      } else if (currentDrag.mode === 'resize-left') {
        const originalEnd =
          currentDrag.initialStartMinute + currentDrag.initialDurationMinutes;
        const maxStart = originalEnd - snapMinutes;
        const nextStart = Math.max(
          0,
          Math.min(maxStart, currentDrag.initialStartMinute + snappedDelta)
        );

        const nextDuration = originalEnd - nextStart;
        const adjusted = adjustNeighborsForBlockUpdate(
          currentDrag.initialSchedule,
          currentDrag.blockId,
          {
            startMinute: nextStart,
            durationMinutes: nextDuration,
          },
          false
        );
        replaceSchedule(adjusted);
        setPreviewTimeMinutes(nextStart);
      }
    };

    const handlePointerUp = () => {
      const currentDrag = dragStateRef.current;
      updateDragStateBoth(null);
      if (currentDrag && currentDrag.hasExceededThreshold) {
        lastBlockInteractionTimeRef.current = Date.now();
        settleBlockOverlaps(currentDrag.blockId);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, snapMinutes, replaceSchedule, setPreviewTimeMinutes, pushUndoSnapshot]);

  const computeSnappedMinuteFromEvent = (
    clientX: number,
    trackElement: HTMLElement,
    dayIndex: number
  ): number => {
    const rect = trackElement.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const rawMinute = offsetX / PX_PER_MINUTE;
    const maxStartMinute = 1440 - snapMinutes;
    let snappedStart = Math.max(
      0,
      Math.min(maxStartMinute, Math.floor(rawMinute / snapMinutes) * snapMinutes)
    );

    const dayBlocks = schedule.filter((b) => b.dayIndex === dayIndex);
    for (const existing of dayBlocks) {
      const eEnd = existing.startMinute + existing.durationMinutes;
      if (Math.abs(snappedStart - eEnd) <= 15 && eEnd <= maxStartMinute) {
        snappedStart = eEnd;
        break;
      }
    }
    return snappedStart;
  };

  const handleEmptySlotClick = (
    e: React.MouseEvent<HTMLDivElement>,
    dayIndex: number
  ) => {
    if ((e.target as HTMLElement).closest('[data-puzzle-block="true"]')) return;
    if (Date.now() - lastBlockInteractionTimeRef.current < 280) return;

    if (trackPointerDownRef.current) {
      const moveDist = Math.hypot(
        e.clientX - trackPointerDownRef.current.x,
        e.clientY - trackPointerDownRef.current.y
      );
      trackPointerDownRef.current = null;
      if (moveDist >= DRAG_THRESHOLD_PX) return;
    }

    if (!activeTemplate) {
      if (selectedBlockId) {
        setSelectedBlockId(null);
      }
      return;
    }

    const snappedStart = computeSnappedMinuteFromEvent(
      e.clientX,
      e.currentTarget,
      dayIndex
    );
    setPreviewTimeMinutes(snappedStart);

    const duration = Math.max(
      snapMinutes,
      Math.min(activeTemplate.defaultDurationMinutes || 60, 1440 - snappedStart)
    );
    addBlock({
      dayIndex,
      startMinute: snappedStart,
      durationMinutes: duration,
      activityId: activeTemplate.id,
      parentId: activeTemplate.parentId,
      name: activeTemplate.name,
      zhuyin: activeTemplate.zhuyin,
      english: activeTemplate.english,
      color: activeTemplate.color,
      iconName: activeTemplate.iconName,
    });
  };

  const handleDropOnDayRow = (
    e: React.DragEvent<HTMLDivElement>,
    dayIndex: number
  ) => {
    e.preventDefault();
    setHoverPreview(null);
    const rawData = e.dataTransfer.getData('application/kids-activity-template');
    if (!rawData) return;

    try {
      const tpl = JSON.parse(rawData);
      const snappedStart = computeSnappedMinuteFromEvent(
        e.clientX,
        e.currentTarget,
        dayIndex
      );
      const duration = Math.max(
        snapMinutes,
        Math.min(tpl.defaultDurationMinutes || 60, 1440 - snappedStart)
      );

      addBlock({
        dayIndex,
        startMinute: snappedStart,
        durationMinutes: duration,
        activityId: tpl.id,
        parentId: tpl.parentId,
        name: tpl.name,
        zhuyin: tpl.zhuyin,
        english: tpl.english,
        color: tpl.color,
        iconName: tpl.iconName,
      });
      setPreviewTimeMinutes(snappedStart);
    } catch {
      // ignore invalid payload
    }
  };

  const selectedBlock = selectedBlockId
    ? schedule.find((b) => b.id === selectedBlockId)
    : null;

  return (
    <div
      className="flex-1 min-w-0 bg-white border-2 border-amber-200/90 rounded-2xl shadow-sm flex flex-col overflow-hidden relative"
      onContextMenu={(e) => {
        if (activeTemplate) {
          e.preventDefault();
          onClearPaletteSelection();
          setHoverPreview(null);
          setCursorPos(null);
        }
      }}
    >
      {/* 滑鼠指標跟隨積木圖樣（當點選右側積木列表時，游標旁出現積木圖樣徽章） */}
      {activeTemplate && cursorPos && !dragState && (
        <div
          style={{
            left: `${cursorPos.x + 16}px`,
            top: `${cursorPos.y + 16}px`,
            backgroundColor: activeTemplate.color,
          }}
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-xl text-white shadow-xl border-2 border-white flex items-center gap-2 scale-95 transition-transform"
        >
          <div className="w-6 h-6 rounded-lg bg-white/95 flex items-center justify-center shrink-0">
            <CuteActivityIcon iconName={activeTemplate.iconName} size={18} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-black whitespace-nowrap">
              <RubyText
                text={activeTemplate.name}
                zhuyin={activeTemplate.zhuyin}
                rtClassName="text-white"
                nowrap
              />
            </span>
            <span className="text-[10px] font-bold text-white/90 mt-0.5">
              點擊時間軸放置 · 右鍵或 Esc 放棄
            </span>
          </div>
        </div>
      )}

      {/* 第一列工具橫條：回復上一步、重做、範本課表（在回復與重做右邊）、瀏覽與調整模式提示、以及個資與系統管理介面連結（在瀏覽與調整模式右方） */}
      <div className="px-3 py-2 bg-slate-50/95 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. 回復上一步 */}
          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={undoSchedule}
            className={`h-8 px-2.5 rounded-xl border font-black inline-flex items-center gap-1 transition ${
              undoStack.length > 0
                ? 'bg-white hover:bg-amber-50 border-amber-300 text-slate-800 shadow-2xs cursor-pointer'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="回復上一步 (快捷鍵 Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5 text-amber-600" />
            <span>回復上一步</span>
            {undoStack.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px]">
                {undoStack.length}
              </span>
            )}
          </button>

          {/* 2. 重做 */}
          <button
            type="button"
            disabled={redoStack.length === 0}
            onClick={redoSchedule}
            className={`h-8 px-2.5 rounded-xl border font-black inline-flex items-center gap-1 transition ${
              redoStack.length > 0
                ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-2xs cursor-pointer'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="重做下一步 (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span>重做</span>
          </button>

          {/* 3. 範本課表（移至回復上一步和重做的右邊） */}
          <button
            type="button"
            onClick={resetToStarterSchedule}
            className="h-8 px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:border-rose-300 text-slate-700 hover:text-rose-700 font-black inline-flex items-center gap-1 shadow-2xs transition cursor-pointer"
            title="還原為預設範本課表（含 22:00-07:00 晚間睡眠）"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>範本課表</span>
          </button>

          {/* 4. 瀏覽與調整模式說明 / 放棄積木點選 */}
          {activeTemplate ? (
            <div className="flex items-center gap-2 bg-amber-100/90 border-2 border-amber-400 px-2.5 py-1 rounded-xl">
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-white shadow-2xs"
                style={{ backgroundColor: activeTemplate.color }}
              />
              <span className="font-black text-amber-950">
                準備放置：{activeTemplate.name}（{activeTemplate.defaultDurationMinutes}分）
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearPaletteSelection();
                  setHoverPreview(null);
                  setCursorPos(null);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black inline-flex items-center gap-1 shadow-2xs transition cursor-pointer"
                title="快速放棄目前點選的積木 (亦可按 Esc 或滑鼠右鍵)"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>放棄積木點選</span>
              </button>
            </div>
          ) : (
            <span className="text-slate-600 font-bold inline-flex items-center gap-1">
              <MousePointerClick className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                瀏覽與調整模式（點選課表積木可移至其他天或調整時長；點選右側調色盤積木即可放置）
              </span>
            </span>
          )}

          {/* 5. 個資與系統管理介面連結（移至瀏覽與調整模式右方，僅顯示班級與個人資料；若為教師模式則顯示教師後台） */}
          <button
            type="button"
            onClick={onOpenManagementModal}
            className="h-8 px-3 rounded-xl border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-950 font-black inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            title="開啟個人資料與系統管理介面"
          >
            <Settings className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>
              {typeof window !== 'undefined' &&
              new URLSearchParams(window.location.search).get('mode') === 'teacher'
                ? `👩‍🏫 教師檢視：班級 ${roomId}（教師後台）`
                : `班級 ${roomId} · ${student.seatNumber}號 ${displayStudentName}`}
            </span>
          </button>
        </div>
      </div>

      {/* 第二列：時間軸上下與左右快速移動導覽列（解決電腦與平板上下／左右移動不便的問題） */}
      <div className="px-3 py-1.5 bg-amber-50/70 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-black text-amber-900 inline-flex items-center gap-1 mr-1">
            <Move className="w-3.5 h-3.5 text-amber-600" />
            快速移動時段：
          </span>

          <button
            type="button"
            onClick={() => scrollHorizontalByHours(-3)}
            className="h-7 px-2.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-slate-800 font-black inline-flex items-center gap-0.5 shadow-2xs transition cursor-pointer"
            title="向左捲動 3 小時"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-amber-700" />
            <span>左移 3時</span>
          </button>

          {QUICK_JUMP_HOURS.map((item) => (
            <button
              key={item.hour}
              type="button"
              onClick={() => scrollToHour(item.hour, 'smooth')}
              className="h-7 px-2.5 rounded-lg bg-white hover:bg-amber-500 hover:text-white border border-amber-200 text-slate-700 font-black transition cursor-pointer"
              title={`快速跳轉至 ${item.label}`}
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => scrollHorizontalByHours(3)}
            className="h-7 px-2.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-slate-800 font-black inline-flex items-center gap-0.5 shadow-2xs transition cursor-pointer"
            title="向右捲動 3 小時"
          >
            <span>右移 3時</span>
            <ChevronRight className="w-3.5 h-3.5 text-amber-700" />
          </button>
        </div>

        {/* 上下移動按鈕與滑動提示 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollVerticalByRows('up')}
            className="h-7 px-2.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-slate-800 font-black inline-flex items-center gap-0.5 shadow-2xs transition cursor-pointer"
            title="向上移動（查看週一～週三）"
          >
            <ChevronUp className="w-3.5 h-3.5 text-amber-700" />
            <span>上移</span>
          </button>
          <button
            type="button"
            onClick={() => scrollVerticalByRows('down')}
            className="h-7 px-2.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-slate-800 font-black inline-flex items-center gap-0.5 shadow-2xs transition cursor-pointer"
            title="向下移動（查看週五～週日）"
          >
            <ChevronDown className="w-3.5 h-3.5 text-amber-700" />
            <span>下移</span>
          </button>
          <span className="hidden xl:inline text-[11px] font-bold text-slate-500 ml-1">
            （提示：滾輪可直接左右捲動時間軸，按住空白處亦可直接拖動畫面）
          </span>
        </div>
      </div>

      {/* Selected Block Action Bar: 已放入作息表的積木可點選直接移到其他天 + 時間前後微調 + 時長調整 + 刪除 */}
      {selectedBlock && (
        <div className="px-3 py-2 bg-blue-50/95 border-b-2 border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-black text-slate-800 flex-wrap">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block shrink-0 border border-white shadow-2xs"
              style={{ backgroundColor: selectedBlock.color }}
            />
            <span>
              已選取課表積木：{DAYS_OF_WEEK[selectedBlock.dayIndex]?.short} (
              {formatMonthDay(weekMonday, selectedBlock.dayIndex)}) · {selectedBlock.name}（
              {formatHHMM(selectedBlock.startMinute)}–
              {formatHHMM(selectedBlock.startMinute + selectedBlock.durationMinutes)}，
              {selectedBlock.durationMinutes}分）
            </span>
          </div>

          {/* 直接移到其他天（一鍵點選週一～週日直接搬移） */}
          <div className="flex items-center gap-1 flex-wrap bg-white px-2.5 py-1 rounded-xl border border-blue-200 shadow-2xs">
            <span className="font-black text-blue-900 inline-flex items-center gap-1 mr-1">
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
              直接移到其他天：
            </span>
            {DAYS_OF_WEEK.map((d) => {
              const isCurrentDay = selectedBlock.dayIndex === d.index;
              return (
                <button
                  key={d.index}
                  type="button"
                  disabled={isCurrentDay}
                  onClick={() => moveBlockToDay(selectedBlock.id, d.index)}
                  className={`px-2 py-0.5 rounded-lg font-black transition ${
                    isCurrentDay
                      ? 'bg-blue-600 text-white cursor-default'
                      : 'bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700 cursor-pointer'
                  }`}
                  title={
                    isCurrentDay
                      ? `目前位於${d.short}`
                      : `將「${selectedBlock.name}」直接移到${d.short}`
                  }
                >
                  {d.short}
                </button>
              );
            })}
          </div>

          {/* 提早/延後時間 + 調整時長 + 刪除按鈕 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const nextStart = Math.max(0, selectedBlock.startMinute - snapMinutes);
                updateBlock(selectedBlock.id, { startMinute: nextStart }, true);
              }}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-black hover:bg-slate-100 cursor-pointer"
              title={`將開始時間提早 ${snapMinutes} 分鐘`}
            >
              ◀ 提早{snapMinutes}分
            </button>
            <button
              type="button"
              onClick={() => {
                const nextStart = Math.min(
                  1440 - selectedBlock.durationMinutes,
                  selectedBlock.startMinute + snapMinutes
                );
                updateBlock(selectedBlock.id, { startMinute: nextStart }, true);
              }}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-black hover:bg-slate-100 cursor-pointer"
              title={`將開始時間延後 ${snapMinutes} 分鐘`}
            >
              延後{snapMinutes}分 ▶
            </button>
            <button
              type="button"
              onClick={() => {
                const nextDur = Math.max(
                  snapMinutes,
                  selectedBlock.durationMinutes - snapMinutes
                );
                updateBlock(selectedBlock.id, { durationMinutes: nextDur }, true);
              }}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-black hover:bg-slate-100 cursor-pointer"
            >
              時長-{snapMinutes}分
            </button>
            <button
              type="button"
              onClick={() => {
                const nextDur = Math.min(
                  1440 - selectedBlock.startMinute,
                  selectedBlock.durationMinutes + snapMinutes
                );
                updateBlock(selectedBlock.id, { durationMinutes: nextDur }, true);
              }}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-black hover:bg-slate-100 cursor-pointer"
            >
              時長+{snapMinutes}分
            </button>
            <button
              type="button"
              onClick={() => removeBlock(selectedBlock.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              刪除積木
            </button>
            <button
              type="button"
              onClick={() => setSelectedBlockId(null)}
              className="px-2 py-1 text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
              title="取消選取此積木"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2D Bi-directional Smooth Scroll Container (Sticky Top Time Axis + Sticky Left Day Axis) */}
      <div
        ref={scrollContainerRef}
        onMouseLeave={() => {
          setHoverPreview(null);
          setCursorPos(null);
        }}
        onWheel={(e) => {
          const container = scrollContainerRef.current;
          if (!container) return;
          // 若游標在左側星期欄上，保持原生上下捲動
          if ((e.target as HTMLElement).closest('[data-day-left-header="true"]')) {
            return;
          }
          // 若在 24H 時間軸軌道區轉動垂直滾輪，且目前並非按住 Ctrl 縮放，直接轉換為平滑左右捲動時間軸！
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.ctrlKey) {
            e.preventDefault();
            container.scrollLeft += e.deltaY * 1.15;
          }
        }}
        onPointerMove={(e) => {
          if (activeTemplate && e.pointerType === 'mouse' && !dragState) {
            setCursorPos({ x: e.clientX, y: e.clientY });
          } else if (e.pointerType !== 'mouse' && cursorPos) {
            setCursorPos(null);
          }
        }}
        className="planner-scroll-container flex-1 overflow-auto relative select-none"
      >
        <div
          className="relative"
          style={{
            width: `${TOTAL_WIDTH_PX + DAY_COL_WIDTH_PX}px`,
          }}
        >
          {/* Sticky Top Header Row (Corner + 00:00..24:00 Time Axis) */}
          <div className="sticky top-0 z-30 flex bg-slate-50/95 backdrop-blur-xs border-b-2 border-amber-200 h-11">
            {/* Top-Left Frozen Corner */}
            <div
              data-day-left-header="true"
              style={{ width: `${DAY_COL_WIDTH_PX}px` }}
              className="sticky left-0 z-40 shrink-0 bg-amber-100 border-r-2 border-amber-200 flex flex-col items-center justify-center text-xs font-black text-amber-900 shadow-2xs"
            >
              <span>日期 \ 時間</span>
              <span className="text-[10px] font-bold text-amber-700">00:00 - 24:00</span>
            </div>

            {/* 24 Hours Header Cells */}
            <div className="relative flex-1 flex">
              {Array.from({ length: TOTAL_HOURS }).map((_, hour) => {
                const isFocusHour = hour >= focusStartHour && hour < focusEndHour;
                return (
                  <div
                    key={hour}
                    style={{ width: `${HOUR_WIDTH_PX}px` }}
                    className={`shrink-0 border-r border-slate-200/90 px-2 flex flex-col justify-between py-1 transition-colors ${
                      isFocusHour ? 'bg-amber-50/85' : 'bg-indigo-50/55'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black tabular-nums ${
                          isFocusHour ? 'text-slate-800' : 'text-indigo-700'
                        }`}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </span>
                      {hour === focusStartHour && (
                        <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1 rounded">
                          聚焦起
                        </span>
                      )}
                      {hour === focusEndHour - 1 && (
                        <span className="text-[9px] font-bold bg-blue-200 text-blue-900 px-1 rounded">
                          聚焦末
                        </span>
                      )}
                      {!isFocusHour && (
                        <span className="text-[9px] font-bold text-indigo-400">可排課</span>
                      )}
                    </div>

                    {/* 15/30/45 min tick marks */}
                    <div className="flex items-end justify-between w-full h-2">
                      <span className="w-[1px] h-2 bg-slate-300" />
                      <span className="w-[1px] h-1 bg-slate-200" />
                      <span className="w-[1px] h-1.5 bg-slate-300" />
                      <span className="w-[1px] h-1 bg-slate-200" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7 Days Rows (Monday ~ Sunday with Date MM/DD) */}
          {DAYS_OF_WEEK.map((day) => {
            const dayBlocks = schedule
              .filter((b) => b.dayIndex === day.index)
              .sort((a, b) => a.startMinute - b.startMinute);
            const isWeekend = day.index >= 5;
            const dateStr = formatMonthDay(weekMonday, day.index);
            const canMoveSelectedHere =
              Boolean(selectedBlock) && selectedBlock!.dayIndex !== day.index;

            return (
              <div
                key={day.index}
                data-day-row-index={day.index}
                className="flex border-b border-slate-200/90 h-[84px] relative"
              >
                {/* Sticky Left Day Column with Date */}
                <div
                  data-day-left-header="true"
                  style={{ width: `${DAY_COL_WIDTH_PX}px` }}
                  onClick={() => {
                    if (selectedBlock && selectedBlock.dayIndex !== day.index) {
                      moveBlockToDay(selectedBlock.id, day.index);
                    }
                  }}
                  title={
                    canMoveSelectedHere
                      ? `點擊將「${selectedBlock?.name}」直接移到${day.short}`
                      : `${day.full} (${dateStr})`
                  }
                  className={`sticky left-0 z-20 shrink-0 border-r-2 border-amber-200 px-2 flex flex-col items-center justify-center shadow-2xs transition ${
                    canMoveSelectedHere
                      ? 'bg-blue-50/90 hover:bg-blue-100 cursor-pointer ring-1 ring-inset ring-blue-300'
                      : isWeekend
                        ? 'bg-rose-50'
                        : 'bg-white'
                  }`}
                >
                  <div className="text-sm font-black text-slate-800">
                    <RubyText text={day.short} zhuyin={day.zhuyin} nowrap />
                  </div>
                  <span
                    className={`text-[11px] font-black tabular-nums ${
                      isWeekend ? 'text-rose-600' : 'text-amber-700'
                    }`}
                  >
                    {dateStr}
                  </span>
                  {canMoveSelectedHere && (
                    <span className="mt-0.5 px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] font-black">
                      移至此日
                    </span>
                  )}
                </div>

                {/* Day Timeline Track — Full 00:00..24:00 Interactive */}
                <div
                  data-day-row-index={day.index}
                  onPointerDown={(e) => {
                    trackPointerDownRef.current = { x: e.clientX, y: e.clientY };
                    // 在「瀏覽與調整模式」且點在空白軌道時，允許滑鼠直接按住拖曳平移畫布 (Grab-to-Pan)
                    if (
                      !activeTemplate &&
                      e.pointerType === 'mouse' &&
                      e.button === 0 &&
                      !(e.target as HTMLElement).closest('[data-puzzle-block="true"]') &&
                      scrollContainerRef.current
                    ) {
                      panStateRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        initialScrollLeft: scrollContainerRef.current.scrollLeft,
                        initialScrollTop: scrollContainerRef.current.scrollTop,
                        initialWindowScrollY: window.scrollY,
                        isPanning: false,
                      };
                      setIsGrabPanning(true);
                    }
                  }}
                  onClick={(e) => handleEmptySlotClick(e, day.index)}
                  onMouseMove={(e) => {
                    if (dragState || !activeTemplate) {
                      if (hoverPreview) setHoverPreview(null);
                      return;
                    }
                    if ((e.target as HTMLElement).closest('[data-puzzle-block="true"]')) {
                      if (hoverPreview) setHoverPreview(null);
                      return;
                    }
                    const snapped = computeSnappedMinuteFromEvent(
                      e.clientX,
                      e.currentTarget,
                      day.index
                    );
                    setHoverPreview({ dayIndex: day.index, startMinute: snapped });
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const snapped = computeSnappedMinuteFromEvent(
                      e.clientX,
                      e.currentTarget,
                      day.index
                    );
                    setHoverPreview({ dayIndex: day.index, startMinute: snapped });
                  }}
                  onDrop={(e) => handleDropOnDayRow(e, day.index)}
                  className={`relative flex-1 h-full overflow-hidden ${
                    activeTemplate
                      ? 'cursor-copy'
                      : isGrabPanning
                        ? 'cursor-grabbing'
                        : 'cursor-grab'
                  }`}
                  style={{ width: `${TOTAL_WIDTH_PX}px` }}
                >
                  {/* Background Hour & Half-Hour Grid Lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: TOTAL_HOURS }).map((_, hour) => {
                      const isFocusHour = hour >= focusStartHour && hour < focusEndHour;
                      return (
                        <div
                          key={hour}
                          style={{ width: `${HOUR_WIDTH_PX}px` }}
                          className={`h-full border-r border-slate-200/80 flex ${
                            isFocusHour
                              ? isWeekend
                                ? 'bg-rose-50/15'
                                : 'bg-white'
                              : 'bg-indigo-50/25'
                          }`}
                        >
                          <div className="w-1/2 h-full border-r border-dashed border-slate-100" />
                          <div className="w-1/2 h-full" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Ghost Preview when Hovering / Dragging over Empty Track */}
                  {hoverPreview &&
                    hoverPreview.dayIndex === day.index &&
                    activeTemplate &&
                    !dragState && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          bottom: '8px',
                          left: `${hoverPreview.startMinute * PX_PER_MINUTE}px`,
                          width: `${
                            Math.min(
                              activeTemplate.defaultDurationMinutes || 60,
                              1440 - hoverPreview.startMinute
                            ) * PX_PER_MINUTE
                          }px`,
                          borderColor: activeTemplate.color,
                          backgroundColor: `${activeTemplate.color}26`,
                        }}
                        className="border-2 border-dashed rounded-xl pointer-events-none z-5 flex items-center justify-center px-2 overflow-hidden"
                      >
                        <span
                          className="text-[11px] font-black truncate"
                          style={{ color: activeTemplate.color }}
                        >
                          + {activeTemplate.name} ({formatHHMM(hoverPreview.startMinute)})
                        </span>
                      </div>
                    )}

                  {/* Scheduled Puzzle Blocks for this Day */}
                  {dayBlocks.map((block) => {
                    const blockEnd = block.startMinute + block.durationMinutes;
                    const isConnectedLeft = dayBlocks.some(
                      (other) =>
                        other.id !== block.id &&
                        other.startMinute + other.durationMinutes === block.startMinute
                    );
                    const isConnectedRight = dayBlocks.some(
                      (other) =>
                        other.id !== block.id && other.startMinute === blockEnd
                    );

                    return (
                      <PuzzleBlockItem
                        key={block.id}
                        block={block}
                        isSelected={selectedBlockId === block.id}
                        isDragging={
                          dragState?.blockId === block.id && dragState.hasExceededThreshold
                        }
                        isConnectedLeft={isConnectedLeft}
                        isConnectedRight={isConnectedRight}
                        onSelect={() => {
                          setSelectedBlockId(block.id);
                          setPreviewTimeMinutes(block.startMinute);
                        }}
                        onStartInteraction={(mode, clientX, clientY) => {
                          lastBlockInteractionTimeRef.current = Date.now();
                          setSelectedBlockId(block.id);
                          setPreviewTimeMinutes(block.startMinute);
                          updateDragStateBoth({
                            blockId: block.id,
                            mode,
                            startX: clientX,
                            startY: clientY,
                            hasExceededThreshold: false,
                            initialDayIndex: block.dayIndex,
                            initialStartMinute: block.startMinute,
                            initialDurationMinutes: block.durationMinutes,
                            initialSchedule: schedule.map((b) => ({ ...b })),
                          });
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface PuzzleBlockItemProps {
  block: ScheduleBlock;
  isSelected: boolean;
  isDragging: boolean;
  isConnectedLeft: boolean;
  isConnectedRight: boolean;
  onSelect: () => void;
  onStartInteraction: (
    mode: 'move' | 'resize-left' | 'resize-right',
    clientX: number,
    clientY: number
  ) => void;
}

const PuzzleBlockItem: React.FC<PuzzleBlockItemProps> = ({
  block,
  isSelected,
  isDragging,
  isConnectedLeft,
  isConnectedRight,
  onSelect,
  onStartInteraction,
}) => {
  const leftPx = block.startMinute * PX_PER_MINUTE;
  const widthPx = Math.max(28, block.durationMinutes * PX_PER_MINUTE);
  const showIcon = widthPx >= 115;
  const showSubtitle = widthPx >= 90;

  return (
    <div
      data-puzzle-block="true"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={(e) => {
        // 在平板觸控 (touch) 模式下，點按積木本體中間保留給瀏覽器原生上下／左右捲動畫面，避免手指滑過睡眠或上課積木時卡住無法捲動！
        if (e.pointerType === 'touch') {
          onSelect();
          return;
        }
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        if ((e.target as HTMLElement).dataset.resizeHandle) return;
        e.stopPropagation();
        onStartInteraction('move', e.clientX, e.clientY);
      }}
      style={{
        position: 'absolute',
        top: '6px',
        bottom: '6px',
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        backgroundColor: block.color,
        touchAction: 'pan-x pan-y',
      }}
      className={`timeline-puzzle-block text-white flex items-center justify-between select-none cursor-grab active:cursor-grabbing ${
        isConnectedLeft ? 'is-connected-left' : ''
      } ${isConnectedRight ? 'is-connected-right' : ''} ${
        isSelected
          ? 'ring-2 ring-amber-300 ring-offset-1 z-20 brightness-105'
          : 'z-10 hover:brightness-105'
      } ${isDragging ? 'opacity-95 shadow-xl z-30 scale-[1.01]' : ''}`}
    >
      {/* Left Resize Handle (Requires 8px deliberate drag threshold) */}
      <div
        data-resize-handle="left"
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          e.stopPropagation();
          onStartInteraction('resize-left', e.clientX, e.clientY);
        }}
        title="按住左右拖曳調整開始時間"
        className="w-3 sm:w-3.5 h-full flex items-center justify-center cursor-ew-resize bg-black/15 hover:bg-black/35 rounded-l-[9px] shrink-0 touch-none"
      >
        <GripVertical className="w-2.5 h-2.5 text-white/85 pointer-events-none" />
      </div>

      {/* Center Content: Strictly Single-Line Chinese + Vertical Zhuyin + Time Range */}
      <div className="flex-1 min-w-0 px-1.5 py-0.5 flex items-center gap-1.5 overflow-hidden pointer-events-none">
        {showIcon && (
          <div className="w-7 h-7 rounded-lg bg-white/95 flex items-center justify-center shrink-0 shadow-2xs">
            <CuteActivityIcon iconName={block.iconName} size={20} />
          </div>
        )}

        <div className="min-w-0 flex-1 flex flex-col justify-center overflow-hidden">
          <div className="font-black text-xs sm:text-sm text-white whitespace-nowrap overflow-hidden text-ellipsis leading-none">
            <RubyText
              text={block.name}
              zhuyin={block.zhuyin}
              rtClassName="text-white/95"
              nowrap
            />
          </div>
          {showSubtitle && (
            <div className="text-[10px] font-bold text-white/90 whitespace-nowrap truncate mt-1 flex items-center gap-1">
              <span>
                {formatHHMM(block.startMinute)}–
                {formatHHMM(block.startMinute + block.durationMinutes)}
              </span>
              {(isConnectedLeft || isConnectedRight) && (
                <Link2 className="w-2.5 h-2.5 text-amber-200 shrink-0 inline" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Resize Handle (Requires 8px deliberate drag threshold) */}
      <div
        data-resize-handle="right"
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          e.stopPropagation();
          onStartInteraction('resize-right', e.clientX, e.clientY);
        }}
        title="按住左右拖曳調整結束時間與時長"
        className="w-3 sm:w-3.5 h-full flex items-center justify-center cursor-ew-resize bg-black/15 hover:bg-black/35 rounded-r-[9px] shrink-0 touch-none"
      >
        <GripVertical className="w-2.5 h-2.5 text-white/85 pointer-events-none" />
      </div>
    </div>
  );
};
