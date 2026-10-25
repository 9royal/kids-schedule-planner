import React, { useState, useEffect } from 'react';
import { usePlannerStore, DEFAULT_FIREBASE_CONFIG } from '../store/usePlannerStore';
import { formatLeaderboardDisplayName, PARENT_CATEGORIES } from '../data/categories';
import {
  Lock,
  Unlock,
  School,
  Users,
  Plus,
  Copy,
  Check,
  Trash2,
  X,
  Cloud,
  Wifi,
  Download,
  Sparkles,
  UserCheck,
  UserX,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

interface TeacherAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatHoursAndMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}小時`;
  return `${h}時${m}分`;
}

function formatLastActive(ts?: number): string {
  if (!ts) return '尚無紀錄';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return '剛剛更新';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分鐘前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小時前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export const TeacherAdminModal: React.FC<TeacherAdminModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    roomId: currentStudentRoomId,
    allClassroomsMap,
    teacherPin,
    setTeacherPin,
    refreshAllClassrooms,
    createOrUpdateClassroom,
    deleteClassroom,
    removeStudentFromRoom,
    clearSimulatedInRoom,
    simulateStudentsInRoom,
    syncMode,
    firebaseConnected,
    firebaseConfig,
    connectFirebase,
    disconnectFirebase,
  } = usePlannerStore();

  // 教師密碼驗證狀態（防止學生切回或偷看老師後台）
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // 修改教師密碼狀態
  const [showChangePin, setShowChangePin] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [pinSavedMsg, setPinSavedMsg] = useState<string | null>(null);

  // 後台目前檢視／管理的班級（無須切換學生身分！）
  const [selectedInspectRoom, setSelectedInspectRoom] = useState<string>(currentStudentRoomId || '301');

  // 新增班級表單
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMaxSeats, setNewRoomMaxSeats] = useState<number>(30);

  // 複製連結提示
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [isSimulatingRoom, setIsSimulatingRoom] = useState(false);

  // Firebase 設定表單
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);
  const [dbUrl, setDbUrl] = useState(
    firebaseConfig?.databaseURL || DEFAULT_FIREBASE_CONFIG.databaseURL
  );
  const [apiKey, setApiKey] = useState(
    firebaseConfig?.apiKey || DEFAULT_FIREBASE_CONFIG.apiKey
  );
  const [projectId, setProjectId] = useState(
    firebaseConfig?.projectId || DEFAULT_FIREBASE_CONFIG.projectId
  );
  const [fbError, setFbError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      refreshAllClassrooms();
      setPinInput('');
      setPinError(null);
      if (!selectedInspectRoom) {
        setSelectedInspectRoom(currentStudentRoomId || '301');
      }
    }
  }, [isOpen, currentStudentRoomId, refreshAllClassrooms, selectedInspectRoom]);

  if (!isOpen) return null;

  const classroomList = Object.values(allClassroomsMap).sort((a, b) =>
    a.roomId.localeCompare(b.roomId, 'zh-Hant-TW', { numeric: true })
  );

  // 計算全校總統計（區分真實加入學生 vs 模擬測試資料）
  let totalRealStudentsAllRooms = 0;
  let totalSimulatedAllRooms = 0;
  for (const room of classroomList) {
    for (const entry of Object.values(room.leaderboardMap)) {
      if (entry.isSimulated) {
        totalSimulatedAllRooms += 1;
      } else {
        totalRealStudentsAllRooms += 1;
      }
    }
  }

  const activeRoomInfo =
    allClassroomsMap[selectedInspectRoom] ||
    classroomList[0] || {
      roomId: selectedInspectRoom || '301',
      maxSeatCount: 40,
      leaderboardMap: {},
      lastActiveAt: 0,
    };

  const activeEntries = Object.values(activeRoomInfo.leaderboardMap).sort(
    (a, b) => a.seatNumber - b.seatNumber
  );
  const realEntriesInRoom = activeEntries.filter((e) => !e.isSimulated);
  const simulatedEntriesInRoom = activeEntries.filter((e) => e.isSimulated);

  // 計算該班級尚未加入的座號清單
  const joinedSeatSet = new Set(realEntriesInRoom.map((e) => e.seatNumber));
  const unjoinedSeats: number[] = [];
  for (let s = 1; s <= activeRoomInfo.maxSeatCount; s++) {
    if (!joinedSeatSet.has(s)) {
      unjoinedSeats.push(s);
    }
  }

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === teacherPin) {
      setIsAuthenticated(true);
      setPinError(null);
    } else {
      setPinError('教師管理密碼不正確，學生無法進入教師管理後台！');
    }
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.trim().length < 4) {
      setPinSavedMsg('密碼請至少輸入 4 碼');
      return;
    }
    setTeacherPin(newPinInput.trim());
    setNewPinInput('');
    setShowChangePin(false);
    setPinSavedMsg('✅ 已更新教師管理密碼！');
    setTimeout(() => setPinSavedMsg(null), 3500);
  };

  const handleAddClassroom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRoomName.trim();
    if (!clean) return;
    createOrUpdateClassroom(clean, newRoomMaxSeats);
    setSelectedInspectRoom(clean);
    setNewRoomName('');
  };

  const buildStudentInviteUrl = (targetRoom: string) => {
    const baseUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://9royal.github.io/kids-schedule-planner/';
    // 若使用系統內建的預設全校資料庫，學生點開網址就會自動連線，無須附加冗長的 &db= 參數；僅在老師改用其他自訂資料庫時才附加
    const isCustomDb =
      firebaseConnected &&
      firebaseConfig?.databaseURL &&
      firebaseConfig.databaseURL.replace(/\/$/, '') !==
        DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/\/$/, '');
    const dbParam =
      isCustomDb && firebaseConfig?.databaseURL
        ? `&db=${encodeURIComponent(firebaseConfig.databaseURL)}`
        : '';
    return `${baseUrl}?room=${encodeURIComponent(targetRoom)}&role=student${dbParam}`;
  };

  const handleCopyRoomLink = (targetRoom: string) => {
    const url = buildStudentInviteUrl(targetRoom);
    navigator.clipboard?.writeText(url);
    setCopiedRoomId(targetRoom);
    setTimeout(() => setCopiedRoomId(null), 3500);
  };

  const handleExportRoomReport = (targetRoom: string) => {
    const roomData = allClassroomsMap[targetRoom];
    if (!roomData) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      roomId: targetRoom,
      maxSeatCount: roomData.maxSeatCount,
      realStudentCount: Object.values(roomData.leaderboardMap).filter((e) => !e.isSimulated)
        .length,
      students: Object.values(roomData.leaderboardMap).sort(
        (a, b) => a.seatNumber - b.seatNumber
      ),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class-${targetRoom}-students-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConnectFirebase = () => {
    setFbError(null);
    const cleanDb = dbUrl.trim().replace(/\/$/, '');
    if (!cleanDb) {
      setFbError('請貼上 Firebase Database URL（例如 https://xxx-default-rtdb.firebaseio.com）');
      return;
    }
    const hostPart = cleanDb.replace(/^https?:\/\//, '').split('.')[0] || 'kids-planner';
    const resolvedProjectId = projectId.trim() || hostPart.replace(/-default-rtdb$/, '');
    try {
      connectFirebase({
        apiKey: apiKey.trim() || 'demo-key',
        databaseURL: cleanDb,
        projectId: resolvedProjectId,
      });
    } catch (err: any) {
      setFbError(err?.message || '連線失敗');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border-2 border-indigo-300 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[93vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-sm shrink-0">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>👩‍🏫 教師專屬全班級管理後台</span>
                {isAuthenticated && (
                  <span className="text-[11px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                    免扮演學生 · 直接管理全校各班與學生連結
                  </span>
                )}
              </h2>
              <p className="text-xs font-bold text-indigo-200">
                集中查看有哪些班級、多少學生已加入使用、一鍵複製各班學生專屬連結與控管班級座號上限
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setShowChangePin(!showChangePin)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-indigo-100 inline-flex items-center gap-1.5 transition cursor-pointer"
                title="修改教師管理密碼"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>修改教師密碼</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white font-bold shrink-0 cursor-pointer"
              title="關閉教師後台"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 尚未通過密碼驗證：顯示教師密碼鎖（防止學生從學生連結切回老師頁面） */}
        {!isAuthenticated ? (
          <form
            onSubmit={handleVerifyPin}
            className="p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto my-6"
          >
            <div className="w-16 h-16 rounded-3xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                請輸入教師管理密碼
              </h3>
              <p className="text-xs font-bold text-slate-500">
                此區域僅限老師進入，學生無法從學生連結切換至此頁面。（預設密碼：<code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-black">8888</code>，進入後可自行修改）
              </p>
            </div>

            <div className="w-full flex items-center gap-2">
              <input
                type="password"
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="輸入教師密碼 (預設 8888)"
                className="flex-1 rounded-xl border-2 border-slate-300 px-4 py-2.5 text-center text-base font-black tracking-widest text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>驗證進入</span>
              </button>
            </div>

            {pinError && (
              <div className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl w-full">
                ⚠️ {pinError}
              </div>
            )}
          </form>
        ) : (
          /* 已通過密碼驗證：顯示完整全班級教師管理中心 */
          <div className="p-5 overflow-y-auto space-y-5 text-xs">
            {/* 修改教師密碼列 */}
            {showChangePin && (
              <form
                onSubmit={handleSaveNewPin}
                className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="font-black text-amber-950 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>設定新的教師管理密碼（目前密碼：{teacherPin}）：</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="輸入新密碼（至少 4 碼）"
                    className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 font-black text-slate-800"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black cursor-pointer"
                  >
                    儲存新密碼
                  </button>
                </div>
              </form>
            )}

            {pinSavedMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-black">
                {pinSavedMsg}
              </div>
            )}

            {/* 1. 全校班級與學生加入總覽統計 + 快速建立新班級（無須扮演學生！） */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* 統計指標卡 */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-indigo-700">
                    目前已建立班級數
                  </span>
                  <div className="text-2xl font-black text-indigo-950 mt-1">
                    {classroomList.length} <span className="text-xs font-bold">個班級</span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-600 mt-1">
                    班級清單：{classroomList.map((c) => c.roomId).join('、')}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-emerald-700">
                    全校已加入真實學生數
                  </span>
                  <div className="text-2xl font-black text-emerald-950 mt-1">
                    {totalRealStudentsAllRooms}{' '}
                    <span className="text-xs font-bold">位真實學生</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 mt-1">
                    另有系統測試座號 {totalSimulatedAllRooms} 筆
                  </span>
                </div>
              </div>

              {/* 免扮演學生直接建立新班級表單 */}
              <form
                onSubmit={handleAddClassroom}
                className="lg:col-span-7 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    <span>新增班級（老師不必切換學生身分，直接建立並取得該班學生連結）</span>
                  </span>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="輸入新班級代號，例如：302、303、五年甲班"
                    className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 font-black text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-slate-600">人數上限：</span>
                    <select
                      value={newRoomMaxSeats}
                      onChange={(e) => setNewRoomMaxSeats(Number(e.target.value))}
                      className="rounded-xl border-2 border-slate-200 bg-white px-2.5 py-2 font-black text-slate-800"
                    >
                      {[20, 25, 30, 35, 40, 50, 60].map((cnt) => (
                        <option key={cnt} value={cnt}>
                          {cnt} 人
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black inline-flex items-center gap-1.5 shadow-2xs shrink-0 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>建立班級</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 2. 所有班級卡片總覽：一眼看清「有哪些班級、多少學生已加入」，並可直接複製任一班級的學生專屬連結 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <School className="w-4 h-4 text-indigo-600" />
                  <span>
                    各班級加入人數與學生專屬連結總覽（點選班級可檢視下方學生名單）
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={refreshAllClassrooms}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>重新整理狀態</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {classroomList.map((room) => {
                  const entries = Object.values(room.leaderboardMap);
                  const realCount = entries.filter((e) => !e.isSimulated).length;
                  const simCount = entries.filter((e) => e.isSimulated).length;
                  const isSelected = room.roomId === activeRoomInfo.roomId;
                  const isCopied = copiedRoomId === room.roomId;

                  return (
                    <div
                      key={room.roomId}
                      onClick={() => setSelectedInspectRoom(room.roomId)}
                      className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-black text-slate-900">
                              班級 {room.roomId}
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              上限 {room.maxSeatCount} 人
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                            最後活動：{formatLastActive(room.lastActiveAt)}
                          </div>
                        </div>

                        {classroomList.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteClassroom(room.roomId);
                              if (selectedInspectRoom === room.roomId) {
                                const remaining = classroomList.find(
                                  (c) => c.roomId !== room.roomId
                                );
                                if (remaining) setSelectedInspectRoom(remaining.roomId);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                            title={`刪除班級 ${room.roomId}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* 已加入學生數統計條 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-black text-xs inline-flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                          真實學生已加入：{realCount} / {room.maxSeatCount} 人
                        </span>
                        {simCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-[11px]">
                            含測試座號 {simCount} 筆
                          </span>
                        )}
                      </div>

                      {/* 直接複製該班級學生連結按鈕（免切換學生身分！） */}
                      <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyRoomLink(room.roomId);
                          }}
                          className={`flex-1 py-1.5 px-3 rounded-xl font-black text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            isCopied
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>已複製 {room.roomId} 班學生連結！</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>複製「{room.roomId} 班」學生連結</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. 選中班級的詳細學生名單與座號管控面板 */}
            <div className="p-4 rounded-2xl bg-slate-50 border-2 border-indigo-200 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <span>📋 班級【{activeRoomInfo.roomId}】學生加入明細與座號管理</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black">
                      已加入真實學生 {realEntriesInRoom.length} 人
                    </span>
                    {simulatedEntriesInRoom.length > 0 && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-black">
                        測試資料 {simulatedEntriesInRoom.length} 人
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    學生專屬連結：
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-700 ml-1 select-all">
                      {buildStudentInviteUrl(activeRoomInfo.roomId)}
                    </code>
                  </p>
                </div>

                {/* 該班級操作按鈕群 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-300">
                    <span className="font-black text-slate-700">此班人數上限：</span>
                    {[20, 25, 30, 35, 40, 50, 60].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() =>
                          createOrUpdateClassroom(activeRoomInfo.roomId, cnt)
                        }
                        className={`px-2 py-0.5 rounded-lg font-black transition cursor-pointer ${
                          activeRoomInfo.maxSeatCount === cnt
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>

                  {simulatedEntriesInRoom.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearSimulatedInRoom(activeRoomInfo.roomId)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black inline-flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>一鍵清空測試座號（僅留真實學生）</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSimulatingRoom}
                    onClick={async () => {
                      setIsSimulatingRoom(true);
                      await simulateStudentsInRoom(activeRoomInfo.roomId);
                      setIsSimulatingRoom(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300 font-black inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                    <span>
                      {isSimulatingRoom
                        ? '產生中...'
                        : `產生 ${activeRoomInfo.maxSeatCount} 人測試資料`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportRoomReport(activeRoomInfo.roomId)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-black inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>匯出此班名單 JSON</span>
                  </button>
                </div>
              </div>

              {/* 尚未加入的座號一覽（方便老師點名確認誰還沒進來） */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <UserX className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-black text-slate-700">
                    尚未加入的真實學生座號（共 {unjoinedSeats.length} 個座號未加入）：
                  </span>
                  <span className="text-slate-500 font-bold">
                    {unjoinedSeats.length === 0
                      ? '🎉 全班所有座號皆已加入！'
                      : unjoinedSeats.slice(0, 25).map((s) => `${s}號`).join('、') +
                        (unjoinedSeats.length > 25 ? ` ...等共 ${unjoinedSeats.length} 人` : '')}
                  </span>
                </div>
              </div>

              {/* 已加入成員明細表格 */}
              {activeEntries.length === 0 ? (
                <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500 font-bold">
                  目前班級【{activeRoomInfo.roomId}】尚無任何學生或測試資料。請複製上方「{activeRoomInfo.roomId} 班學生連結」發給學生即可開始加入！
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto p-1">
                  {activeEntries.map((entry) => {
                    const isSim = Boolean(entry.isSimulated);
                    return (
                      <div
                        key={entry.seatNumber}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                          isSim
                            ? 'bg-amber-50/40 border-amber-200/80'
                            : 'bg-white border-emerald-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={entry.avatarUrl}
                            alt={entry.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 bg-white"
                          />
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 flex items-center gap-1 flex-wrap">
                              <span>
                                {entry.seatNumber}號 {entry.name}
                              </span>
                              {entry.nickname && (
                                <span className="text-slate-500 font-bold">
                                  ({entry.nickname})
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                  isSim
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isSim ? '🧪 測試座號' : '🟢 真實學生'}
                              </span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500">
                              學習 {formatHoursAndMinutes(entry.studyMinutes)} · 運動{' '}
                              {formatHoursAndMinutes(entry.sportsMinutes)} ·{' '}
                              {formatLastActive(entry.lastUpdated)}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeStudentFromRoom(
                              activeRoomInfo.roomId,
                              entry.seatNumber
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                          title={`從班級 ${activeRoomInfo.roomId} 移除 ${entry.seatNumber} 號`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. 雲端跨設備即時同步設定（Firebase Realtime Database） */}
            <div className="rounded-2xl border border-slate-200 p-3.5 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {firebaseConnected ? (
                    <Cloud className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Wifi className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="text-xs font-black text-slate-800">
                    跨設備同步引擎：
                    {firebaseConnected
                      ? '🟢 Firebase 雲端即時同步中（老師可即時看到所有學生平板加入狀況）'
                      : '💻 本機儲存模式（若需跨多台學生平板匯聚名單給老師，請設定 Firebase 雲端連線）'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFirebaseConfig(!showFirebaseConfig)}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  {showFirebaseConfig ? '隱藏 Firebase 雲端設定' : '設定 Firebase 跨設備雲端同步'}
                </button>
              </div>

              {showFirebaseConfig && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="databaseURL (https://xxx.firebaseio.com)"
                    value={dbUrl}
                    onChange={(e) => setDbUrl(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium sm:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="projectId"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium"
                  />
                  <input
                    type="text"
                    placeholder="apiKey (選填)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium sm:col-span-2"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleConnectFirebase}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg py-1.5 cursor-pointer"
                    >
                      連線雲端
                    </button>
                    {syncMode === 'firebase' && (
                      <button
                        type="button"
                        onClick={disconnectFirebase}
                        className="px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg cursor-pointer"
                      >
                        切回本機
                      </button>
                    )}
                  </div>
                  {fbError && (
                    <div className="sm:col-span-3 text-rose-600 font-bold">{fbError}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
