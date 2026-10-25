import React, { useState } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  ParsedCalendarEvent,
  parseIcsContent,
  fetchGoogleCalendarEvents,
  generateSampleIcsText,
  convertParsedEventToBlock,
} from '../utils/calendarImporter';
import { PARENT_CATEGORIES, DAYS_OF_WEEK } from '../data/categories';
import { ParentCategoryId } from '../types/schedule';
import {
  Calendar,
  Upload,
  Sparkles,
  Check,
  X,
  FileText,
  Globe,
  BookOpen,
  Download,
  ExternalLink,
  CheckCircle2,
  Layers,
} from 'lucide-react';

interface CalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KEYWORD_GUIDE_ROWS = [
  {
    categoryId: 'study',
    keywords: '讀書、功課、作業、英文、英語、數學、閱讀、複習、補習、溫習、study、homework、read、english、math',
    example: '週一 16:00 英文會話練習 → 歸入【讀書學習】',
  },
  {
    categoryId: 'school',
    keywords: '學校、上課、社團、班會、早自習、課後、school、class、club',
    example: '週三 13:30 課後社團 → 歸入【學校課程】',
  },
  {
    categoryId: 'sports',
    keywords: '運動、球、游泳、跑步、跳繩、體能、單車、直排輪、體操、sport、swim、run、gym、soccer',
    example: '週三 16:00 足球體能訓練 → 歸入【運動體能】',
  },
  {
    categoryId: 'creative',
    keywords: '琴、音樂、畫、美術、手作、舞蹈、書法、圍棋、創作、才藝、music、piano、art、draw、dance',
    example: '週五 19:00 烏克麗麗音樂課 → 歸入【才藝創作】',
  },
  {
    categoryId: 'daily',
    keywords: '餐、飯、洗澡、盥洗、家事、整理、刷牙、早餐、午餐、晚餐、meal、lunch、dinner、chore、bath',
    example: '每日 18:30 營養晚餐 → 歸入【生活日常】',
  },
  {
    categoryId: 'leisure',
    keywords: '遊戲、玩、電視、卡通、親子、公園、散步、電影、play、game、movie、park、family',
    example: '週六 16:00 家庭桌遊時光 → 歸入【休閒娛樂】',
  },
  {
    categoryId: 'sleep',
    keywords: '睡、眠、午休、休息、小憩、sleep、nap、rest、bed',
    example: '每日 22:00 晚間睡眠 → 歸入【休息睡眠】',
  },
  {
    categoryId: 'other',
    keywords: '未命中上方關鍵字之其他行程（匯入預覽表可手動下拉微調）',
    example: '週日 15:00 小隊集合 → 預設歸入【其他活動】',
  },
];

