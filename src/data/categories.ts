import {
  ParentCategory,
  ActivityTemplate,
  ScheduleBlock,
  NameDisplayPreference,
  CategoryQuote,
} from '../types/schedule';

/**
 * 將姓名中間字改為圈圈（例如：林小宇 -> 林○宇、王明 -> 王○、歐陽小宇 -> 歐○○宇）
 */
export function maskMiddleNameWithCircle(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '○同學';
  if (trimmed.endsWith('號同學')) return trimmed;

  const chars = Array.from(trimmed);
  if (chars.length <= 1) return chars[0];
  if (chars.length === 2) return `${chars[0]}○`;
  const first = chars[0];
  const last = chars[chars.length - 1];
  const middleCircles = '○'.repeat(chars.length - 2);
  return `${first}${middleCircles}${last}`;
}

/**
 * 依據加入者自行選擇的偏好（預設為 'nickname' 暱稱，或選擇 'name' 顯示姓名）格式化顯示名稱
 */
export function formatLeaderboardDisplayName(
  name: string,
  nickname?: string,
  preference: NameDisplayPreference = 'nickname'
): string {
  const cleanNick = (nickname || '').trim();
  const maskedName = maskMiddleNameWithCircle(name);
  if (preference === 'nickname') {
    return cleanNick || maskedName;
  }
  return maskedName;
}

/**
 * 計算年度週次索引，確保每週自動輪替一組（每組 3 句、週週不重複）
 */
export function getWeeklyQuoteSetForCategory(
  category: ParentCategory,
  extraWeekOffset = 0
): {
  quotes: CategoryQuote[];
  weekCycleIndex: number;
  totalCycles: number;
} {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
  const weekEpochIndex = Math.floor(monday.getTime() / (7 * 24 * 60 * 60 * 1000));
  const sets = category.weeklyQuoteSets || [];
  const totalCycles = Math.max(1, sets.length);
  const weekCycleIndex = Math.abs(weekEpochIndex + extraWeekOffset) % totalCycles;
  return {
    quotes: sets[weekCycleIndex] || [],
    weekCycleIndex,
    totalCycles,
  };
}

