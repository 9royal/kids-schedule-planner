import React, { useState, useEffect, useRef } from 'react';
import {
  usePlannerStore,
  SAMPLE_NAMES,
  SAMPLE_NICKNAMES,
} from '../store/usePlannerStore';
import {
  formatLeaderboardDisplayName,
  maskMiddleNameWithCircle,
  PARENT_CATEGORIES,
  DEFAULT_ACTIVITY_TEMPLATES,
} from '../data/categories';
import { NameDisplayPreference } from '../types/schedule';
import { compressAvatarImage, generateDefaultAvatar } from '../utils/avatarCompressor';
import {
  RubyText,
  fetchZhuyinFromMoedictApi,
  fetchEnglishFromTranslationApi,
} from '../utils/zhuyin';
import {
  Check,
  X,
  ShieldCheck,
  Settings,
  UserCheck,
  Puzzle,
  Camera,
  Trash2,
  RotateCcw,
  Sparkles,
  Globe,
  Lock,
} from 'lucide-react';

interface RoomSeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'templates';
  isFirstTimeOnboarding?: boolean;
  onOpenTeacherAdmin?: () => void;
}

export const RoomSeatModal: React.FC<RoomSeatModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile',
  isFirstTimeOnboarding = false,
  onOpenTeacherAdmin,
}) => {
  const {
    roomId,
    student,
    setRoomAndStudent,
    updateStudentProfile,
    focusStartHour,
    focusEndHour,
    setFocusHours,
    snapMinutes,
    setSnapMinutes,
    templates,
    removeTemplate,
    restoreDefaultTemplates,
    maxSeatCount,
    leaderboardMap,
    allClassroomsMap,
  } = usePlannerStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'templates'>(initialTab);
  const [inputRoom, setInputRoom] = useState(roomId);
  const [selectedSeat, setSelectedSeat] = useState(student.seatNumber);
  const [inputName, setInputName] = useState(student.name);
  const [inputNickname, setInputNickname] = useState(student.nickname || '');
  const [displayPref, setDisplayPref] = useState<NameDisplayPreference>(
    student.displayPreference || 'nickname'
  );
  const [avatarPreview, setAvatarPreview] = useState(student.avatarUrl);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [localFocusStart, setLocalFocusStart] = useState(focusStartHour);
  const [localFocusEnd, setLocalFocusEnd] = useState(focusEndHour);
  const [localSnap, setLocalSnap] = useState<15 | 30>(snapMinutes);

  // 檢查是否由「學生專屬連結 (?role=student)」進入：若是，鎖定班級欄位且完全不顯示教師後台入口
  const isStrictStudentLink =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('role') === 'student';

  // API 測試工具狀態（分頁 2）
  const [testPhrase, setTestPhrase] = useState('烏克麗麗社團');
  const [testZhuyin, setTestZhuyin] = useState('');
  const [testEnglish, setTestEnglish] = useState('');
  const [isTestingApi, setIsTestingApi] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(isFirstTimeOnboarding ? 'profile' : initialTab);
      setInputRoom(roomId);
      setSelectedSeat(student.seatNumber);
      setInputName(student.name);
      setInputNickname(student.nickname || '');
      setDisplayPref(student.displayPreference || 'nickname');
      setAvatarPreview(student.avatarUrl);
      setLocalFocusStart(focusStartHour);
      setLocalFocusEnd(focusEndHour);
      setLocalSnap(snapMinutes);
    }
  }, [
    isOpen,
    roomId,
    student,
    focusStartHour,
    focusEndHour,
    snapMinutes,
    initialTab,
    isFirstTimeOnboarding,
  ]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, byteSize } = await compressAvatarImage(file);
      setAvatarPreview(dataUrl);
      const kb = (byteSize / 1024).toFixed(1);
      setAvatarMsg(`已裁切 128×128 並壓縮至 ${kb} KB`);
    } catch (err: any) {
      setAvatarMsg(err?.message || '頭像處理失敗');
    }
  };

  const handleSelectSeat = (seat: number) => {
    setSelectedSeat(seat);
    const cleanTargetRoom = inputRoom.trim() || roomId;
    const targetLb =
      cleanTargetRoom === roomId
        ? leaderboardMap
        : allClassroomsMap[cleanTargetRoom]?.leaderboardMap || {};
    const existing = targetLb[seat];

    // 若點選的座號已經有真實學生登錄，直接載入該座號原本的姓名／暱稱／頭像，防止拿舊座號的名字覆蓋別人！
    if (existing && !existing.isSimulated) {
      setInputName(existing.name);
      setInputNickname(existing.nickname || '');
      setDisplayPref(existing.displayPreference || 'nickname');
      setAvatarPreview(existing.avatarUrl);
      return;
    }

    // 若目前欄位仍是系統預設範例姓名（使用者尚未手打自己的真實姓名），切換座號時同步更新為該座號對應的預設頭像與範例名
    const isUsingDefaultSampleName =
      !inputName.trim() || SAMPLE_NAMES.includes(inputName.trim());
    if (isUsingDefaultSampleName) {
      const nextDefaultName =
        SAMPLE_NAMES[(seat - 1) % SAMPLE_NAMES.length] || `${seat}號同學`;
      const nextDefaultNick =
        SAMPLE_NICKNAMES[seat] || `${nextDefaultName.slice(-2)}`;
      setInputName(nextDefaultName);
      setInputNickname(nextDefaultNick);
      setAvatarPreview(generateDefaultAvatar(seat, nextDefaultName));
    } else if (avatarPreview.startsWith('data:image/svg+xml')) {
      setAvatarPreview(generateDefaultAvatar(seat, inputName.trim()));
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setFocusHours(localFocusStart, Math.max(localFocusStart + 1, localFocusEnd));
    setSnapMinutes(localSnap);
    setRoomAndStudent(inputRoom, selectedSeat, inputName, inputNickname, displayPref);
    if (avatarPreview && avatarPreview !== student.avatarUrl) {
      updateStudentProfile({ avatarUrl: avatarPreview });
    }
    onClose();
  };

  const handleRunApiTest = async () => {
    if (!testPhrase.trim()) return;
    setIsTestingApi(true);
    const [zRes, eRes] = await Promise.all([
      fetchZhuyinFromMoedictApi(testPhrase.trim()),
      fetchEnglishFromTranslationApi(testPhrase.trim(), 'Custom Activity'),
    ]);
    setTestZhuyin(zRes.zhuyin);
    setTestEnglish(eRes.english);
    setIsTestingApi(false);
  };

  const previewMasked = maskMiddleNameWithCircle(inputName || student.name);
  const previewLeaderboardLabel = formatLeaderboardDisplayName(
    inputName || student.name,
    inputNickname,
    displayPref
  );

  const hasDeletedDefaults =
    templates.filter((t) => !t.isCustom).length < DEFAULT_ACTIVITY_TEMPLATES.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-amber-300 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-100/95 via-orange-50 to-amber-100/95 border-b border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
              {isFirstTimeOnboarding ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <Settings className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {isFirstTimeOnboarding
                  ? '👋 歡迎使用！首次個人資料與作息偏好設定'
                  : '⚙️ 個人資料與作息偏好設定'}
              </h2>
              <p className="text-xs font-bold text-amber-800">
                {isFirstTimeOnboarding
                  ? '第一次設定完成後，系統會自動記住你的班級、座號、暱稱與偏好，之後開啟免重複設定！'
                  : '管理個人座號、暱稱、頭像、排行榜顯示偏好與自訂活動積木庫'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0 cursor-pointer"
            title="關閉視窗"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tabs (僅保留學生個人設定與活動積木庫，學生無法切換至教師後台) */}
        {!isFirstTimeOnboarding && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`h-9 px-3.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 border transition cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>1. 個人資料與偏好設定</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`h-9 px-3.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 border transition cursor-pointer ${
                  activeTab === 'templates'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                }`}
              >
                <Puzzle className="w-4 h-4" />
                <span>2. 活動積木庫 & 注音/翻譯 API ({templates.length})</span>
              </button>
            </div>

            {/* 非學生專屬連結時，提供受教師密碼保護的教師後台入口 */}
            {!isStrictStudentLink && onOpenTeacherAdmin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTeacherAdmin();
                }}
                className="h-8 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-black inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                title="進入教師專屬管理後台（需輸入教師密碼）"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>👩‍🏫 教師管理後台（需密碼）</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 1: Profile & Preferences Setup */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-5 overflow-y-auto space-y-4">
            {/* Avatar & Basic Identity */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/90 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative shrink-0">
                <img
                  src={avatarPreview}
                  alt={inputName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 bg-white shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow border border-white cursor-pointer"
                  title="上傳自訂大頭貼"
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

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    班級 {isStrictStudentLink && <span className="text-amber-700">(已由班級連結鎖定)</span>}
                  </label>
                  <input
                    type="text"
                    required
                    readOnly={isStrictStudentLink}
                    value={inputRoom}
                    onChange={(e) => setInputRoom(e.target.value)}
                    placeholder="例如：301 或 三年一班"
                    className={`w-full rounded-xl border-2 px-3 py-1.5 text-sm font-black focus:outline-none ${
                      isStrictStudentLink
                        ? 'border-amber-200 bg-amber-100/60 text-slate-700 cursor-not-allowed'
                        : 'border-slate-200 bg-white text-slate-800 focus:border-amber-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    暱稱（排行榜預設顯示）
                  </label>
                  <input
                    type="text"
                    value={inputNickname}
                    onChange={(e) => setInputNickname(e.target.value)}
                    placeholder="例如：小宇隊長"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5 text-sm font-black text-slate-800 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    真實姓名（遮罩為 {previewMasked}）
                  </label>
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="例如：林小宇"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5 text-sm font-black text-slate-800 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {avatarMsg && (
              <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                ✅ {avatarMsg}
              </div>
            )}

            {/* 加入者自行選擇在排行榜要顯示暱稱還是姓名（預設為暱稱） */}
            <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-950 flex-wrap">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>排行榜顯示名稱偏好：</span>
                <div className="inline-flex items-center bg-white border border-emerald-200 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setDisplayPref('nickname')}
                    className={`px-3 py-1 rounded-lg font-black transition cursor-pointer ${
                      displayPref === 'nickname'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    顯示暱稱（預設）
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayPref('name')}
                    className={`px-3 py-1 rounded-lg font-black transition cursor-pointer ${
                      displayPref === 'name'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    顯示姓名 ({previewMasked})
                  </button>
                </div>
              </div>

              <div className="font-black text-emerald-800">
                排行榜預覽：{selectedSeat}號 {previewLeaderboardLabel}
              </div>
            </div>

            {/* 預設排課偏好：聚焦時段與時間格點 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <label className="block font-black text-slate-700 mb-1">
                  預設聚焦時段（非聚焦時段仍可自由排課，22:00-07:00 預設為晚間睡眠）
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={localFocusStart}
                    onChange={(e) => setLocalFocusStart(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-800"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                  <span className="font-bold">至</span>
                  <select
                    value={localFocusEnd}
                    onChange={(e) => setLocalFocusEnd(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-800"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1">
                  預設時間軸格點精度
                </label>
                <div className="inline-flex items-center bg-white border border-slate-300 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setLocalSnap(15)}
                    className={`px-3 py-1 rounded-lg font-black transition cursor-pointer ${
                      localSnap === 15
                        ? 'bg-amber-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    15 分鐘精細格點
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalSnap(30)}
                    className={`px-3 py-1 rounded-lg font-black transition cursor-pointer ${
                      localSnap === 30
                        ? 'bg-amber-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    30 分鐘標準格點
                  </button>
                </div>
              </div>
            </div>

            {/* 1 ~ maxSeatCount Seat Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-700">
                  點選你的座號 (1 ~ {maxSeatCount} 號)：目前選中{' '}
                  <span className="text-amber-600 text-sm">{selectedSeat} 號</span>
                </label>
                <span className="text-[11px] font-bold text-slate-500">
                  儲存後系統將自動記住此座號與個資
                </span>
              </div>

              <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-[168px] overflow-y-auto">
                {Array.from({ length: maxSeatCount }).map((_, idx) => {
                  const seat = idx + 1;
                  const isSelected = selectedSeat === seat;
                  const cleanTargetRoom = inputRoom.trim() || roomId;
                  const targetLb =
                    cleanTargetRoom === roomId
                      ? leaderboardMap
                      : allClassroomsMap[cleanTargetRoom]?.leaderboardMap || {};
                  const seatEntry = targetLb[seat];
                  const isOccupiedByReal = Boolean(
                    seatEntry && !seatEntry.isSimulated
                  );

                  return (
                    <button
                      type="button"
                      key={seat}
                      onClick={() => handleSelectSeat(seat)}
                      title={
                        isOccupiedByReal
                          ? `${seat} 號已登錄：${seatEntry.nickname || seatEntry.name}`
                          : `${seat} 號（尚無學生登錄）`
                      }
                      className={`h-8 rounded-xl font-black text-xs transition flex items-center justify-center relative cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-white shadow-sm scale-105 ring-2 ring-amber-300'
                          : isOccupiedByReal
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                      }`}
                    >
                      <span>{seat}</span>
                      {isOccupiedByReal && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full absolute top-1 right-1 ${
                            isSelected ? 'bg-white' : 'bg-emerald-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 座號切換防呆提示：清楚告知是「搬移座號（舊座號消失）」還是「該座號已有人登錄」 */}
              {(() => {
                const cleanTargetRoom = inputRoom.trim() || roomId;
                const targetLb =
                  cleanTargetRoom === roomId
                    ? leaderboardMap
                    : allClassroomsMap[cleanTargetRoom]?.leaderboardMap || {};
                const targetEntry = targetLb[selectedSeat];
                const isOccupiedOther =
                  selectedSeat !== student.seatNumber &&
                  targetEntry &&
                  !targetEntry.isSimulated;

                if (isOccupiedOther) {
                  return (
                    <div className="mt-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
                      ⚠️ 注意：<strong>{selectedSeat} 號</strong>目前已有同學「
                      <strong>{targetEntry.nickname || targetEntry.name}</strong>
                      」登錄！系統已自動載入該座號的資料，不會拿舊座號的名字把對方蓋掉。
                    </div>
                  );
                }
                if (
                  !isFirstTimeOnboarding &&
                  cleanTargetRoom === roomId &&
                  selectedSeat !== student.seatNumber
                ) {
                  return (
                    <div className="mt-2 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold">
                      🔄 您正在將座號由 <strong>{student.seatNumber} 號</strong>改為{' '}
                      <strong>{selectedSeat} 號</strong>：按下儲存後，原本的{' '}
                      <strong>{student.seatNumber} 號</strong>會自動從排行榜移除並搬移至{' '}
                      <strong>{selectedSeat} 號</strong>（不會留下兩個分身）！
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {!isFirstTimeOnboarding && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  取消
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isFirstTimeOnboarding
                    ? `完成首次設定並記住（班級 ${inputRoom} · ${selectedSeat} 號）`
                    : `儲存個人設定（班級 ${inputRoom} · ${selectedSeat} 號）`}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Activity Templates & Moedict / Translation API Manager */}
        {activeTab === 'templates' && (
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
            {/* Live Moedict + Translation API Verifier */}
            <div className="p-4 rounded-2xl bg-sky-50/90 border border-sky-200 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-black text-sky-950 flex items-center gap-1.5 text-sm">
                  <Globe className="w-4 h-4 text-sky-600" />
                  <span>教育部萌典 (Moedict) 注音 API ＆ 線上中英翻譯 API 測試中心</span>
                </div>
                <span className="text-[11px] font-bold text-sky-700 bg-white px-2.5 py-0.5 rounded-full border border-sky-200">
                  字庫外生字自動連線查音與翻譯並快取於本機
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="text"
                  value={testPhrase}
                  onChange={(e) => setTestPhrase(e.target.value)}
                  placeholder="輸入任何自訂活動詞彙測試，例如：烏克麗麗、烘焙點心"
                  className="flex-1 rounded-xl border border-sky-300 bg-white px-3 py-2 font-black text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleRunApiTest}
                  disabled={isTestingApi}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black shrink-0 transition cursor-pointer"
                >
                  {isTestingApi ? 'API 查詢中...' : '測試連線轉換'}
                </button>
              </div>

              {(testZhuyin || testEnglish) && (
                <div className="p-3 rounded-xl bg-white border border-sky-200 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-bold">直式注音預覽：</span>
                    <span className="text-base font-black text-slate-900">
                      <RubyText text={testPhrase} zhuyin={testZhuyin} nowrap />
                    </span>
                    <span className="text-slate-400 font-mono">({testZhuyin})</span>
                  </div>
                  <div className="font-black text-sky-800">
                    英文翻譯：{testEnglish}
                  </div>
                </div>
              )}
            </div>

            {/* Existing Activity Templates List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-800 text-sm">
                  目前活動積木庫（共 {templates.length} 個，預設與自訂皆可刪除）
                </span>
                {hasDeletedDefaults && (
                  <button
                    type="button"
                    onClick={restoreDefaultTemplates}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>一鍵還原所有預設活動</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto p-1">
                {templates.map((tpl) => {
                  const pCat = PARENT_CATEGORIES.find((c) => c.id === tpl.parentId);
                  return (
                    <div
                      key={tpl.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: tpl.color }}
                        />
                        <div className="min-w-0">
                          <div className="font-black text-slate-900 text-sm">
                            <RubyText text={tpl.name} zhuyin={tpl.zhuyin} nowrap />
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 truncate">
                            {pCat?.name} · {tpl.english || '無英文'} · 預設{' '}
                            {tpl.defaultDurationMinutes}分
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeTemplate(tpl.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition shrink-0 cursor-pointer"
                        title="刪除此活動積木"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
