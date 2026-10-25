import React, { useEffect, useState } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import { PARENT_CATEGORIES, DEFAULT_ACTIVITY_TEMPLATES } from '../data/categories';
import { ParentCategoryId } from '../types/schedule';
import {
  RubyText,
  autoGenerateZhuyin,
  autoTranslateToEnglish,
  fetchZhuyinFromMoedictApi,
  fetchEnglishFromTranslationApi,
} from '../utils/zhuyin';
import { CuteActivityIcon } from './CuteActivityIcon';
import {
  Palette,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Wand2,
  Globe,
  Eraser,
  XCircle,
} from 'lucide-react';

interface ActivityPaletteDrawerProps {
  activeTemplateId: string | null;
  onSelectTemplate: (id: string | null) => void;
}

const PRESET_COLORS = [
  '#3B82F6', '#6366F1', '#10B981', '#EC4899',
  '#F59E0B', '#8B5CF6', '#0EA5E9', '#EF4444',
  '#14B8A6', '#84CC16',
];

export const ActivityPaletteDrawer: React.FC<ActivityPaletteDrawerProps> = ({
  activeTemplateId,
  onSelectTemplate,
}) => {
  const {
    templates,
    addCustomTemplate,
    removeTemplate,
    restoreDefaultTemplates,
    isPaletteOpen,
    setPaletteOpen,
  } = usePlannerStore();

  const [selectedParent, setSelectedParent] = useState<ParentCategoryId | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Custom Activity Form State: (1) 自動抓取注音與英文翻譯(含萌典/翻譯API) + (2) 自行輸入並行
  const [customName, setCustomName] = useState('');
  const [customZhuyin, setCustomZhuyin] = useState('');
  const [customEnglish, setCustomEnglish] = useState('');
  const [zhuyinManuallyEdited, setZhuyinManuallyEdited] = useState(false);
  const [englishManuallyEdited, setEnglishManuallyEdited] = useState(false);
  const [customParent, setCustomParent] = useState<ParentCategoryId>('study');
  const [customColor, setCustomColor] = useState('#3B82F6');
  const [customDuration, setCustomDuration] = useState(60);
  const [apiStatusText, setApiStatusText] = useState<string | null>(null);

  const filteredTemplates =
    selectedParent === 'all'
      ? templates
      : templates.filter((t) => t.parentId === selectedParent);

  const hasDeletedDefaults =
    templates.filter((t) => !t.isCustom).length < DEFAULT_ACTIVITY_TEMPLATES.length;

  // 當輸入中文活動名稱時，先同步查本地字典，再自動連線「教育部萌典 API」與「線上翻譯 API」補齊字庫外詞彙
  useEffect(() => {
    const trimmed = customName.trim();
    if (!trimmed) {
      setApiStatusText(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setApiStatusText('正在連線萌典與翻譯 API...');
      const parentCat = PARENT_CATEGORIES.find((c) => c.id === customParent);

      const [zhuyinRes, enRes] = await Promise.all([
        !zhuyinManuallyEdited
          ? fetchZhuyinFromMoedictApi(trimmed)
          : Promise.resolve({ zhuyin: customZhuyin, fromApi: false }),
        !englishManuallyEdited
          ? fetchEnglishFromTranslationApi(trimmed, parentCat?.english || 'Custom Activity')
          : Promise.resolve({ english: customEnglish, fromApi: false }),
      ]);

      if (cancelled) return;

      if (!zhuyinManuallyEdited && zhuyinRes.zhuyin) {
        setCustomZhuyin(zhuyinRes.zhuyin);
      }
      if (!englishManuallyEdited && enRes.english) {
        setCustomEnglish(enRes.english);
      }

      if (zhuyinRes.fromApi || enRes.fromApi) {
        setApiStatusText('已由萌典／翻譯 API 自動補齊');
      } else {
        setApiStatusText('已自動帶入內建字庫');
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customName, customParent, zhuyinManuallyEdited, englishManuallyEdited]);

  const handleNameChange = (val: string) => {
    setCustomName(val);
    if (!zhuyinManuallyEdited) {
      setCustomZhuyin(autoGenerateZhuyin(val));
    }
    if (!englishManuallyEdited) {
      const parentCat = PARENT_CATEGORIES.find((c) => c.id === customParent);
      const localTranslated = autoTranslateToEnglish(val, '');
      if (localTranslated) {
        setCustomEnglish(localTranslated);
      } else if (!val.trim()) {
        setCustomEnglish('');
      } else {
        setCustomEnglish(parentCat?.english || '');
      }
    }
  };

  // 手動點擊「重新API抓取」按鈕強制透過萌典與線上翻譯 API 抓取
  const handleForceAutoFetch = async () => {
    if (!customName.trim()) return;
    setZhuyinManuallyEdited(false);
    setEnglishManuallyEdited(false);
    setApiStatusText('正在連線萌典與翻譯 API...');
    const parentCat = PARENT_CATEGORIES.find((c) => c.id === customParent);
    const [zRes, eRes] = await Promise.all([
      fetchZhuyinFromMoedictApi(customName.trim()),
      fetchEnglishFromTranslationApi(customName.trim(), parentCat?.english || 'Custom Activity'),
    ]);
    setCustomZhuyin(zRes.zhuyin);
    setCustomEnglish(eRes.english);
    setApiStatusText('已重新由萌典／翻譯 API 抓取完成');
  };

  // 一鍵清空注音與英文（若使用者不想顯示注音或英文）
  const handleClearBoth = () => {
    setZhuyinManuallyEdited(true);
    setEnglishManuallyEdited(true);
    setCustomZhuyin('');
    setCustomEnglish('');
    setApiStatusText('已設為不顯示注音與英文');
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const created = addCustomTemplate({
      parentId: customParent,
      name: customName.trim(),
      zhuyin: customZhuyin.trim(),
      english: customEnglish.trim(),
      color: customColor,
      iconName:
        customParent === 'study'
          ? 'homework'
          : customParent === 'sports'
            ? 'sports'
            : customParent === 'creative'
              ? 'music'
              : customParent === 'sleep'
                ? 'sleep'
                : customParent === 'daily'
                  ? 'meal'
                  : customParent === 'leisure'
                    ? 'family'
                    : customParent === 'school'
                      ? 'school'
                      : 'star',
      defaultDurationMinutes: customDuration,
    });

    onSelectTemplate(created.id);
    setCustomName('');
    setCustomZhuyin('');
    setCustomEnglish('');
    setZhuyinManuallyEdited(false);
    setEnglishManuallyEdited(false);
    setApiStatusText(null);
    setShowCreateModal(false);
  };

  if (!isPaletteOpen) {
    return (
      <button
        onClick={() => setPaletteOpen(true)}
        className="fixed right-3 bottom-4 z-40 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-3.5 py-2.5 rounded-full shadow-lg flex items-center gap-1.5 border-2 border-white transition"
      >
        <ChevronLeft className="w-4 h-4" />
        <Palette className="w-4 h-4" />
        展開活動調色盤
      </button>
    );
  }

  return (
    <aside className="w-full lg:w-[275px] xl:w-[295px] shrink-0 bg-white border-2 border-amber-200/90 rounded-2xl shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2 bg-amber-50/80 border-b border-amber-200/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-amber-600" />
          <h2 className="font-black text-sm text-slate-800">活動積木調色盤</h2>
        </div>
        <div className="flex items-center gap-1">
          {hasDeletedDefaults && (
            <button
              type="button"
              onClick={restoreDefaultTemplates}
              className="text-[11px] font-bold text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded-lg inline-flex items-center gap-0.5"
              title="還原已刪除的預設活動積木"
            >
              <RotateCcw className="w-3 h-3" />
              還原預設
            </button>
          )}
          <button
            onClick={() => setPaletteOpen(false)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg hover:bg-amber-100/60"
            title="收合調色盤"
          >
            收合 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 8 Parent Category Pills */}
      <div className="p-2 border-b border-slate-100 flex flex-wrap gap-1 bg-slate-50/60">
        <button
          onClick={() => setSelectedParent('all')}
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition ${
            selectedParent === 'all'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          全部 ({templates.length})
        </button>
        {PARENT_CATEGORIES.map((cat) => {
          const isSelected = selectedParent === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedParent(cat.id)}
              style={{
                backgroundColor: isSelected ? cat.color : '#FFFFFF',
                borderColor: cat.color,
                color: isSelected ? '#FFFFFF' : '#334155',
              }}
              className="text-xs font-bold px-2 py-0.5 rounded-full border transition hover:brightness-95"
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Add Custom Activity Button & Quick Deselect Button */}
      <div className="px-3 pt-2 pb-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-bold text-slate-500">
            {activeTemplateId
              ? '已點選積木，點擊左方時間軸即可放置'
              : '點選下方積木後，點擊時間軸放置'}
          </span>
          <button
            type="button"
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="inline-flex items-center gap-1 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-xl shadow-2xs transition shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            自訂活動
          </button>
        </div>

        {/* 快速放棄積木點選按鈕（當右側有積木被點選時醒目顯示） */}
        {activeTemplateId && (
          <button
            type="button"
            onClick={() => onSelectTemplate(null)}
            className="w-full py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <XCircle className="w-4 h-4 shrink-0" />
            <span>放棄積木點選（取消游標積木）</span>
          </button>
        )}
      </div>

      {/* Inline Custom Activity Creator: (1) 萌典/翻譯API自動抓取 + (2) 自行輸入並行 */}
      {showCreateModal && (
        <form
          onSubmit={handleCreateCustom}
          className="mx-3 my-1.5 p-3 rounded-xl bg-amber-50/90 border-2 border-amber-300 space-y-2 text-xs"
        >
          <div className="font-black text-amber-900 flex items-center justify-between">
            <span>✨ 新增自訂活動（連線萌典注音＋翻譯 API）</span>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">所屬大類</label>
              <select
                value={customParent}
                onChange={(e) => {
                  const pid = e.target.value as ParentCategoryId;
                  setCustomParent(pid);
                  const found = PARENT_CATEGORIES.find((c) => c.id === pid);
                  if (found) {
                    setCustomColor(found.color);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-bold text-slate-800"
              >
                {PARENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">預設時長</label>
              <select
                value={customDuration}
                onChange={(e) => setCustomDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-bold"
              >
                <option value={30}>30 分鐘</option>
                <option value={60}>60 分鐘</option>
                <option value={90}>90 分鐘</option>
                <option value={120}>120 分鐘</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="font-bold text-slate-700">
                活動名稱（自動抓注音與英文）
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleForceAutoFetch}
                  className="text-[10px] font-black text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  title="連線教育部萌典與翻譯 API 重新自動抓取"
                >
                  <Wand2 className="w-3 h-3" />
                  API抓取
                </button>
                <button
                  type="button"
                  onClick={handleClearBoth}
                  className="text-[10px] font-bold text-slate-500 hover:text-rose-600 inline-flex items-center gap-0.5"
                  title="清空注音與英文（不顯示）"
                >
                  <Eraser className="w-3 h-3" />
                  清空
                </button>
              </div>
            </div>
            <input
              type="text"
              required
              maxLength={10}
              placeholder="例如：烏克麗麗、烘焙課、溜直排輪"
              value={customName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900"
            />
            {apiStatusText && (
              <div className="mt-1 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                <Globe className="w-3 h-3 shrink-0" />
                <span>{apiStatusText}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">
                注音（自動 / 可手改）
              </label>
              <input
                type="text"
                placeholder="留空則不顯示注音"
                value={customZhuyin}
                onChange={(e) => {
                  setZhuyinManuallyEdited(true);
                  setCustomZhuyin(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">
                英文（自動 / 可手改）
              </label>
              <input
                type="text"
                placeholder="留空則不顯示英文"
                value={customEnglish}
                onChange={(e) => {
                  setEnglishManuallyEdited(true);
                  setCustomEnglish(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-bold"
              />
            </div>
          </div>

          {/* 即時預覽直式注音與英文 */}
          {customName.trim() && (
            <div className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 flex items-center justify-between">
              <div className="font-black text-sm text-slate-800">
                <RubyText text={customName.trim()} zhuyin={customZhuyin} nowrap />
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {customEnglish}
              </span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">積木顏色</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCustomColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full border-2 ${
                    customColor === c ? 'border-slate-900 scale-110' : 'border-white'
                  }`}
                />
              ))}
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-1.5 rounded-lg shadow-xs transition"
          >
            儲存活動積木
          </button>
        </form>
      )}

      {/* Draggable / Selectable Activity Templates List (All Deletable!) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredTemplates.map((tpl) => {
          const isSelected = activeTemplateId === tpl.id;
          const parentCat = PARENT_CATEGORIES.find((c) => c.id === tpl.parentId);

          return (
            <div
              key={tpl.id}
              draggable
              onDragStart={(e) => {
                onSelectTemplate(tpl.id);
                e.dataTransfer.setData(
                  'application/kids-activity-template',
                  JSON.stringify(tpl)
                );
              }}
              onClick={() => onSelectTemplate(isSelected ? null : tpl.id)}
              style={{
                backgroundColor: tpl.color,
              }}
              className={`puzzle-block p-2.5 text-white cursor-pointer flex items-center justify-between gap-2 select-none transition ${
                isSelected
                  ? 'ring-3 ring-amber-400 ring-offset-2 scale-[1.01]'
                  : 'opacity-95 hover:opacity-100'
              }`}
              title={
                isSelected
                  ? '再次點擊即可取消點選此積木'
                  : '點選此積木以放置到時間軸'
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/95 flex items-center justify-center shrink-0 shadow-xs">
                  <CuteActivityIcon iconName={tpl.iconName} size={22} />
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-black leading-tight whitespace-nowrap">
                    <RubyText
                      text={tpl.name}
                      zhuyin={tpl.zhuyin}
                      rtClassName="text-white/95"
                      nowrap
                    />
                  </div>
                  <div className="text-[10px] font-bold text-white/90 truncate">
                    {tpl.english ? `${tpl.english} · ` : ''}
                    {parentCat?.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-black bg-black/20 px-1.5 py-0.5 rounded-full">
                  {tpl.defaultDurationMinutes}分
                </span>
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-white text-slate-900 flex items-center justify-center shadow">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
                {/* 預設活動與自訂活動皆可由使用者刪除 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTemplateId === tpl.id) {
                      onSelectTemplate(null);
                    }
                    removeTemplate(tpl.id);
                  }}
                  className="p-1 rounded-lg hover:bg-black/25 text-white/90 transition"
                  title="刪除此活動積木"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