export const PARENT_CATEGORIES: ParentCategory[] = [
  {
    id: 'study',
    name: '讀書學習',
    zhuyin: 'ㄉㄨˊ ㄕㄨ ㄒㄩㄝˊ ㄒㄧˊ',
    english: 'Studying & Learning',
    color: '#3B82F6', // Blue
    bgLight: '#EFF6FF',
    borderColor: '#93C5FD',
    leaderboardKey: 'studyMinutes',
    quotes: [
      '溫故而知新，可以為師矣。每天複習一點點，知識就會變成超能力！',
      '讀書破萬卷，下筆如有神。閱讀能帶你飛向最遠的夢想星球。',
      '學而不思則罔，思而不學則殆。帶著好奇心邊讀邊思考吧！',
    ],
    weeklyQuoteSets: [
      [
        {
          text: '溫故而知新，可以為師矣。每天複習一點點，把問題弄懂就是最棒的學習態度。',
          source: '孔子《論語・為政》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E8%AB%96%E8%AA%9E/%E7%82%BA%E6%94%BF%E7%AC%AC%E4%BA%8C',
        },
        {
          text: '讀一本好書，就像和高尚的人談話，每一頁都在打開新世界的大門。',
          source: '笛卡兒《方法論》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E6%96%B9%E6%B3%95%E8%AB%96',
        },
        {
          text: '每天帶著好奇心探索一個新問題，累積起來就是誰也拿不走的智慧超能力！',
        },
      ],
      [
        {
          text: '千里之行，始於足下。今天認真寫完的每一頁作業，都是未來的基石。',
          source: '老子《道德經・第六十四章》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E9%81%93%E5%BE%B7%E7%B6%93',
        },
        {
          text: '我沒有特別的天賦，我只是對世界萬物保持著熱烈的好奇心。',
          source: '阿爾伯特・愛因斯坦（1952年致卡爾・シーリグ書信）',
          sourceUrl: 'https://zh.wikiquote.org/zh-hant/%E9%98%BF%E5%B0%94%E4%BC%AF%E7%89%B9%C2%B7%E7%88%B1%E5%9B%A0%E6%96%AF%E5%9D%A6',
        },
        {
          text: '書山有路勤為徑，學海無涯苦作舟。每天進步一點點就值得為自己鼓掌！',
          source: '《增廣賢文》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E5%A2%9E%E5%BB%A3%E8%B3%A2%E6%96%87',
        },
      ],
      [
        {
          text: '敏而好學，不恥下問。遇到不懂的地方勇敢發問，是聰明孩子的超能力。',
          source: '孔子《論語・公冶長》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E8%AB%96%E8%AA%9E/%E5%85%AC%E5%86%B6%E9%95%B7%E7%AC%AC%E4%BA%94',
        },
        {
          text: '知識就是力量，而閱讀則是讓我們擁有飛翔翅膀的魔法鑰匙。',
          source: '法蘭西斯・培根《沉思錄》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E7%9F%A5%E8%AD%98%E5%B0%B1%E6%98%AF%E5%8A%9B%E9%87%8F',
        },
        {
          text: '業精於勤，荒於嬉；行成於思，毀於隨。專注投入的時光最閃亮！',
          source: '韓愈《進學解》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E9%80%B2%E5%AD%B8%E8%A7%A3',
        },
      ],
      [
        {
          text: '不積跬步，無以至千里；不積小流，無以成江海。持之以恆就能看見成長！',
          source: '《荀子・勸學》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E8%8D%80%E5%AD%90/%E5%8B%B8%E5%AD%B8%E7%AF%87',
        },
        {
          text: '讀書有三到，謂心到、眼到、口到。專心致志能讓學習事半功倍。',
          source: '朱熹《訓學齋規》',
          sourceUrl: 'https://dict.revised.moe.edu.tw/dictView.jsp?ID=41455',
        },
        {
          text: '耐心解開難題後的成就感，是給認真努力的自己最甜美的獎勵！',
        },
      ],
    ],
  },
  {
    id: 'school',
    name: '學校課程',
    zhuyin: 'ㄒㄩㄝˊ ㄒㄧㄠˋ ㄎㄜˋ ㄔㄥˊ',
    english: 'School Classes',
    color: '#6366F1', // Indigo
    bgLight: '#EEF2FF',
    borderColor: '#A5B4FC',
    leaderboardKey: 'schoolMinutes',
    quotes: [
      '三人行，必有我師焉。在學校與同學互相學習，是童年最棒的寶藏！',
      '獨學而無友，則孤陋而寡聞。與班上夥伴一起討論，收穫加倍！',
      '帶著微笑走進教室，每一節課都有意想不到的新發現。',
    ],
    weeklyQuoteSets: [
      [
        {
          text: '三人行，必有我師焉。在學校與同學互相切磋學習，是童年最珍貴的寶藏！',
          source: '孔子《論語・述而》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E8%AB%96%E8%AA%9E/%E8%BF%B0%E8%80%8C%E7%AC%AC%E4%B8%83',
        },
        {
          text: '獨學而無友，則孤陋而寡聞。和班上好朋友一起討論合作，學習更有趣！',
          source: '《禮記・學記》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E7%A6%AE%E8%A8%98/%E5%AD%B8%E8%A8%98',
        },
        {
          text: '帶著微笑走進教室，認真參與每一堂課，每天都有意想不到的新收穫。',
        },
      ],
      [
        {
          text: '自己走雖然很快，但和同學夥伴一起走，可以走得更遠、更快樂！',
        },
        {
          text: '在課堂上專心傾聽、勇敢舉手發問，是開啟智慧之門的第一步。',
        },
        {
          text: '以文會友，以友輔仁。珍惜在班級裡互相幫忙的每一位同學。',
          source: '曾子《論語・顏淵》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E8%AB%96%E8%AA%9E/%E9%A1%8F%E6%B7%B5%E7%AC%AC%E5%8D%81%E4%BA%8C',
        },
      ],
      [
        {
          text: '玉不琢，不成器；人不學，不知道。每一堂學校課程都在雕琢更好的你。',
          source: '《禮記・學記》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E7%A6%AE%E8%A8%98/%E5%AD%B8%E8%A8%98',
        },
        {
          text: '心靈不是等待填滿的容器，而是需要被點燃的火種。',
          source: '普魯塔克《論傾聽》（Moralia）',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E6%99%AE%E9%AD%AF%E5%A1%94%E5%85%8B',
        },
        {
          text: '我們在學校學到的不只是課本知識，更是善良、守時與團隊精神。',
        },
      ],
      [
        {
          text: '博學之，審問之，慎思之，明辨之，篤行之。課堂上的每一步都踏實精彩！',
          source: '《禮記・中庸》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E7%A6%AE%E8%A8%98/%E4%B8%AD%E5%BA%B8',
        },
        {
          text: '班級就像一座小花園，每個人發揮所長，就能綻放最繽紛的色彩。',
        },
        {
          text: '今日在課堂播下專注的種子，明日將收穫豐碩的智慧果實。',
        },
      ],
    ],
  },
  {
    id: 'sports',
    name: '運動體能',
    zhuyin: 'ㄩㄣˋ ㄉㄨㄥˋ ㄊㄧˇ ㄋㄥˊ',
    english: 'Sports & Fitness',
    color: '#10B981', // Emerald
    bgLight: '#ECFDF5',
    borderColor: '#6EE7B7',
    leaderboardKey: 'sportsMinutes',
    quotes: [
      '生命在於運動，流下的每一滴汗水都會化作強健的體魄與活力！',
      '健全的心靈寓於健康的身體，每天到陽光下盡情奔跑跳躍吧！',
      '不怕慢，只怕站，堅持運動讓你長高又強壯。',
    ],
    weeklyQuoteSets: [
      [
        {
          text: '健全的心靈，寓於健康的身體之中。每天動一動，大腦更靈活！',
          source: '約翰・洛克《教育漫話》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E6%95%99%E8%82%B2%E6%BC%AB%E8%AF%9D',
        },
        {
          text: '我可以接受失敗，但絕不放棄嘗試！在運動場上勇敢挑戰自己吧。',
          source: '麥可・喬丹（Michael Jordan）',
          sourceUrl: 'https://en.wikiquote.org/wiki/Michael_Jordan',
        },
        {
          text: '流下的每一滴汗水，都會化作強健的體魄與滿滿的正向活力！',
        },
      ],
      [
        {
          text: '流水不腐，戶樞不蠹，動也。經常運動活動筋骨，身體永遠充滿朝氣！',
          source: '《呂氏春秋・盡數》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E5%91%82%E6%B0%8F%E6%98%A5%E7%A7%8B/%E5%8D%B7%E4%B8%89',
        },
        {
          text: '走出戶外迎向陽光，每一次奔跑與跳躍都在為成長注入能量。',
        },
        {
          text: '運動不只能強健體魄，更能鍛鍊我們面對困難時永不放棄的毅力。',
        },
      ],
      [
        {
          text: '天行健，君子以自強不息。像大自然一樣規律鍛鍊，天天充滿元氣！',
          source: '《易經・乾卦》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E5%91%A8%E6%98%93/%E4%B9%BE',
        },
        {
          text: '規律的運動能活化腦細胞，是提升記憶力、專注力與快樂心情最好的禮物。',
          source: '約翰・瑞迪《運動改造大腦》（Spark）',
          sourceUrl: 'https://en.wikipedia.org/wiki/John_J._Ratey',
        },
        {
          text: '跌倒了拍拍灰塵立刻站起來，運動場上的勇敢會陪伴你長大！',
        },
      ],
      [
        {
          text: '健康是人生第一財富，規律運動則是守護這份財富最好的方法。',
          source: '拉爾夫・華爾道・愛默生《處世之道》（The Conduct of Life）',
          sourceUrl: 'https://en.wikiquote.org/wiki/Ralph_Waldo_Emerson',
        },
        {
          text: '更快、更高、更強——更團結！享受運動帶來的暢快與歡笑吧。',
          source: '《奧林匹克憲章》奧運格言',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E5%A5%A7%E6%9E%97%E5%8C%B9%E5%85%8B%E6%A0%BC%E8%A8%80',
        },
        {
          text: '持之以恆的體能練習，會讓你在不知不覺中長得更高、更挺拔。',
        },
      ],
    ],
  },
  {
    id: 'creative',
    name: '才藝創作',
    zhuyin: 'ㄘㄞˊ ㄧˋ ㄔㄨㄤˋ ㄗㄨㄛˋ',
    english: 'Arts & Creativity',
    color: '#EC4899', // Pink
    bgLight: '#FDF2F8',
    borderColor: '#F9A8D4',
    leaderboardKey: 'creativeMinutes',
    quotes: [
      '每個孩子都是天生的藝術家，用畫筆與音符揮灑你的奇思妙想吧！',
      '想像力比知識更重要，每一次創作都是把夢想變成真實的魔法。',
      '慢工出細活，在音樂與手作中享受靜心投入的成就感。',
    ],
    weeklyQuoteSets: [
      [
        {
          text: '想像力比知識更重要，因為知識有限，而想像力能擁抱整個世界。',
          source: '阿爾伯特・愛因斯坦（1929年訪談錄）',
          sourceUrl: 'https://zh.wikiquote.org/zh-hant/%E9%98%BF%E5%B0%94%E4%BC%AF%E7%89%B9%C2%B7%E7%88%B1%E5%9B%A0%E6%96%AF%E5%9D%A6',
        },
        {
          text: '每個孩子都是天生的藝術家，大膽揮灑屬於你獨一無二的繽紛色彩吧！',
        },
        {
          text: '在琴聲與畫筆中靜下心來感受美好，每一次練習都是小小的魔法。',
        },
      ],
      [
        {
          text: '大自然是我們最好的老師，用心觀察每一片樹葉與雲朵都能發現創作靈感。',
          source: '李奧納多・達文西《繪畫論》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E7%95%AB%E8%AB%96_(%E9%81%94%E6%96%87%E8%A5%BF)',
        },
        {
          text: '每天堅持練習一點點，指尖流淌出的音符與線條終會開出美麗的花朵。',
        },
        {
          text: '不要害怕畫錯或彈錯，創作最迷人的地方就是在嘗試中發現新驚喜！',
        },
      ],
      [
        {
          text: '文字結束的地方，正是音樂開始的地方。',
          source: '海因里希・海涅（德國詩人）',
          sourceUrl: 'https://en.wikiquote.org/wiki/Heinrich_Heine',
        },
        {
          text: '用你手邊的畫筆、黏土或樂器，把腦海裡的奇幻故事創造出來吧！',
        },
        {
          text: '雙手與心靈一起專注投入的時刻，就是最美作品誕生的時刻。',
        },
      ],
      [
        {
          text: '靈感是一群不喜歡拜訪懶惰者的客人，每天動手練習才能遇見它。',
          source: '彼得・伊里奇・柴可夫斯基',
          sourceUrl: 'https://en.wikiquote.org/wiki/Pyotr_Ilyich_Tchaikovsky',
        },
        {
          text: '不論是練琴、畫畫還是手作，享受過程中的快樂比完美更重要！',
        },
        {
          text: '慢工出細活，在音樂與藝術創作中培養耐心與品味。',
        },
      ],
    ],
  },
  {
    id: 'daily',
    name: '生活日常',
    zhuyin: 'ㄕㄥ ㄏㄨㄛˊ ㄖˋ ㄔㄤˊ',
    english: 'Daily Routine',
    color: '#F59E0B', // Amber
    bgLight: '#FFFBEB',
    borderColor: '#FCD34D',
    leaderboardKey: 'dailyMinutes',
    quotes: [
      '一室之不治，何以天下國家為？把房間整理好就是自律的第一步！',
      '好好吃每一頓營養餐點，規律的生活好習慣是陪伴一輩子的好朋友。',
      '主動幫忙分擔家事，用雙手讓家變得更溫暖整潔。',
    ],
    weeklyQuoteSets: [
      [
        {
          text: '黎明即起，灑掃庭除，要內外整潔。把生活小事做好，就是最棒的自律！',
          source: '朱柏廬《朱子治家格言》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E6%9C%B1%E5%AD%90%E6%B2%BB%E5%AE%B6%E6%A0%BC%E8%A8%80',
        },
        {
          text: '一粥一飯，當思來處不易；半絲半縷，恆念物力維艱。珍惜每一頓營養餐點吧！',
          source: '朱柏廬《朱子治家格言》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E6%9C%B1%E5%AD%90%E6%B2%BB%E5%AE%B6%E6%A0%BC%E8%A8%80',
        },
        {
          text: '我們起初養成良好的生活習慣，後來好習慣就會造就更好的我們。',
        },
      ],
      [
        {
          text: '一室之不治，何以天下國家為？把自己的書桌與房間整理好，是獨立的第一步。',
          source: '劉蓉《習慣說》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E7%BF%92%E6%85%A3%E8%AA%AA',
        },
        {
          text: '主動幫忙分擔家事、整理書包，你的雙手正在讓家庭變得更溫暖！',
        },
        {
          text: '把每件平凡的日常小事都做得井井有條，就是了不起的大本領。',
        },
      ],
      [
        {
          text: '今日事，今日畢。睡前把書包與房間整理好，明天早晨更從容！',
        },
        {
          text: '整潔的環境能帶來清澈的心境，自己動手收拾是最有成就感的事。',
        },
        {
          text: '細嚼慢嚥吃好飯、認真刷牙洗好澡，照顧好自己是成長的第一課。',
        },
      ],
      [
        {
          text: '天下難事，必作於易；天下大事，必作於細。重視生活細節，未來必能成大事！',
          source: '老子《道德經・第六十三章》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E9%81%93%E5%BE%B7%E7%B6%93',
        },
        {
          text: '懂得感謝家人準備的餐點並主動收拾碗筷，是最溫暖的貼心舉動。',
        },
        {
          text: '規律的日常作息就像船的羅盤，引領我們穩健地航向每一天。',
        },
      ],
    ],
  },
  {
    id: 'leisure',
    name: '休閒娛樂',
    zhuyin: 'ㄒㄧㄡ ㄒㄧㄢˊ ㄩˊ ㄌㄜˋ',
    english: 'Leisure & Fun',
    color: '#8B5CF6', // Violet
    bgLight: '#F5F3FF',
    borderColor: '#C4B5FD',
    leaderboardKey: 'leisureMinutes',
    quotes: [
      '一張一弛，文武之道也。懂得認真學習，也懂得開心玩耍！',
      '與家人朋友溫馨相伴的歡樂時光，是心靈最溫暖的充電站。',
      '適度放鬆心情、保持純真童心，快樂的能量會讓學習更有幹勁！',
    ],
    weeklyQuoteSets: [
      [
        {
          text: '一張一弛，文武之道也。懂得專心學習，也懂得開心玩耍，生活才平衡！',
          source: '《禮記・雜記下》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E7%A6%AE%E8%A8%98/%E9%9B%9C%E8%A8%98%E4%B8%8B',
        },
        {
          text: '所有的大人都曾經是小孩，保持純真與好奇的童心是最珍貴的禮物。',
          source: '安東尼・德・聖修伯里《小王子》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E5%B0%8F%E7%8E%8B%E5%AD%90',
        },
        {
          text: '與家人朋友溫馨相伴的歡樂時光，是心靈最溫暖的幸福充電站。',
        },
      ],
      [
        {
          text: '知之者不如好之者，好之者不如樂之者。保持快樂的心境，做什麼都充滿能量！',
          source: '孔子《論語・雍也》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E8%AB%96%E8%AA%9E/%E9%9B%8D%E4%B9%9F%E7%AC%AC%E5%85%AD',
        },
        {
          text: '休息與遊戲不是浪費時間，而是為了讓心靈重新充滿創意的火花。',
        },
        {
          text: '在遊戲中學會遵守規則、分享玩具與體貼夥伴，也是重要的成長喔！',
        },
      ],
      [
        {
          text: '拉得太緊的弓弦容易斷，給自己留一段輕鬆愉快的休閒時光吧！',
          source: '《伊索寓言》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E4%BC%8A%E7%B4%A2%E5%AF%93%E8%A8%80',
        },
        {
          text: '真正懂得生活的人，在學習時全神貫注，在玩耍時盡情享受當下。',
        },
        {
          text: '陪伴家人聊聊天、散散步，平凡的相處就是最美的風景。',
        },
      ],
      [
        {
          text: '萬物靜觀皆自得，四時佳興與人同。放慢腳步欣賞身邊的美好吧！',
          source: '程顥《秋日偶成》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E7%A7%8B%E6%97%A5%E5%81%B6%E6%88%90',
        },
        {
          text: '懂得安排時間的孩子，既能完成任務，也能擁有最自在的遊戲時間。',
        },
        {
          text: '每一次開心的親子桌遊或戶外郊遊，都會成為長大後最甜美的回憶。',
        },
      ],
    ],
  },
  {
    id: 'sleep',
    name: '休息睡眠',
    zhuyin: 'ㄒㄧㄡ ㄒㄧˊ ㄕㄨㄟˋ ㄇㄧㄢˊ',
    english: 'Rest & Sleep',
    color: '#0EA5E9', // Sky
    bgLight: '#F0F9FF',
    borderColor: '#7DD3FC',
    leaderboardKey: 'sleepMinutes',
    quotes: [
      '休息是為了走更遠的路，充足睡眠為身高打下良好基礎！',
      '早睡早起使人健康、富有又聰明。',
      '夜晚甜美的夢鄉，正在幫大腦整理今天的收穫，讓身體悄悄長高喔！',
    ],
    weeklyQuoteSets: [
      [
        {
          text: '休息是為了走更遠的路，充足睡眠為身高與健康打下最良好的基礎！',
        },
        {
          text: '早睡早起，能使人身體健康、心靈充實且充滿智慧。',
          source: '班傑明・富蘭克林《窮理查年鑑》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E7%AA%AE%E7%90%86%E6%9F%A5%E7%9A%84%E5%B9%B4%E9%91%91',
        },
        {
          text: '睡眠是連接今日努力與明日活力的金色橋樑，好好睡一覺吧！',
          source: '湯瑪斯・德克爾（Thomas Dekker）',
          sourceUrl: 'https://en.wikiquote.org/wiki/Thomas_Dekker_(writer)',
        },
      ],
      [
        {
          text: '學齡兒童每天擁有 9 至 12 小時的充足睡眠，有助於專注力、學習記憶與身心健康發育！',
          source: '美國疾病管制與預防中心（CDC）兒童睡眠指南',
          sourceUrl: 'https://www.cdc.gov/sleep/about/index.html',
        },
        {
          text: '睡眠是大自然最溫柔的看護，能撫平一天的疲憊並修復全身能量。',
          source: '威廉・莎士比亞《亨利四世》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E4%BA%A8%E5%88%A9%E5%9B%9B%E4%B8%96_(%E6%88%8F%E5%89%A7)',
        },
        {
          text: '睡前放下螢幕、靜心休息，一夜好眠能讓明天的記憶力與專注力翻倍！',
          source: '馬修・沃克《為什麼要睡覺》（Why We Sleep）',
          sourceUrl: 'https://en.wikipedia.org/wiki/Why_We_Sleep',
        },
      ],
      [
        {
          text: '日出而作，日入而息。順應自然規律早點入睡，身體最輕鬆自在。',
          source: '上古歌謠《擊壤歌》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E6%93%8A%E5%A3%A4%E6%AD%8C',
        },
        {
          text: '夜晚甜美的夢鄉，正在幫大腦整理今天的收穫，讓身體悄悄長高喔！',
        },
        {
          text: '午休小憩片刻，能為下午的學習與運動重新充飽滿滿電力！',
        },
      ],
      [
        {
          text: '清晨醒來時，想想能夠呼吸、思考、享受生活與愛人，是多麼珍貴的特權。',
          source: '馬庫斯・奧理略《沉思錄》',
          sourceUrl: 'https://zh.wikipedia.org/zh-tw/%E6%B2%89%E6%80%9D%E5%BD%95',
        },
        {
          text: '充足的睡眠是免疫力的最佳守門員，睡得好才能天天有精神！',
        },
        {
          text: '把今天的煩惱交給星空，在溫暖的被窩裡安心進入甜美夢鄉吧。',
        },
      ],
    ],
  },
  {
    id: 'other',
    name: '其他活動',
    zhuyin: 'ㄑㄧˊ ㄊㄚ ㄏㄨㄛˊ ㄉㄨㄥˋ',
    english: 'Other Activities',
    color: '#64748B', // Slate
    bgLight: '#F8FAFC',
    borderColor: '#CBD5E1',
    leaderboardKey: 'otherMinutes',
    quotes: [
      '凡事豫則立，不豫則廢。學會規劃彈性時間，做自己時間的小主人！',
      '留一點彈性空間給自己，生活中的每一次新嘗試都充滿驚喜！',
      '探索課表之外的多元興趣，發現更多未知的潛能與樂趣！',
    ],
    weeklyQuoteSets: [
      [
        {
          text: '凡事豫則立，不豫則廢。學會自主規劃時間，你就是自己時間的小主人！',
          source: '《禮記・中庸》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E7%A6%AE%E8%A8%98/%E4%B8%AD%E5%BA%B8',
        },
        {
          text: '留一點彈性與空白給生活，往往能遇見意想不到的美好驚喜。',
        },
        {
          text: '勇敢嘗試從未做過的新事物，是發現自己隱藏潛能的最好方式！',
        },
      ],
      [
        {
          text: '時間就像海綿裡的水，只要願意擠，總還是有的。',
          source: '魯迅',
          sourceUrl: 'https://zh.wikiquote.org/zh-hant/%E9%B2%81%E8%BF%85',
        },
        {
          text: '預測未來的最好方法，就是從今天開始親手去創造它。',
          source: '彼得・杜拉克（Peter Drucker）',
          sourceUrl: 'https://en.wikiquote.org/wiki/Peter_Drucker',
        },
        {
          text: '保持開放的心胸去體驗各種志工、社團與探索活動，世界比想像更大！',
        },
      ],
      [
        {
          text: '盛年不重來，一日難再晨。及時當勉勵，歲月不待人。',
          source: '陶淵明《雜詩》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E9%9B%9C%E8%A9%A9%E5%8D%81%E4%BA%8C%E9%A6%96_(%E9%99%B6%E6%B7%B5%E6%98%8E)',
        },
        {
          text: '不怕計畫趕不上變化，懂得靈活調整步伐的人最能享受旅程。',
        },
        {
          text: '每一個小小的自主決定，都在培養你未來獨立思考的大智慧。',
        },
      ],
      [
        {
          text: '滿招損，謙受益，時乃天道。保持謙虛與好奇，每天都能學到新本領！',
          source: '《尚書・大禹謨》',
          sourceUrl: 'https://zh.wikisource.org/zh-hant/%E5%B0%9A%E6%9B%B8/%E5%A4%A7%E7%A6%B9%E8%AC%A8',
        },
        {
          text: '把目標拆成每天都能做到的小任務，任何遠大的夢想都能一步步實現！',
        },
        {
          text: '選擇你所熱愛的事物並投入時間，每一分鐘都會變得意義非凡。',
        },
      ],
    ],
  },
];