export const CalendarImportModal: React.FC<CalendarImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { importBlocksAcrossWeeks } = usePlannerStore();

  const [modalView, setModalView] = useState<'import' | 'tutorial'>('import');
  const [parsedEvents, setParsedEvents] = useState<ParsedCalendarEvent[]>([]);
  const [skippedPastNotice, setSkippedPastNotice] = useState<string | null>(null);
  const [conflictMode, setConflictMode] = useState<'fill-empty' | 'overwrite'>('fill-empty');
  const [oauthToken, setOauthToken] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setErrorMsg(null);
    setSkippedPastNotice(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { validEvents, skippedPastCount } = parseIcsContent(text);
        if (skippedPastCount > 0) {
          setSkippedPastNotice(
            `已自動略過 ${skippedPastCount} 筆前一週以前的過去行程（僅允許排入本週與未來週次）`
          );
        }
        if (validEvents.length === 0) {
          setErrorMsg('在此 .ics 檔案中沒有找到本週或未來的有效行程');
        } else {
          setParsedEvents(validEvents);
          setModalView('import');
        }
      } catch {
        setErrorMsg('解析 .ics 檔案失敗，請確認格式正確');
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleIcs = () => {
    setErrorMsg(null);
    setSkippedPastNotice(null);
    const sample = generateSampleIcsText();
    const { validEvents } = parseIcsContent(sample);
    setParsedEvents(validEvents);
    setModalView('import');
  };

  const handleDownloadSampleIcs = () => {
    const icsContent = generateSampleIcsText();
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kids-sample-schedule.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFetchGoogleOAuth = async () => {
    if (!oauthToken.trim()) {
      setErrorMsg('請貼上 Google Calendar OAuth 2.0 Access Token，或使用下方 .ics 檔案匯入');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSkippedPastNotice(null);
    try {
      const events = await fetchGoogleCalendarEvents(oauthToken.trim());
      setParsedEvents(events);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Calendar API 讀取失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (id: string, newCategory: ParentCategoryId) => {
    setParsedEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, suggestedCategory: newCategory } : ev))
    );
  };

  const handleApplyImport = () => {
    if (parsedEvents.length === 0) return;

    const items = parsedEvents.map((ev) => ({
      weekOffset: ev.weekOffset,
      block: convertParsedEventToBlock(ev),
    }));

    importBlocksAcrossWeeks(items, conflictMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-amber-300 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with Inner View Switcher (匯入操作 / 詳細教學) */}
        <div className="px-6 py-3.5 bg-blue-50 border-b border-blue-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Google 行事曆 &amp; .ics 智慧匯入模組
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Inner Tab Switcher inside Modal */}
            <div className="inline-flex items-center bg-white border border-blue-200 rounded-xl p-0.5 text-xs font-black">
              <button
                type="button"
                onClick={() => setModalView('import')}
                className={`px-3 py-1 rounded-lg transition inline-flex items-center gap-1 ${
                  modalView === 'import'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                匯入操作
              </button>
              <button
                type="button"
                onClick={() => setModalView('tutorial')}
                className={`px-3 py-1 rounded-lg transition inline-flex items-center gap-1 ${
                  modalView === 'tutorial'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                詳細教學說明
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Either 'import' or 'tutorial' */}
        {modalView === 'import' ? (
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Source 1: .ics Drag & Drop + Sample Loader */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="border-2 border-dashed border-blue-300 bg-blue-50/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800">
                    拖入 `.ics` 行事曆檔案或點擊上傳
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    支援排入當週與預排未來週次活動（自動過濾前週以前的過去活動）
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-xs">
                  選擇 .ics 檔案
                  <input
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadSampleIcs}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-black px-3 py-2 rounded-xl inline-flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  載入範例 .ics 測試
                </button>
              </div>
            </div>

            {/* Source 2: Google OAuth 2.0 Calendar API v3 */}
            <div className="rounded-2xl border border-slate-200 p-3.5 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>Google OAuth 2.0 (Calendar API v3 `events.list`) 讀取本週與未來行程</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalView('tutorial')}
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  如何匯出 .ics 或取得 Token？點看詳細教學 ▶
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="輸入 Google OAuth 2.0 Access Token (ya29....)"
                  value={oauthToken}
                  onChange={(e) => setOauthToken(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFetchGoogleOAuth}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shrink-0"
                >
                  {loading ? '拉取中...' : '拉取行程'}
                </button>
              </div>
            </div>

            {skippedPastNotice && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                ℹ️ {skippedPastNotice}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Parsed Events Preview & Smart Category Mapping Table */}
            {parsedEvents.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>智慧預判關鍵字對照表（共解析出 {parsedEvents.length} 筆當週/未來行程）</span>
                  </div>

                  {/* Conflict Resolution Mode */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setConflictMode('fill-empty')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        conflictMode === 'fill-empty'
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      僅填補空白
                    </button>
                    <button
                      type="button"
                      onClick={() => setConflictMode('overwrite')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        conflictMode === 'overwrite'
                          ? 'bg-white text-rose-600 shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      覆蓋原排程
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-black">
                      <tr>
                        <th className="py-2 px-3">行程名稱</th>
                        <th className="py-2 px-3">週次 / 日期 / 時段</th>
                        <th className="py-2 px-3">智慧歸納母類別 (可微調)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {parsedEvents.map((ev) => {
                        const dayLabel = DAYS_OF_WEEK[ev.dayIndex]?.short || '週一';
                        const weekBadge =
                          ev.weekOffset === 0 ? '本週' : `未來 +${ev.weekOffset}週`;
                        const startH = String(Math.floor(ev.startMinute / 60)).padStart(2, '0');
                        const startM = String(ev.startMinute % 60).padStart(2, '0');
                        const endMin = ev.startMinute + ev.durationMinutes;
                        const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
                        const endM = String(endMin % 60).padStart(2, '0');

                        return (
                          <tr key={ev.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-900">{ev.title}</td>
                            <td className="py-2 px-3 text-slate-600 tabular-nums">
                              <span
                                className={`inline-block mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-black ${
                                  ev.weekOffset === 0
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {weekBadge}
                              </span>
                              {ev.dateLabel} ({dayLabel}) {startH}:{startM} - {endH}:{endM}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={ev.suggestedCategory}
                                onChange={(e) =>
                                  handleCategoryChange(ev.id, e.target.value as ParentCategoryId)
                                }
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-black text-slate-800"
                              >
                                {PARENT_CATEGORIES.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name} ({cat.english})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={parsedEvents.length === 0}
                onClick={handleApplyImport}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-black shadow-sm inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                確認匯入至拼圖作息表 ({conflictMode === 'fill-empty' ? '僅填補空白' : '覆蓋原排程'})
              </button>
            </div>
          </div>
        ) : (
          /* Built-in Detailed Tutorial View inside Modal */
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black">
                  📖 三步驟把 Google 日曆或 Apple 行事曆變成彩色拼圖課表
                </h3>
                <p className="text-blue-100 font-bold mt-0.5">
                  內建 ical.js 解析與 Google Calendar API v3，支援排當週與預排未來週次活動
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSampleIcs}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3 py-1.5 rounded-xl inline-flex items-center gap-1 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  下載範例 .ics
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleIcs}
                  className="bg-white hover:bg-blue-50 text-blue-700 font-black px-3 py-1.5 rounded-xl inline-flex items-center gap-1 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  直接載入範例試玩
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Method 1 */}
              <div className="border border-blue-200 rounded-2xl p-3.5 bg-blue-50/30 space-y-2">
                <div className="font-black text-blue-900 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  方式一：匯出 `.ics` 檔案並拖入（最推薦）
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-700 font-bold leading-relaxed">
                  <li>
                    開啟電腦版{' '}
                    <a
                      href="https://calendar.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline inline-flex items-center gap-0.5"
                    >
                      Google 日曆 <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    → 點擊右上角「⚙️ 設定」齒輪 →「設定」。
                  </li>
                  <li>
                    左側點選「<strong>匯入及匯出</strong>」→ 點擊「<strong>匯出</strong>」下載{' '}
                    <code>.zip</code> 檔，解壓縮即可取得 <code>.ics</code> 行事曆檔。
                  </li>
                  <li>
                    切回「匯入操作」分頁，將 <code>.ics</code> 拖入藍色虛線框即可預覽並匯入當週與未來週次！
                  </li>
                </ol>
              </div>

              {/* Method 2 */}
              <div className="border border-indigo-200 rounded-2xl p-3.5 bg-indigo-50/30 space-y-2">
                <div className="font-black text-indigo-900 text-sm flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  方式二：Google OAuth 2.0 Token 直連拉取
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-700 font-bold leading-relaxed">
                  <li>
                    前往{' '}
                    <a
                      href="https://developers.google.com/oauthplayground/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 underline inline-flex items-center gap-0.5"
                    >
                      OAuth 2.0 Playground <ExternalLink className="w-3 h-3" />
                    </a>
                    ，展開 <strong>Google Calendar API v3</strong> 並勾選唯讀範圍{' '}
                    <code>.../auth/calendar.readonly</code>。
                  </li>
                  <li>
                    點擊 <strong>Authorize APIs</strong> 登入授權，再於 Step 2 點擊{' '}
                    <strong>Exchange authorization code for tokens</strong>。
                  </li>
                  <li>
                    複製 <code>ya29.</code> 開頭的 <code>Access token</code> 貼回匯入框即可拉取行程！
                  </li>
                </ol>
              </div>
            </div>

            {/* Keyword Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-amber-50 px-3.5 py-2 border-b border-amber-200 font-black text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>8 大母類別智慧關鍵字自動對照表</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-3 w-28">母類別</th>
                    <th className="py-1.5 px-3">觸發關鍵字（中 / 英）</th>
                    <th className="py-1.5 px-3 w-52">自動轉換範例</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {KEYWORD_GUIDE_ROWS.map((row) => {
                    const cat =
                      PARENT_CATEGORIES.find((c) => c.id === row.categoryId) ||
                      PARENT_CATEGORIES[7];
                    return (
                      <tr key={row.categoryId}>
                        <td className="py-1.5 px-3">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-white text-[11px] font-black"
                            style={{ backgroundColor: cat.color }}
                          >
                            {cat.name}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">{row.keywords}</td>
                        <td className="py-1.5 px-3 text-slate-500">{row.example}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Conflict Modes Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-blue-950">僅填補空白（預設安全模式）</div>
                  <div className="text-blue-800 font-bold mt-0.5">
                    保留原本已排好的拼圖積木，只將不衝突的空白時段填上新行程。
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex items-start gap-2">
                <Layers className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-rose-950">覆蓋原排程（以匯入為主）</div>
                  <div className="text-rose-800 font-bold mt-0.5">
                    自動裁切或替換重疊時段的舊積木，完整放入新匯入的日曆行程。
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setModalView('import')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs"
              >
                返回匯入操作畫面
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