// 每個大類保留 1~2 個代表性預設活動，且使用者可在調色盤自由刪除
export const DEFAULT_ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  // 1. 讀書學習 (study) - 2 個
  {
    id: 'act-homework',
    parentId: 'study',
    name: '寫功課',
    zhuyin: 'ㄒㄧㄝˇ ㄍㄨㄥ ㄎㄜˋ',
    english: 'Doing Homework',
    color: '#3B82F6',
    iconName: 'homework',
    defaultDurationMinutes: 60,
  },
  {
    id: 'act-reading',
    parentId: 'study',
    name: '課外閱讀',
    zhuyin: 'ㄎㄜˋ ㄨㄞˋ ㄩㄝˋ ㄉㄨˊ',
    english: 'Reading Books',
    color: '#2563EB',
    iconName: 'reading',
    defaultDurationMinutes: 60,
  },

  // 2. 學校課程 (school) - 1 個
  {
    id: 'act-school-morning',
    parentId: 'school',
    name: '學校上課',
    zhuyin: 'ㄒㄩㄝˊ ㄒㄧㄠˋ ㄕㄤˋ ㄎㄜˋ',
    english: 'School Time',
    color: '#6366F1',
    iconName: 'school',
    defaultDurationMinutes: 240,
  },

  // 3. 運動體能 (sports) - 1 個
  {
    id: 'act-outdoor-sport',
    parentId: 'sports',
    name: '戶外運動',
    zhuyin: 'ㄏㄨˋ ㄨㄞˋ ㄩㄣˋ ㄉㄨㄥˋ',
    english: 'Outdoor Sports',
    color: '#10B981',
    iconName: 'sports',
    defaultDurationMinutes: 60,
  },

  // 4. 才藝創作 (creative) - 2 個
  {
    id: 'act-music',
    parentId: 'creative',
    name: '練琴音樂',
    zhuyin: 'ㄌㄧㄢˋ ㄑㄧㄣˊ ㄧㄣ ㄩㄝˋ',
    english: 'Music Practice',
    color: '#EC4899',
    iconName: 'music',
    defaultDurationMinutes: 60,
  },
  {
    id: 'act-drawing',
    parentId: 'creative',
    name: '繪畫手作',
    zhuyin: 'ㄏㄨㄟˋ ㄏㄨㄚˋ ㄕㄡˇ ㄗㄨㄛˋ',
    english: 'Drawing & Crafts',
    color: '#DB2777',
    iconName: 'art',
    defaultDurationMinutes: 60,
  },

  // 5. 生活日常 (daily) - 2 個
  {
    id: 'act-meals',
    parentId: 'daily',
    name: '營養用餐',
    zhuyin: 'ㄧㄥˊ ㄧㄤˇ ㄩㄥˋ ㄘㄢ',
    english: 'Healthy Meal',
    color: '#F59E0B',
    iconName: 'meal',
    defaultDurationMinutes: 60,
  },
  {
    id: 'act-bath',
    parentId: 'daily',
    name: '盥洗準備',
    zhuyin: 'ㄍㄨㄢˋ ㄒㄧˇ ㄓㄨㄣˇ ㄅㄟˋ',
    english: 'Wash & Get Ready',
    color: '#EA580C',
    iconName: 'bath',
    defaultDurationMinutes: 60,
  },

  // 6. 休閒娛樂 (leisure) - 1 個
  {
    id: 'act-family',
    parentId: 'leisure',
    name: '親子時光',
    zhuyin: 'ㄑㄧㄣ ㄗˇ ㄕˊ ㄍㄨㄤ',
    english: 'Family Time',
    color: '#7C3AED',
    iconName: 'family',
    defaultDurationMinutes: 60,
  },

  // 7. 休息睡眠 (sleep) - 2 個
  {
    id: 'act-night-sleep',
    parentId: 'sleep',
    name: '晚間睡眠',
    zhuyin: 'ㄨㄢˇ ㄐㄧㄢ ㄕㄨㄟˋ ㄇㄧㄢˊ',
    english: 'Night Sleep',
    color: '#0284C7',
    iconName: 'sleep',
    defaultDurationMinutes: 120,
  },
  {
    id: 'act-nap',
    parentId: 'sleep',
    name: '午休小憩',
    zhuyin: 'ㄨˇ ㄒㄧㄡ ㄒㄧㄠˇ ㄑㄧˋ',
    english: 'Power Nap',
    color: '#38BDF8',
    iconName: 'sleep',
    defaultDurationMinutes: 60,
  },

  // 8. 其他 (other) - 1 個
  {
    id: 'act-other',
    parentId: 'other',
    name: '彈性任務',
    zhuyin: 'ㄊㄢˊ ㄒㄧㄥˋ ㄖㄣˋ ㄨˋ',
    english: 'Flexible Task',
    color: '#64748B',
    iconName: 'star',
    defaultDurationMinutes: 60,
  },
];

export const DAYS_OF_WEEK = [
  { index: 0, short: '週一', full: '星期一', zhuyin: 'ㄓㄡ ㄧ', english: 'Monday' },
  { index: 1, short: '週二', full: '星期二', zhuyin: 'ㄓㄡ ㄦˋ', english: 'Tuesday' },
  { index: 2, short: '週三', full: '星期三', zhuyin: 'ㄓㄡ ㄙㄢ', english: 'Wednesday' },
  { index: 3, short: '週四', full: '星期四', zhuyin: 'ㄓㄡ ㄙˋ', english: 'Thursday' },
  { index: 4, short: '週五', full: '星期五', zhuyin: 'ㄓㄡ ㄨˇ', english: 'Friday' },
  { index: 5, short: '週六', full: '星期六', zhuyin: 'ㄓㄡ ㄌㄧㄡˋ', english: 'Saturday' },
  { index: 6, short: '週日', full: '星期日', zhuyin: 'ㄓㄡ ㄖˋ', english: 'Sunday' },
];

/**
 * 預設課表：
 * 每天 晚上 22:00 ~ 24:00 以及 早上 00:00 ~ 07:00 皆預設為「晚間睡眠」
 */
export function createStarterSchedule(): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];

  // Weekdays (Mon-Fri: 0-4)
  for (let day = 0; day <= 4; day++) {
    blocks.push(
      {
        id: `init-${day}-sleep-dawn`,
        dayIndex: day,
        startMinute: 0, // 00:00 - 07:00 (7 hours)
        durationMinutes: 7 * 60,
        activityId: 'act-night-sleep',
        parentId: 'sleep',
        name: '晚間睡眠',
        zhuyin: 'ㄨㄢˇ ㄐㄧㄢ ㄕㄨㄟˋ ㄇㄧㄢˊ',
        english: 'Night Sleep',
        color: '#0284C7',
        iconName: 'sleep',
      },
      {
        id: `init-${day}-morning-prep`,
        dayIndex: day,
        startMinute: 7 * 60, // 07:00 - 08:00
        durationMinutes: 60,
        activityId: 'act-meals',
        parentId: 'daily',
        name: '營養用餐',
        zhuyin: 'ㄧㄥˊ ㄧㄤˇ ㄩㄥˋ ㄘㄢ',
        english: 'Healthy Meal',
        color: '#F59E0B',
        iconName: 'meal',
      },
      {
        id: `init-${day}-school-am`,
        dayIndex: day,
        startMinute: 8 * 60, // 08:00 - 12:00
        durationMinutes: 240,
        activityId: 'act-school-morning',
        parentId: 'school',
        name: '學校上課',
        zhuyin: 'ㄒㄩㄝˊ ㄒㄧㄠˋ ㄕㄤˋ ㄎㄜˋ',
        english: 'School Time',
        color: '#6366F1',
        iconName: 'school',
      },
      {
        id: `init-${day}-lunch`,
        dayIndex: day,
        startMinute: 12 * 60, // 12:00 - 13:30
        durationMinutes: 90,
        activityId: 'act-nap',
        parentId: 'sleep',
        name: '午休小憩',
        zhuyin: 'ㄨˇ ㄒㄧㄡ ㄒㄧㄠˇ ㄑㄧˋ',
        english: 'Power Nap',
        color: '#38BDF8',
        iconName: 'sleep',
      },
      {
        id: `init-${day}-school-pm`,
        dayIndex: day,
        startMinute: 13 * 60 + 30, // 13:30 - 16:00
        durationMinutes: 150,
        activityId: 'act-school-morning',
        parentId: 'school',
        name: '學校上課',
        zhuyin: 'ㄒㄩㄝˊ ㄒㄧㄠˋ ㄕㄤˋ ㄎㄜˋ',
        english: 'School Time',
        color: '#6366F1',
        iconName: 'school',
      },
      {
        id: `init-${day}-sport`,
        dayIndex: day,
        startMinute: 16 * 60, // 16:00 - 17:00
        durationMinutes: 60,
        activityId: 'act-outdoor-sport',
        parentId: 'sports',
        name: '戶外運動',
        zhuyin: 'ㄏㄨˋ ㄨㄞˋ ㄩㄣˋ ㄉㄨㄥˋ',
        english: 'Outdoor Sports',
        color: '#10B981',
        iconName: 'sports',
      },
      {
        id: `init-${day}-homework`,
        dayIndex: day,
        startMinute: 17 * 60, // 17:00 - 18:30
        durationMinutes: 90,
        activityId: 'act-homework',
        parentId: 'study',
        name: '寫功課',
        zhuyin: 'ㄒㄧㄝˇ ㄍㄨㄥ ㄎㄜˋ',
        english: 'Doing Homework',
        color: '#3B82F6',
        iconName: 'homework',
      },
      {
        id: `init-${day}-dinner`,
        dayIndex: day,
        startMinute: 18 * 60 + 30, // 18:30 - 19:30
        durationMinutes: 60,
        activityId: 'act-meals',
        parentId: 'daily',
        name: '營養用餐',
        zhuyin: 'ㄧㄥˊ ㄧㄤˇ ㄩㄥˋ ㄘㄢ',
        english: 'Healthy Meal',
        color: '#F59E0B',
        iconName: 'meal',
      },
      {
        id: `init-${day}-creative`,
        dayIndex: day,
        startMinute: 19 * 60 + 30, // 19:30 - 20:30
        durationMinutes: 60,
        activityId: day % 2 === 0 ? 'act-reading' : 'act-music',
        parentId: day % 2 === 0 ? 'study' : 'creative',
        name: day % 2 === 0 ? '課外閱讀' : '練琴音樂',
        zhuyin: day % 2 === 0 ? 'ㄎㄜˋ ㄨㄞˋ ㄩㄝˋ ㄉㄨˊ' : 'ㄌㄧㄢˋ ㄑㄧㄣˊ ㄧㄣ ㄩㄝˋ',
        english: day % 2 === 0 ? 'Reading Books' : 'Music Practice',
        color: day % 2 === 0 ? '#2563EB' : '#EC4899',
        iconName: day % 2 === 0 ? 'reading' : 'music',
      },
      {
        id: `init-${day}-bath`,
        dayIndex: day,
        startMinute: 20 * 60 + 30, // 20:30 - 22:00
        durationMinutes: 90,
        activityId: 'act-bath',
        parentId: 'daily',
        name: '盥洗準備',
        zhuyin: 'ㄍㄨㄢˋ ㄒㄧˇ ㄓㄨㄣˇ ㄅㄟˋ',
        english: 'Wash & Get Ready',
        color: '#EA580C',
        iconName: 'bath',
      },
      {
        id: `init-${day}-sleep-night`,
        dayIndex: day,
        startMinute: 22 * 60, // 22:00 - 24:00 (2 hours)
        durationMinutes: 2 * 60,
        activityId: 'act-night-sleep',
        parentId: 'sleep',
        name: '晚間睡眠',
        zhuyin: 'ㄨㄢˇ ㄐㄧㄢ ㄕㄨㄟˋ ㄇㄧㄢˊ',
        english: 'Night Sleep',
        color: '#0284C7',
        iconName: 'sleep',
      }
    );
  }

  // Weekend (Sat-Sun: 5-6)
  for (let day = 5; day <= 6; day++) {
    blocks.push(
      {
        id: `init-${day}-sleep-dawn`,
        dayIndex: day,
        startMinute: 0, // 00:00 - 07:00
        durationMinutes: 7 * 60,
        activityId: 'act-night-sleep',
        parentId: 'sleep',
        name: '晚間睡眠',
        zhuyin: 'ㄨㄢˇ ㄐㄧㄢ ㄕㄨㄟˋ ㄇㄧㄢˊ',
        english: 'Night Sleep',
        color: '#0284C7',
        iconName: 'sleep',
      },
      {
        id: `init-${day}-breakfast`,
        dayIndex: day,
        startMinute: 8 * 60, // 08:00 - 09:00
        durationMinutes: 60,
        activityId: 'act-meals',
        parentId: 'daily',
        name: '營養用餐',
        zhuyin: 'ㄧㄥˊ ㄧㄤˇ ㄩㄥˋ ㄘㄢ',
        english: 'Healthy Meal',
        color: '#F59E0B',
        iconName: 'meal',
      },
      {
        id: `init-${day}-study`,
        dayIndex: day,
        startMinute: 9 * 60, // 09:00 - 10:30
        durationMinutes: 90,
        activityId: 'act-reading',
        parentId: 'study',
        name: '課外閱讀',
        zhuyin: 'ㄎㄜˋ ㄨㄞˋ ㄩㄝˋ ㄉㄨˊ',
        english: 'Reading Books',
        color: '#2563EB',
        iconName: 'reading',
      },
      {
        id: `init-${day}-art`,
        dayIndex: day,
        startMinute: 10 * 60 + 30, // 10:30 - 12:00
        durationMinutes: 90,
        activityId: 'act-drawing',
        parentId: 'creative',
        name: '繪畫手作',
        zhuyin: 'ㄏㄨㄟˋ ㄏㄨㄚˋ ㄕㄡˇ ㄗㄨㄛˋ',
        english: 'Drawing & Crafts',
        color: '#DB2777',
        iconName: 'art',
      },
      {
        id: `init-${day}-sports`,
        dayIndex: day,
        startMinute: 14 * 60, // 14:00 - 16:00
        durationMinutes: 120,
        activityId: 'act-outdoor-sport',
        parentId: 'sports',
        name: '戶外運動',
        zhuyin: 'ㄏㄨˋ ㄨㄞˋ ㄩㄣˋ ㄉㄨㄥˋ',
        english: 'Outdoor Sports',
        color: '#10B981',
        iconName: 'sports',
      },
      {
        id: `init-${day}-family`,
        dayIndex: day,
        startMinute: 16 * 60, // 16:00 - 18:00
        durationMinutes: 120,
        activityId: 'act-family',
        parentId: 'leisure',
        name: '親子時光',
        zhuyin: 'ㄑㄧㄣ ㄗˇ ㄕˊ ㄍㄨㄤ',
        english: 'Family Time',
        color: '#7C3AED',
        iconName: 'family',
      },
      {
        id: `init-${day}-sleep-night`,
        dayIndex: day,
        startMinute: 22 * 60, // 22:00 - 24:00
        durationMinutes: 2 * 60,
        activityId: 'act-night-sleep',
        parentId: 'sleep',
        name: '晚間睡眠',
        zhuyin: 'ㄨㄢˇ ㄐㄧㄢ ㄕㄨㄟˋ ㄇㄧㄢˊ',
        english: 'Night Sleep',
        color: '#0284C7',
        iconName: 'sleep',
      }
    );
  }

  return blocks;
}
