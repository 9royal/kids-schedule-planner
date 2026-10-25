import React, { useEffect, useState } from 'react';

// 破音字與常見詞組優先注音詞典（確保「音樂 ㄧㄣ ㄩㄝˋ」、「快樂 ㄎㄨㄞˋ ㄌㄜˋ」、「睡覺 ㄕㄨㄟˋ ㄐㄧㄠˋ」、「旅行 ㄌㄩˇ ㄒㄧㄥˊ」、「調整 ㄊㄧㄠˊ ㄓㄥˇ」、「重要 ㄓㄨㄥˋ ㄧㄠˋ」、「重新 ㄔㄨㄥˊ ㄒㄧㄣ」等讀音精準）
const PHRASE_ZHUYIN_DICT: Record<string, string[]> = {
  '音樂': ['ㄧㄣ', 'ㄩㄝˋ'],
  '樂器': ['ㄩㄝˋ', 'ㄑㄧˋ'],
  '樂團': ['ㄩㄝˋ', 'ㄊㄨㄢˊ'],
  '國樂': ['ㄍㄨㄛˊ', 'ㄩㄝˋ'],
  '西樂': ['ㄒㄧ', 'ㄩㄝˋ'],
  '弦樂': ['ㄒㄧㄢˊ', 'ㄩㄝˋ'],
  '管樂': ['ㄍㄨㄢˇ', 'ㄩㄝˋ'],
  '打擊樂': ['ㄉㄚˇ', 'ㄐㄧˊ', 'ㄩㄝˋ'],
  '快樂': ['ㄎㄨㄞˋ', 'ㄌㄜˋ'],
  '娛樂': ['ㄩˊ', 'ㄌㄜˋ'],
  '玩樂': ['ㄨㄢˊ', 'ㄌㄜˋ'],
  '歡樂': ['ㄏㄨㄢ', 'ㄌㄜˋ'],
  '好之者': ['ㄏㄠˋ', 'ㄓ', 'ㄓㄜˇ'],
  '樂之者': ['ㄌㄜˋ', 'ㄓ', 'ㄓㄜˇ'],
  '睡覺': ['ㄕㄨㄟˋ', 'ㄐㄧㄠˋ'],
  '午覺': ['ㄨˇ', 'ㄐㄧㄠˋ'],
  '一覺': ['ㄧ', 'ㄐㄧㄠˋ'],
  '感覺': ['ㄍㄢˇ', 'ㄐㄩㄝˊ'],
  '覺得': ['ㄐㄩㄝˊ', '˙ㄉㄜ'],
  '發覺': ['ㄈㄚ', 'ㄐㄩㄝˊ'],
  '不知不覺': ['ㄅㄨˋ', 'ㄓ', 'ㄅㄨˋ', 'ㄐㄩㄝˊ'],
  '排行榜': ['ㄆㄞˊ', 'ㄏㄤˊ', 'ㄅㄤˇ'],
  '排行': ['ㄆㄞˊ', 'ㄏㄤˊ'],
  '銀行': ['ㄧㄣˊ', 'ㄏㄤˊ'],
  '旅行': ['ㄌㄩˇ', 'ㄒㄧㄥˊ'],
  '健行': ['ㄐㄧㄢˋ', 'ㄒㄧㄥˊ'],
  '自行車': ['ㄗˋ', 'ㄒㄧㄥˊ', 'ㄔㄜ'],
  '行動': ['ㄒㄧㄥˊ', 'ㄉㄨㄥˋ'],
  '進行': ['ㄐㄧㄣˋ', 'ㄒㄧㄥˊ'],
  '千里之行': ['ㄑㄧㄢ', 'ㄌㄧˇ', 'ㄓ', 'ㄒㄧㄥˊ'],
  '三人行': ['ㄙㄢ', 'ㄖㄣˊ', 'ㄒㄧㄥˊ'],
  '天行健': ['ㄊㄧㄢ', 'ㄒㄧㄥˊ', 'ㄐㄧㄢˋ'],
  '篤行': ['ㄉㄨˇ', 'ㄒㄧㄥˊ'],
  '行成於思': ['ㄒㄧㄥˊ', 'ㄔㄥˊ', 'ㄩˊ', 'ㄙ'],
  '彈琴': ['ㄊㄢˊ', 'ㄑㄧㄣˊ'],
  '彈鋼琴': ['ㄊㄢˊ', 'ㄍㄤ', 'ㄑㄧㄣˊ'],
  '彈性': ['ㄊㄢˊ', 'ㄒㄧㄥˋ'],
  '子彈': ['ㄗˇ', 'ㄉㄢˋ'],
  '時間': ['ㄕˊ', 'ㄐㄧㄢ'],
  '房間': ['ㄈㄤˊ', 'ㄐㄧㄢ'],
  '中間': ['ㄓㄨㄥ', 'ㄐㄧㄢ'],
  '間隔': ['ㄐㄧㄢˋ', 'ㄍㄜˊ'],
  '數數': ['ㄕㄨˇ', 'ㄕㄨˋ'],
  '數學': ['ㄕㄨˋ', 'ㄒㄩㄝˊ'],
  '分數': ['ㄈㄣ', 'ㄕㄨˋ'],
  '成長': ['ㄔㄥˊ', 'ㄓㄤˇ'],
  '長大': ['ㄓㄤˇ', 'ㄉㄚˋ'],
  '長高': ['ㄓㄤˇ', 'ㄍㄠ'],
  '長得': ['ㄓㄤˇ', '˙ㄉㄜ'],
  '生長': ['ㄕㄥ', 'ㄓㄤˇ'],
  '所長': ['ㄙㄨㄛˇ', 'ㄔㄤˊ'],
  '師長': ['ㄕ', 'ㄓㄤˇ'],
  '家長': ['ㄐㄧㄚ', 'ㄓㄤˇ'],
  '班長': ['ㄅㄢ', 'ㄓㄤˇ'],
  '隊長': ['ㄉㄨㄟˋ', 'ㄓㄤˇ'],
  '長笛': ['ㄔㄤˊ', 'ㄉㄧˊ'],
  '時長': ['ㄕˊ', 'ㄔㄤˊ'],
  '長跑': ['ㄔㄤˊ', 'ㄆㄠˇ'],
  '假期': ['ㄐㄧㄚˋ', 'ㄑㄧˊ'],
  '放假': ['ㄈㄤˋ', 'ㄐㄧㄚˋ'],
  '暑假': ['ㄕㄨˇ', 'ㄐㄧㄚˋ'],
  '寒假': ['ㄏㄢˊ', 'ㄐㄧㄚˋ'],
  '假裝': ['ㄐㄧㄚˇ', 'ㄓㄨㄤ'],
  '背包': ['ㄅㄟ', 'ㄅㄠ'],
  '背書': ['ㄅㄟˋ', 'ㄕㄨ'],
  '背單字': ['ㄅㄟˋ', 'ㄉㄢ', 'ㄗˋ'],
  '背下': ['ㄅㄟˋ', 'ㄒㄧㄚˋ'],
  '背誦': ['ㄅㄟˋ', 'ㄙㄨㄥˋ'],
  '喝水': ['ㄏㄜ', 'ㄕㄨㄟˇ'],
  '喝茶': ['ㄏㄜ', 'ㄔㄚˊ'],
  '喝牛奶': ['ㄏㄜ', 'ㄋㄧㄡˊ', 'ㄋㄞˇ'],
  '合唱': ['ㄏㄜˊ', 'ㄔㄤˋ'],
  '合作': ['ㄏㄜˊ', 'ㄗㄨㄛˋ'],
  '重要': ['ㄓㄨㄥˋ', 'ㄧㄠˋ'],
  '重視': ['ㄓㄨㄥˋ', 'ㄕˋ'],
  '重新': ['ㄔㄨㄥˊ', 'ㄒㄧㄣ'],
  '重來': ['ㄔㄨㄥˊ', 'ㄌㄞˊ'],
  '寶藏': ['ㄅㄠˇ', 'ㄗㄤˋ'],
  '隱藏': ['ㄧㄣˇ', 'ㄘㄤˊ'],
  '調整': ['ㄊㄧㄠˊ', 'ㄓㄥˇ'],
  '挑戰': ['ㄊㄧㄠˇ', 'ㄓㄢˋ'],
  '好學': ['ㄏㄠˋ', 'ㄒㄩㄝˊ'],
  '好奇': ['ㄏㄠˋ', 'ㄑㄧˊ'],
  '相處': ['ㄒㄧㄤ', 'ㄔㄨˇ'],
  '來處': ['ㄌㄞˊ', 'ㄔㄨˋ'],
  '切磋': ['ㄑㄧㄝ', 'ㄘㄨㄛ'],
  '一切': ['ㄧ', 'ㄑㄧㄝˋ'],
  '為師': ['ㄨㄟˊ', 'ㄕ'],
  '成為': ['ㄔㄥˊ', 'ㄨㄟˊ'],
  '為了': ['ㄨㄟˋ', '˙ㄌㄜ'],
  '因為': ['ㄧㄣ', 'ㄨㄟˋ'],
  '鑰匙': ['ㄧㄠˋ', '˙ㄕ'],
  '湯匙': ['ㄊㄤ', 'ㄔˊ'],
};

// 擴充教育部標準常用繁體中文字典（完整涵蓋校園、生活、運動、才藝、飲食、品德、自然、家庭與全部格言佳句字彙）
const ZHUYIN_DICT: Record<string, string> = Object.fromEntries([
  ['讀', 'ㄉㄨˊ'], ['書', 'ㄕㄨ'], ['學', 'ㄒㄩㄝˊ'], ['習', 'ㄒㄧˊ'],
  ['校', 'ㄒㄧㄠˋ'], ['課', 'ㄎㄜˋ'], ['程', 'ㄔㄥˊ'], ['上', 'ㄕㄤˋ'],
  ['運', 'ㄩㄣˋ'], ['動', 'ㄉㄨㄥˋ'], ['體', 'ㄊㄧˇ'], ['能', 'ㄋㄥˊ'],
  ['才', 'ㄘㄞˊ'], ['藝', 'ㄧˋ'], ['創', 'ㄔㄨㄤˋ'], ['作', 'ㄗㄨㄛˋ'],
  ['生', 'ㄕㄥ'], ['活', 'ㄏㄨㄛˊ'], ['日', 'ㄖˋ'], ['常', 'ㄔㄤˊ'],
  ['休', 'ㄒㄧㄡ'], ['閒', 'ㄒㄧㄢˊ'], ['娛', 'ㄩˊ'], ['樂', 'ㄌㄜˋ'],
  ['息', 'ㄒㄧˊ'], ['睡', 'ㄕㄨㄟˋ'], ['眠', 'ㄇㄧㄢˊ'], ['覺', 'ㄐㄧㄠˋ'],
  ['其', 'ㄑㄧˊ'], ['他', 'ㄊㄚ'], ['寫', 'ㄒㄧㄝˇ'], ['功', 'ㄍㄨㄥ'],
  ['外', 'ㄨㄞˋ'], ['閱', 'ㄩㄝˋ'], ['英', 'ㄧㄥ'], ['語', 'ㄩˇ'],
  ['文', 'ㄨㄣˊ'], ['數', 'ㄕㄨˋ'], ['自', 'ㄗˋ'], ['然', 'ㄖㄢˊ'],
  ['社', 'ㄕㄜˋ'], ['會', 'ㄏㄨㄟˋ'], ['團', 'ㄊㄨㄢˊ'], ['後', 'ㄏㄡˋ'],
  ['戶', 'ㄏㄨˋ'], ['游', 'ㄧㄡˊ'], ['泳', 'ㄩㄥˇ'], ['跳', 'ㄊㄧㄠˋ'],
  ['繩', 'ㄕㄥˊ'], ['球', 'ㄑㄧㄡˊ'], ['籃', 'ㄌㄢˊ'], ['足', 'ㄗㄨˊ'],
  ['羽', 'ㄩˇ'], ['跑', 'ㄆㄠˇ'], ['步', 'ㄅㄨˋ'], ['練', 'ㄌㄧㄢˋ'],
  ['琴', 'ㄑㄧㄣˊ'], ['音', 'ㄧㄣ'], ['繪', 'ㄏㄨㄟˋ'], ['畫', 'ㄏㄨㄚˋ'],
  ['手', 'ㄕㄡˇ'], ['營', 'ㄧㄥˊ'], ['養', 'ㄧㄤˇ'], ['用', 'ㄩㄥˋ'],
  ['餐', 'ㄘㄢ'], ['吃', 'ㄔ'], ['飯', 'ㄈㄢˋ'], ['早', 'ㄗㄠˇ'],
  ['午', 'ㄨˇ'], ['晚', 'ㄨㄢˇ'], ['幫', 'ㄅㄤ'], ['忙', 'ㄇㄤˊ'],
  ['家', 'ㄐㄧㄚ'], ['事', 'ㄕˋ'], ['盥', 'ㄍㄨㄢˋ'], ['洗', 'ㄒㄧˇ'],
  ['澡', 'ㄗㄠˇ'], ['準', 'ㄓㄨㄣˇ'], ['備', 'ㄅㄟˋ'], ['由', 'ㄧㄡˊ'],
  ['遊', 'ㄧㄡˊ'], ['戲', 'ㄒㄧˋ'], ['親', 'ㄑㄧㄣ'], ['子', 'ㄗˇ'],
  ['時', 'ㄕˊ'], ['光', 'ㄍㄨㄤ'], ['小', 'ㄒㄧㄠˇ'], ['憩', 'ㄑㄧˋ'],
  ['間', 'ㄐㄧㄢ'], ['彈', 'ㄊㄢˊ'], ['性', 'ㄒㄧㄥˋ'], ['任', 'ㄖㄣˋ'],
  ['務', 'ㄨˋ'], ['補', 'ㄅㄨˇ'], ['班', 'ㄅㄢ'], ['安', 'ㄢ'],
  ['鋼', 'ㄍㄤ'], ['舞', 'ㄨˇ'], ['蹈', 'ㄉㄠˋ'], ['圍', 'ㄨㄟˊ'],
  ['棋', 'ㄑㄧˊ'], ['積', 'ㄐㄧ'], ['木', 'ㄇㄨˋ'], ['電', 'ㄉㄧㄢˋ'],
  ['腦', 'ㄋㄠˇ'], ['視', 'ㄕˋ'], ['散', 'ㄙㄢˋ'], ['預', 'ㄩˋ'],
  ['複', 'ㄈㄨˋ'], ['考', 'ㄎㄠˇ'], ['試', 'ㄕˋ'], ['刷', 'ㄕㄨㄚ'],
  ['牙', 'ㄧㄚˊ'], ['收', 'ㄕㄡ'], ['包', 'ㄅㄠ'], ['探', 'ㄊㄢˋ'],
  ['索', 'ㄙㄨㄛˇ'], ['規', 'ㄍㄨㄟ'], ['劃', 'ㄏㄨㄚˋ'], ['系', 'ㄒㄧˋ'],
  ['統', 'ㄊㄨㄥˇ'], ['主', 'ㄓㄨˇ'], ['週', 'ㄓㄡ'], ['一', 'ㄧ'],
  ['二', 'ㄦˋ'], ['三', 'ㄙㄢ'], ['四', 'ㄙˋ'], ['五', 'ㄨˇ'],
  ['六', 'ㄌㄧㄡˋ'], ['七', 'ㄑㄧ'], ['八', 'ㄅㄚ'], ['九', 'ㄐㄧㄡˇ'],
  ['十', 'ㄕˊ'], ['百', 'ㄅㄞˇ'], ['千', 'ㄑㄧㄢ'], ['萬', 'ㄨㄢˋ'],
  ['看', 'ㄎㄢˋ'], ['板', 'ㄅㄢˇ'], ['排', 'ㄆㄞˊ'], ['行', 'ㄏㄤˊ'],
  ['榜', 'ㄅㄤˇ'], ['教', 'ㄐㄧㄠˋ'], ['表', 'ㄅㄧㄠˇ'], ['現', 'ㄒㄧㄢˋ'],
  ['在', 'ㄗㄞˋ'], ['為', 'ㄨㄟˋ'], ['了', '˙ㄌㄜ'], ['走', 'ㄗㄡˇ'],
  ['更', 'ㄍㄥˋ'], ['遠', 'ㄩㄢˇ'], ['的', '˙ㄉㄜ'], ['路', 'ㄌㄨˋ'],
  ['身', 'ㄕㄣ'], ['高', 'ㄍㄠ'], ['打', 'ㄉㄚˇ'], ['下', 'ㄒㄧㄚˋ'],
  ['良', 'ㄌㄧㄤˊ'], ['好', 'ㄏㄠˇ'], ['基', 'ㄐㄧ'], ['礎', 'ㄔㄨˇ'],
  ['與', 'ㄩˇ'], ['國', 'ㄍㄨㄛˊ'], ['字', 'ㄗˋ'], ['背', 'ㄅㄟˋ'],
  ['單', 'ㄉㄢ'], ['聽', 'ㄊㄧㄥ'], ['力', 'ㄌㄧˋ'], ['法', 'ㄈㄚˇ'],
  ['美', 'ㄇㄟˇ'], ['術', 'ㄕㄨˋ'], ['勞', 'ㄌㄠˊ'], ['科', 'ㄎㄜ'],
  ['實', 'ㄕˊ'], ['驗', 'ㄧㄢˋ'], ['直', 'ㄓˊ'], ['輪', 'ㄌㄨㄣˊ'],
  ['腳', 'ㄐㄧㄠˇ'], ['踏', 'ㄊㄚˋ'], ['車', 'ㄔㄜ'], ['桌', 'ㄓㄨㄛ'],
  ['網', 'ㄨㄤˇ'], ['棒', 'ㄅㄤˋ'], ['操', 'ㄘㄠ'], ['跆', 'ㄊㄞˊ'],
  ['拳', 'ㄑㄩㄢˊ'], ['道', 'ㄉㄠˋ'], ['提', 'ㄊㄧˊ'], ['笛', 'ㄉㄧˊ'],
  ['鼓', 'ㄍㄨˇ'], ['唱', 'ㄔㄤˋ'], ['歌', 'ㄍㄜ'], ['折', 'ㄓㄜˊ'],
  ['紙', 'ㄓˇ'], ['黏', 'ㄋㄧㄢˊ'], ['土', 'ㄊㄨˇ'], ['編', 'ㄅㄧㄢ'],
  ['機', 'ㄐㄧ'], ['器', 'ㄑㄧˋ'], ['人', 'ㄖㄣˊ'], ['整', 'ㄓㄥˇ'],
  ['理', 'ㄌㄧˇ'], ['房', 'ㄈㄤˊ'], ['掃', 'ㄙㄠˇ'], ['地', 'ㄉㄧˋ'],
  ['拖', 'ㄊㄨㄛ'], ['倒', 'ㄉㄠˋ'], ['垃', 'ㄌㄜˋ'], ['圾', 'ㄙㄜˋ'],
  ['澆', 'ㄐㄧㄠ'], ['花', 'ㄏㄨㄚ'], ['遛', 'ㄌㄧㄡˋ'], ['狗', 'ㄍㄡˇ'],
  ['漫', 'ㄇㄢˋ'], ['卡', 'ㄎㄚˇ'], ['通', 'ㄊㄨㄥ'], ['影', 'ㄧㄥˇ'],
  ['公', 'ㄍㄨㄥ'], ['園', 'ㄩㄢˊ'], ['露', 'ㄌㄨˋ'], ['野', 'ㄧㄝˇ'],
  ['拼', 'ㄆㄧㄣ'], ['圖', 'ㄊㄨˊ'], ['故', 'ㄍㄨˋ'], ['旅', 'ㄌㄩˇ'],
  ['晨', 'ㄔㄣˊ'], ['夜', 'ㄧㄝˋ'], ['點', 'ㄉㄧㄢˇ'],
  ['心', 'ㄒㄧㄣ'], ['水', 'ㄕㄨㄟˇ'], ['果', 'ㄍㄨㄛˇ'], ['牛', 'ㄋㄧㄡˊ'],
  ['奶', 'ㄋㄞˇ'], ['茶', 'ㄔㄚˊ'], ['喝', 'ㄏㄜ'], ['買', 'ㄇㄞˇ'],
  ['東', 'ㄉㄨㄥ'], ['西', 'ㄒㄧ'], ['南', 'ㄋㄢˊ'], ['北', 'ㄅㄟˇ'],
  ['中', 'ㄓㄨㄥ'], ['大', 'ㄉㄚˋ'], ['多', 'ㄉㄨㄛ'], ['少', 'ㄕㄠˇ'],
  ['長', 'ㄔㄤˊ'], ['短', 'ㄉㄨㄢˇ'], ['快', 'ㄎㄨㄞˋ'], ['慢', 'ㄇㄢˋ'],
  ['新', 'ㄒㄧㄣ'], ['舊', 'ㄐㄧㄡˋ'], ['真', 'ㄓㄣ'], ['假', 'ㄐㄧㄚˇ'],
  ['開', 'ㄎㄞ'], ['關', 'ㄍㄨㄢ'], ['進', 'ㄐㄧㄣˋ'], ['出', 'ㄔㄨ'],
  ['來', 'ㄌㄞˊ'], ['去', 'ㄑㄩˋ'], ['回', 'ㄏㄨㄟˊ'], ['到', 'ㄉㄠˋ'],
  ['說', 'ㄕㄨㄛ'], ['話', 'ㄏㄨㄚˋ'], ['講', 'ㄐㄧㄤˇ'], ['問', 'ㄨㄣˋ'],
  ['答', 'ㄉㄚˊ'], ['想', 'ㄒㄧㄤˇ'], ['知', 'ㄓ'], ['思', 'ㄙ'],
  ['愛', 'ㄞˋ'], ['喜', 'ㄒㄧˇ'], ['歡', 'ㄏㄨㄢ'], ['笑', 'ㄒㄧㄠˋ'],
  ['哭', 'ㄎㄨ'], ['怒', 'ㄋㄨˋ'], ['驚', 'ㄐㄧㄥ'], ['怕', 'ㄆㄚˋ'],
  ['天', 'ㄊㄧㄢ'], ['氣', 'ㄑㄧˋ'], ['風', 'ㄈㄥ'], ['雨', 'ㄩˇ'],
  ['雲', 'ㄩㄣˊ'], ['雪', 'ㄒㄩㄝˇ'], ['山', 'ㄕㄢ'], ['河', 'ㄏㄜˊ'],
  ['海', 'ㄏㄞˇ'], ['湖', 'ㄏㄨˊ'], ['樹', 'ㄕㄨˋ'], ['林', 'ㄌㄧㄣˊ'],
  ['草', 'ㄘㄠˇ'], ['鳥', 'ㄋㄧㄠˇ'], ['魚', 'ㄩˊ'], ['蟲', 'ㄔㄨㄥˊ'],
  ['貓', 'ㄇㄠ'], ['兔', 'ㄊㄨˋ'], ['馬', 'ㄇㄚˇ'], ['羊', 'ㄧㄤˊ'],
  ['雞', 'ㄐㄧ'], ['鴨', 'ㄧㄚ'], ['豬', 'ㄓㄨ'], ['虎', 'ㄏㄨˇ'],
  ['龍', 'ㄌㄨㄥˊ'], ['獅', 'ㄕ'], ['象', 'ㄒㄧㄤˋ'], ['熊', 'ㄒㄩㄥˊ'],
  ['爸', 'ㄅㄚˋ'], ['媽', 'ㄇㄚ'], ['父', 'ㄈㄨˋ'], ['母', 'ㄇㄨˇ'],
  ['爺', 'ㄧㄝˊ'], ['哥', 'ㄍㄜ'], ['姐', 'ㄐㄧㄝˇ'],
  ['弟', 'ㄉㄧˋ'], ['妹', 'ㄇㄟˋ'], ['友', 'ㄧㄡˇ'], ['朋', 'ㄆㄥˊ'],
  ['師', 'ㄕ'], ['同', 'ㄊㄨㄥˊ'], ['伴', 'ㄅㄢˋ'], ['隊', 'ㄉㄨㄟˋ'],
  ['衣', 'ㄧ'], ['服', 'ㄈㄨˊ'], ['穿', 'ㄔㄨㄢ'], ['鞋', 'ㄒㄧㄝˊ'],
  ['襪', 'ㄨㄚˋ'], ['帽', 'ㄇㄠˋ'], ['床', 'ㄔㄨㄤˊ'], ['被', 'ㄅㄟˋ'],
  ['枕', 'ㄓㄣˇ'], ['頭', 'ㄊㄡˊ'], ['臉', 'ㄌㄧㄢˇ'], ['眼', 'ㄧㄢˇ'],
  ['睛', 'ㄐㄧㄥ'], ['耳', 'ㄦˇ'], ['朵', 'ㄉㄨㄛˇ'], ['鼻', 'ㄅㄧˊ'],
  ['口', 'ㄎㄡˇ'], ['嘴', 'ㄗㄨㄟˇ'], ['舌', 'ㄕㄜˊ'], ['髮', 'ㄈㄚˇ'],
  ['肚', 'ㄉㄨˋ'], ['腰', 'ㄧㄠ'], ['腿', 'ㄊㄨㄟˇ'],
  ['膝', 'ㄒㄧ'], ['腕', 'ㄨㄢˋ'], ['指', 'ㄓˇ'], ['汗', 'ㄏㄢˋ'],
  ['醫', 'ㄧ'], ['院', 'ㄩㄢˋ'], ['藥', 'ㄧㄠˋ'], ['健', 'ㄐㄧㄢˋ'],
  ['康', 'ㄎㄤ'], ['護', 'ㄏㄨˋ'],
  ['育', 'ㄩˋ'], ['館', 'ㄍㄨㄢˇ'], ['場', 'ㄔㄤˇ'], ['室', 'ㄕˋ'],
  ['廳', 'ㄊㄧㄥ'], ['廚', 'ㄔㄨˊ'], ['衛', 'ㄨㄟˋ'], ['浴', 'ㄩˋ'],
  ['門', 'ㄇㄣˊ'], ['窗', 'ㄔㄨㄤ'], ['燈', 'ㄉㄥ'], ['椅', 'ㄧˇ'],
  ['筆', 'ㄅㄧˇ'], ['記', 'ㄐㄧˋ'], ['本', 'ㄅㄣˇ'], ['尺', 'ㄔˇ'],
  ['刀', 'ㄉㄠ'], ['剪', 'ㄐㄧㄢˇ'], ['膠', 'ㄐㄧㄠ'], ['帶', 'ㄉㄞˋ'],
  ['色', 'ㄙㄜˋ'], ['紅', 'ㄏㄨㄥˊ'], ['黃', 'ㄏㄨㄤˊ'], ['藍', 'ㄌㄢˊ'],
  ['綠', 'ㄌㄩˋ'], ['紫', 'ㄗˇ'], ['白', 'ㄅㄞˊ'], ['黑', 'ㄏㄟ'],
  ['灰', 'ㄏㄨㄟ'], ['粉', 'ㄈㄣˇ'], ['金', 'ㄐㄧㄣ'], ['銀', 'ㄧㄣˊ'],
  ['銅', 'ㄊㄨㄥˊ'], ['鐵', 'ㄊㄧㄝˇ'], ['石', 'ㄕˊ'], ['沙', 'ㄕㄚ'],
  ['春', 'ㄔㄨㄣ'], ['夏', 'ㄒㄧㄚˋ'], ['秋', 'ㄑㄧㄡ'], ['冬', 'ㄉㄨㄥ'],
  ['年', 'ㄋㄧㄢˊ'], ['月', 'ㄩㄝˋ'], ['星', 'ㄒㄧㄥ'], ['期', 'ㄑㄧˊ'],
  ['今', 'ㄐㄧㄣ'], ['明', 'ㄇㄧㄥˊ'], ['昨', 'ㄗㄨㄛˊ'],
  ['前', 'ㄑㄧㄢˊ'], ['左', 'ㄗㄨㄛˇ'], ['右', 'ㄧㄡˋ'], ['旁', 'ㄆㄤˊ'],
  ['內', 'ㄋㄟˋ'], ['裡', 'ㄌㄧˇ'], ['邊', 'ㄅㄧㄢ'], ['角', 'ㄐㄧㄠˇ'],
  ['分', 'ㄈㄣ'], ['秒', 'ㄇㄧㄠˇ'], ['鐘', 'ㄓㄨㄥ'], ['刻', 'ㄎㄜˋ'],
  ['半', 'ㄅㄢˋ'], ['全', 'ㄑㄩㄢˊ'], ['部', 'ㄅㄨˋ'], ['每', 'ㄇㄟˇ'],
  ['次', 'ㄘˋ'], ['遍', 'ㄅㄧㄢˋ'], ['趟', 'ㄊㄤˋ'],
  ['個', '˙ㄍㄜ'], ['位', 'ㄨㄟˋ'], ['名', 'ㄇㄧㄥˊ'], ['號', 'ㄏㄠˋ'],
  ['級', 'ㄐㄧˊ'], ['座', 'ㄗㄨㄛˋ'], ['組', 'ㄗㄨˇ'], ['群', 'ㄑㄩㄣˊ'],
  ['定', 'ㄉㄧㄥˋ'], ['計', 'ㄐㄧˋ'], ['目', 'ㄇㄨˋ'], ['標', 'ㄅㄧㄠ'],
  ['成', 'ㄔㄥˊ'], ['獎', 'ㄐㄧㄤˇ'], ['勵', 'ㄌㄧˋ'],
  ['讚', 'ㄗㄢˋ'], ['優', 'ㄧㄡ'], ['秀', 'ㄒㄧㄡˋ'],
  ['努', 'ㄋㄨˇ'], ['堅', 'ㄐㄧㄢ'], ['持', 'ㄔˊ'], ['專', 'ㄓㄨㄢ'],
  ['注', 'ㄓㄨˋ'], ['認', 'ㄖㄣˋ'], ['負', 'ㄈㄨˋ'], ['責', 'ㄗㄜˊ'],
  ['禮', 'ㄌㄧˇ'], ['貌', 'ㄇㄠˋ'], ['誠', 'ㄔㄥˊ'], ['信', 'ㄒㄧㄣˋ'],
  ['勇', 'ㄩㄥˇ'], ['敢', 'ㄍㄢˇ'], ['溫', 'ㄨㄣ'], ['柔', 'ㄖㄡˊ'],
  ['感', 'ㄍㄢˇ'], ['恩', 'ㄣ'], ['惜', 'ㄒㄧˊ'], ['福', 'ㄈㄨˊ'],
  ['靜', 'ㄐㄧㄥˋ'], ['坐', 'ㄗㄨㄛˋ'], ['冥', 'ㄇㄧㄥˊ'], ['呼', 'ㄏㄨ'],
  ['伸', 'ㄕㄣ'], ['展', 'ㄓㄢˇ'], ['拉', 'ㄌㄚ'], ['筋', 'ㄐㄧㄣ'],
  ['暖', 'ㄋㄨㄢˇ'], ['拾', 'ㄕˊ'], ['碗', 'ㄨㄢˇ'],
  ['盤', 'ㄆㄢˊ'], ['筷', 'ㄎㄨㄞˋ'], ['湯', 'ㄊㄤ'], ['匙', 'ㄔˊ'],
  ['摺', 'ㄓㄜˊ'], ['疊', 'ㄉㄧㄝˊ'], ['晾', 'ㄌㄧㄤˋ'], ['曬', 'ㄕㄞˋ'],
  ['擦', 'ㄘㄚ'], ['拭', 'ㄕˋ'], ['吸', 'ㄒㄧ'], ['塵', 'ㄔㄣˊ'],
  ['餵', 'ㄨㄟˋ'], ['寵', 'ㄔㄨㄥˇ'], ['物', 'ㄨˋ'], ['盆', 'ㄆㄣˊ'],
  ['栽', 'ㄗㄞ'], ['種', 'ㄓㄨㄥˋ'], ['植', 'ㄓˊ'], ['觀', 'ㄍㄨㄢ'],
  ['察', 'ㄔㄚˊ'], ['紀', 'ㄐㄧˋ'], ['錄', 'ㄌㄨˋ'],
  ['得', 'ㄉㄜˊ'], ['報', 'ㄅㄠˋ'], ['告', 'ㄍㄠˋ'], ['演', 'ㄧㄢˇ'],
  ['朗', 'ㄌㄤˇ'], ['誦', 'ㄙㄨㄥˋ'], ['詩', 'ㄕ'],
  ['詞', 'ㄘˊ'], ['古', 'ㄍㄨˇ'],
  ['典', 'ㄉㄧㄢˇ'], ['查', 'ㄔㄚˊ'],
  ['資', 'ㄗ'], ['料', 'ㄌㄧㄠˋ'],
  ['線', 'ㄒㄧㄢˋ'], ['訊', 'ㄒㄩㄣˋ'],
  ['討', 'ㄊㄠˇ'], ['論', 'ㄌㄨㄣˋ'], ['發', 'ㄈㄚ'],
  ['合', 'ㄏㄜˊ'], ['烏', 'ㄨ'],
  ['克', 'ㄎㄜˋ'], ['麗', 'ㄌㄧˋ'], ['吉', 'ㄐㄧˊ'],
  ['爵', 'ㄐㄩㄝˊ'], ['士', 'ㄕˋ'], ['街', 'ㄐㄧㄝ'],
  ['芭', 'ㄅㄚ'], ['蕾', 'ㄌㄟˇ'], ['民', 'ㄇㄧㄣˊ'],
  ['族', 'ㄗㄨˊ'], ['扯', 'ㄔㄜˇ'], ['鈴', 'ㄌㄧㄥˊ'], ['陀', 'ㄊㄨㄛˊ'],
  ['螺', 'ㄌㄨㄛˊ'], ['溜', 'ㄌㄧㄡ'],
  ['魔', 'ㄇㄛˊ'], ['方', 'ㄈㄤ'], ['塊', 'ㄎㄨㄞˋ'],
  ['豆', 'ㄉㄡˋ'], ['彩', 'ㄘㄞˇ'], ['素', 'ㄙㄨˋ'], ['描', 'ㄇㄧㄠˊ'],
  ['蠟', 'ㄌㄚˋ'], ['鉛', 'ㄑㄧㄢ'],
  ['毛', 'ㄇㄠˊ'], ['硬', 'ㄧㄥˋ'], ['陶', 'ㄊㄠˊ'],
  ['工', 'ㄍㄨㄥ'], ['縫', 'ㄈㄥˊ'], ['紉', 'ㄖㄣˋ'],
  ['烘', 'ㄏㄨㄥ'], ['焙', 'ㄅㄟˋ'],
  ['做', 'ㄗㄨㄛˋ'], ['蛋', 'ㄉㄢˋ'],
  ['糕', 'ㄍㄠ'], ['餅', 'ㄅㄧㄥˇ'], ['乾', 'ㄍㄢ'], ['麵', 'ㄇㄧㄢˋ'],
  ['治', 'ㄓˋ'], ['汁', 'ㄓ'],
  ['漿', 'ㄐㄧㄤ'], ['米', 'ㄇㄧˇ'],
  ['條', 'ㄊㄧㄠˊ'], ['餃', 'ㄐㄧㄠˇ'], ['饅', 'ㄇㄢˊ'],
  ['是', 'ㄕˋ'], ['只', 'ㄓˇ'],
  ['要', 'ㄧㄠˋ'], ['有', 'ㄧㄡˇ'], ['沒', 'ㄇㄟˊ'], ['不', 'ㄅㄨˋ'],
  ['也', 'ㄧㄝˇ'], ['都', 'ㄉㄡ'], ['很', 'ㄏㄣˇ'], ['最', 'ㄗㄨㄟˋ'],
  ['太', 'ㄊㄞˋ'], ['非', 'ㄈㄟ'],
  ['把', 'ㄅㄚˇ'], ['讓', 'ㄖㄤˋ'], ['給', 'ㄍㄟˇ'],
  ['從', 'ㄘㄨㄥˊ'], ['向', 'ㄒㄧㄤˋ'], ['往', 'ㄨㄤˇ'], ['朝', 'ㄔㄠˊ'],
  ['對', 'ㄉㄨㄟˋ'], ['於', 'ㄩˊ'], ['和', 'ㄏㄢˋ'], ['跟', 'ㄍㄣ'],
  ['或', 'ㄏㄨㄛˋ'], ['但', 'ㄉㄢˋ'], ['卻', 'ㄑㄩㄝˋ'], ['因', 'ㄧㄣ'],
  ['所', 'ㄙㄨㄛˇ'], ['以', 'ㄧˇ'], ['如', 'ㄖㄨˊ'],
  ['雖', 'ㄙㄨㄟ'], ['還', 'ㄏㄞˊ'], ['就', 'ㄐㄧㄡˋ'],
  ['又', 'ㄧㄡˋ'], ['再', 'ㄗㄞˋ'], ['已', 'ㄧˇ'],
  ['經', 'ㄐㄧㄥ'], ['正', 'ㄓㄥˋ'], ['將', 'ㄐㄧㄤ'],
  ['可', 'ㄎㄜˇ'], ['應', 'ㄧㄥ'], ['該', 'ㄍㄞ'],
  ['必', 'ㄅㄧˋ'], ['須', 'ㄒㄩ'], ['需', 'ㄒㄩ'], ['願', 'ㄩㄢˋ'],
  ['意', 'ㄧˋ'], ['肯', 'ㄎㄣˇ'], ['請', 'ㄑㄧㄥˇ'],
  ['謝', 'ㄒㄧㄝˋ'], ['起', 'ㄑㄧˇ'], ['見', 'ㄐㄧㄢˋ'],
  // 格言佳句與成語經典完整擴充字彙
  ['而', 'ㄦˊ'], ['急', 'ㄐㄧˊ'], ['徐', 'ㄒㄩˊ'], ['題', 'ㄊㄧˊ'],
  ['弄', 'ㄋㄨㄥˋ'], ['懂', 'ㄉㄨㄥˇ'], ['態', 'ㄊㄞˋ'], ['度', 'ㄉㄨˋ'],
  ['像', 'ㄒㄧㄤˋ'], ['尚', 'ㄕㄤˋ'], ['談', 'ㄊㄢˊ'], ['頁', 'ㄧㄝˋ'],
  ['世', 'ㄕˋ'], ['界', 'ㄐㄧㄝˋ'], ['填', 'ㄊㄧㄢˊ'], ['滿', 'ㄇㄢˇ'],
  ['桶', 'ㄊㄨㄥˇ'], ['燃', 'ㄖㄢˊ'], ['那', 'ㄋㄚˋ'], ['盞', 'ㄓㄢˇ'],
  ['奇', 'ㄑㄧˊ'], ['火', 'ㄏㄨㄛˇ'], ['之', 'ㄓ'], ['始', 'ㄕˇ'],
  ['完', 'ㄨㄢˊ'], ['業', 'ㄧㄝˋ'], ['未', 'ㄨㄟˋ'], ['我', 'ㄨㄛˇ'],
  ['特', 'ㄊㄜˋ'], ['別', 'ㄅㄧㄝˊ'], ['賦', 'ㄈㄨˋ'], ['保', 'ㄅㄠˇ'],
  ['著', '˙ㄓㄜ'], ['熱', 'ㄖㄜˋ'], ['烈', 'ㄌㄧㄝˋ'], ['勤', 'ㄑㄧㄣˊ'],
  ['徑', 'ㄐㄧㄥˋ'], ['無', 'ㄨˊ'], ['涯', 'ㄧㄚˊ'], ['苦', 'ㄎㄨˇ'],
  ['舟', 'ㄓㄡ'], ['值', 'ㄓˊ'], ['己', 'ㄐㄧˇ'], ['掌', 'ㄓㄤˇ'],
  ['敏', 'ㄇㄧㄣˇ'], ['恥', 'ㄔˇ'], ['遇', 'ㄩˋ'], ['聰', 'ㄘㄨㄥ'],
  ['孩', 'ㄏㄞˊ'], ['超', 'ㄔㄠ'], ['識', 'ㄕˋ'], ['量', 'ㄌㄧㄤˋ'],
  ['則', 'ㄗㄜˊ'], ['擁', 'ㄩㄥˇ'], ['飛', 'ㄈㄟ'], ['翔', 'ㄒㄧㄤˊ'],
  ['翅', 'ㄔˋ'], ['膀', 'ㄅㄤˇ'], ['鑰', 'ㄧㄠˋ'], ['精', 'ㄐㄧㄥ'],
  ['荒', 'ㄏㄨㄤ'], ['嬉', 'ㄒㄧ'], ['毀', 'ㄏㄨㄟˇ'], ['隨', 'ㄙㄨㄟˊ'],
  ['投', 'ㄊㄡˊ'], ['入', 'ㄖㄨˋ'], ['閃', 'ㄕㄢˇ'], ['亮', 'ㄌㄧㄤˋ'],
  ['根', 'ㄍㄣ'], ['甜', 'ㄊㄧㄢˊ'], ['耐', 'ㄋㄞˋ'], ['解', 'ㄐㄧㄝˇ'],
  ['難', 'ㄋㄢˊ'], ['容', 'ㄖㄨㄥˊ'], ['迷', 'ㄇㄧˊ'], ['謂', 'ㄨㄟˋ'],
  ['致', 'ㄓˋ'], ['志', 'ㄓˋ'], ['倍', 'ㄅㄟˋ'], ['老', 'ㄌㄠˇ'],
  ['你', 'ㄋㄧˇ'], ['比', 'ㄅㄧˇ'], ['博', 'ㄅㄛˊ'], ['焉', 'ㄧㄢ'],
  ['互', 'ㄏㄨˋ'], ['相', 'ㄒㄧㄤ'], ['切', 'ㄑㄧㄝ'], ['磋', 'ㄘㄨㄛ'],
  ['童', 'ㄊㄨㄥˊ'], ['珍', 'ㄓㄣ'], ['貴', 'ㄍㄨㄟˋ'], ['寶', 'ㄅㄠˇ'],
  ['藏', 'ㄗㄤˋ'], ['獨', 'ㄉㄨˊ'], ['孤', 'ㄍㄨ'], ['陋', 'ㄌㄡˋ'],
  ['寡', 'ㄍㄨㄚˇ'], ['聞', 'ㄨㄣˊ'], ['趣', 'ㄑㄩˋ'], ['何', 'ㄏㄜˊ'],
  ['並', 'ㄅㄧㄥˋ'], ['夥', 'ㄏㄨㄛˇ'], ['堂', 'ㄊㄤˊ'], ['價', 'ㄐㄧㄚˋ'],
  ['輔', 'ㄈㄨˇ'], ['仁', 'ㄖㄣˊ'], ['玉', 'ㄩˋ'], ['琢', 'ㄓㄨㄛˊ'],
  ['雕', 'ㄉㄧㄠ'], ['傾', 'ㄑㄧㄥ'], ['聲', 'ㄕㄥ'], ['啟', 'ㄑㄧˇ'],
  ['智', 'ㄓˋ'], ['慧', 'ㄏㄨㄟˋ'], ['第', 'ㄉㄧˋ'], ['們', '˙ㄇㄣ'],
  ['善', 'ㄕㄢˋ'], ['守', 'ㄕㄡˇ'], ['神', 'ㄕㄣˊ'], ['審', 'ㄕㄣˇ'],
  ['慎', 'ㄕㄣˋ'], ['辨', 'ㄅㄧㄢˋ'], ['篤', 'ㄉㄨˇ'], ['揮', 'ㄏㄨㄟ'],
  ['綻', 'ㄓㄢˋ'], ['放', 'ㄈㄤˋ'], ['繽', 'ㄅㄧㄣ'], ['紛', 'ㄈㄣ'],
  ['播', 'ㄅㄛ'], ['穫', 'ㄏㄨㄛˋ'], ['豐', 'ㄈㄥ'], ['碩', 'ㄕㄨㄛˋ'],
  ['命', 'ㄇㄧㄥˋ'], ['流', 'ㄌㄧㄡˊ'], ['滴', 'ㄉㄧ'], ['化', 'ㄏㄨㄚˋ'],
  ['強', 'ㄑㄧㄤˊ'], ['魄', 'ㄆㄛˋ'], ['靈', 'ㄌㄧㄥˊ'], ['寓', 'ㄩˋ'],
  ['接', 'ㄐㄧㄝ'], ['受', 'ㄕㄡˋ'], ['失', 'ㄕ'], ['敗', 'ㄅㄞˋ'],
  ['絕', 'ㄐㄩㄝˊ'], ['棄', 'ㄑㄧˋ'], ['嘗', 'ㄔㄤˊ'], ['挑', 'ㄊㄧㄠˇ'],
  ['戰', 'ㄓㄢˋ'], ['吧', '˙ㄅㄚ'], ['腐', 'ㄈㄨˇ'], ['樞', 'ㄕㄨ'],
  ['蠹', 'ㄉㄨˋ'], ['骨', 'ㄍㄨˇ'], ['永', 'ㄩㄥˇ'], ['充', 'ㄔㄨㄥ'],
  ['肌', 'ㄐㄧ'], ['肉', 'ㄖㄡˋ'], ['鍛', 'ㄉㄨㄢˋ'], ['鍊', 'ㄌㄧㄢˋ'],
  ['困', 'ㄎㄨㄣˋ'], ['言', 'ㄧㄢˊ'], ['毅', 'ㄧˋ'], ['迎', 'ㄧㄥˊ'],
  ['陽', 'ㄧㄤˊ'], ['奔', 'ㄅㄣ'], ['躍', 'ㄩㄝˋ'], ['君', 'ㄐㄩㄣ'],
  ['樣', 'ㄧㄤˋ'], ['律', 'ㄌㄩˋ'], ['元', 'ㄩㄢˊ'], ['冠', 'ㄍㄨㄢˋ'],
  ['軍', 'ㄐㄩㄣ'], ['跌', 'ㄉㄧㄝˊ'], ['拍', 'ㄆㄞ'], ['立', 'ㄌㄧˋ'],
  ['站', 'ㄓㄢˋ'], ['送', 'ㄙㄨㄥˋ'], ['情', 'ㄑㄧㄥˊ'], ['財', 'ㄘㄞˊ'],
  ['富', 'ㄈㄨˋ'], ['這', 'ㄓㄜˋ'], ['份', 'ㄈㄣˋ'], ['先', 'ㄒㄧㄢ'],
  ['享', 'ㄒㄧㄤˇ'], ['暢', 'ㄔㄤˋ'], ['恆', 'ㄏㄥˊ'], ['挺', 'ㄊㄧㄥˇ'],
  ['拔', 'ㄅㄚˊ'], ['膽', 'ㄉㄢˇ'], ['灑', 'ㄙㄚˇ'], ['屬', 'ㄕㄨˇ'],
  ['重', 'ㄓㄨㄥˋ'], ['限', 'ㄒㄧㄢˋ'], ['抱', 'ㄅㄠˋ'], ['哲', 'ㄓㄜˊ'],
  ['示', 'ㄕˋ'], ['片', 'ㄆㄧㄢˋ'], ['葉', 'ㄧㄝˋ'], ['造', 'ㄗㄠˋ'],
  ['允', 'ㄩㄣˇ'], ['許', 'ㄒㄩˇ'], ['犯', 'ㄈㄢˋ'], ['錯', 'ㄘㄨㄛˋ'],
  ['留', 'ㄌㄧㄡˊ'], ['尖', 'ㄐㄧㄢ'], ['淌', 'ㄊㄤˇ'], ['符', 'ㄈㄨˊ'],
  ['終', 'ㄓㄨㄥ'], ['雙', 'ㄕㄨㄤ'], ['誕', 'ㄉㄢˋ'], ['幻', 'ㄏㄨㄢˋ'],
  ['微', 'ㄨㄟˊ'], ['總', 'ㄗㄨㄥˇ'], ['訪', 'ㄈㄤˇ'], ['些', 'ㄒㄧㄝ'],
  ['夠', 'ㄍㄡˋ'], ['純', 'ㄔㄨㄣˊ'], ['黎', 'ㄌㄧˊ'], ['即', 'ㄐㄧˊ'],
  ['庭', 'ㄊㄧㄥˊ'], ['除', 'ㄔㄨˊ'], ['潔', 'ㄐㄧㄝˊ'], ['初', 'ㄔㄨ'],
  ['慣', 'ㄍㄨㄢˋ'], ['粥', 'ㄓㄡ'], ['當', 'ㄉㄤ'], ['處', 'ㄔㄨˋ'],
  ['易', 'ㄧˋ'], ['頓', 'ㄉㄨㄣˋ'], ['卓', 'ㄓㄨㄛˊ'], ['越', 'ㄩㄝˋ'],
  ['舉', 'ㄐㄩˇ'], ['復', 'ㄈㄨˋ'], ['擔', 'ㄉㄢ'], ['變', 'ㄅㄧㄢˋ'],
  ['件', 'ㄐㄧㄢˋ'], ['平', 'ㄆㄧㄥˊ'], ['凡', 'ㄈㄢˊ'], ['井', 'ㄐㄧㄥˇ'],
  ['領', 'ㄌㄧㄥˇ'], ['畢', 'ㄅㄧˋ'], ['環', 'ㄏㄨㄢˊ'], ['境', 'ㄐㄧㄥˋ'],
  ['清', 'ㄑㄧㄥ'], ['澈', 'ㄔㄜˋ'], ['細', 'ㄒㄧˋ'], ['嚼', 'ㄐㄧㄠˊ'],
  ['嚥', 'ㄧㄢˋ'], ['照', 'ㄓㄠˋ'], ['顧', 'ㄍㄨˋ'], ['節', 'ㄐㄧㄝˊ'],
  ['貼', 'ㄊㄧㄝ'], ['船', 'ㄔㄨㄢˊ'], ['羅', 'ㄌㄨㄛˊ'], ['引', 'ㄧㄣˇ'],
  ['穩', 'ㄨㄣˇ'], ['航', 'ㄏㄤˊ'], ['張', 'ㄓㄤ'], ['弛', 'ㄔˊ'],
  ['武', 'ㄨˇ'], ['玩', 'ㄨㄢˊ'], ['耍', 'ㄕㄨㄚˇ'], ['衡', 'ㄏㄥˊ'],
  ['曾', 'ㄘㄥˊ'], ['馨', 'ㄒㄧㄣ'], ['幸', 'ㄒㄧㄥˋ'], ['浪', 'ㄌㄤˋ'],
  ['費', 'ㄈㄟˋ'], ['懷', 'ㄏㄨㄞˊ'], ['適', 'ㄕˋ'], ['鬆', 'ㄙㄨㄥ'],
  ['遵', 'ㄗㄨㄣ'], ['具', 'ㄐㄩˋ'], ['喔', 'ㄛ'], ['緊', 'ㄐㄧㄣˇ'],
  ['弓', 'ㄍㄨㄥ'], ['弦', 'ㄒㄧㄢˊ'], ['斷', 'ㄉㄨㄢˋ'], ['段', 'ㄉㄨㄢˋ'],
  ['輕', 'ㄑㄧㄥ'], ['愉', 'ㄩˊ'], ['貫', 'ㄍㄨㄢˋ'], ['盡', 'ㄐㄧㄣˋ'],
  ['陪', 'ㄆㄟˊ'], ['聊', 'ㄌㄧㄠˊ'], ['景', 'ㄐㄧㄥˇ'], ['皆', 'ㄐㄧㄝ'],
  ['佳', 'ㄐㄧㄚ'], ['興', 'ㄒㄧㄥˋ'], ['欣', 'ㄒㄧㄣ'], ['賞', 'ㄕㄤˇ'],
  ['既', 'ㄐㄧˋ'], ['郊', 'ㄐㄧㄠ'], ['憶', 'ㄧˋ'], ['使', 'ㄕˇ'],
  ['且', 'ㄑㄧㄝˇ'], ['連', 'ㄌㄧㄢˊ'], ['橋', 'ㄑㄧㄠˊ'], ['樑', 'ㄌㄧㄤˊ'],
  ['熟', 'ㄕㄡˊ'], ['泌', 'ㄇㄧˋ'], ['激', 'ㄐㄧ'], ['悄', 'ㄑㄧㄠˇ'],
  ['撫', 'ㄈㄨˇ'], ['疲', 'ㄆㄧˊ'], ['憊', 'ㄅㄟˋ'], ['修', 'ㄒㄧㄡ'],
  ['螢', 'ㄧㄥˊ'], ['幕', 'ㄇㄨˋ'], ['翻', 'ㄈㄢ'], ['順', 'ㄕㄨㄣˋ'],
  ['默', 'ㄇㄛˋ'], ['滋', 'ㄗ'], ['潤', 'ㄖㄨㄣˋ'], ['茁', 'ㄓㄨㄛˊ'],
  ['壯', 'ㄓㄨㄤˋ'], ['棵', 'ㄎㄜ'], ['苗', 'ㄇㄧㄠˊ'], ['飽', 'ㄅㄠˇ'],
  ['醒', 'ㄒㄧㄥˇ'], ['免', 'ㄇㄧㄢˇ'], ['疫', 'ㄧˋ'], ['員', 'ㄩㄢˊ'],
  ['煩', 'ㄈㄢˊ'], ['惱', 'ㄋㄠˇ'], ['交', 'ㄐㄧㄠ'], ['空', 'ㄎㄨㄥ'],
  ['窩', 'ㄨㄛ'], ['夢', 'ㄇㄥˋ'], ['鄉', 'ㄒㄧㄤ'], ['豫', 'ㄩˋ'],
  ['廢', 'ㄈㄟˋ'], ['過', 'ㄍㄨㄛˋ'], ['隱', 'ㄧㄣˇ'], ['潛', 'ㄑㄧㄢˊ'],
  ['式', 'ㄕˋ'], ['綿', 'ㄇㄧㄢˊ'], ['妥', 'ㄊㄨㄛˇ'], ['擠', 'ㄐㄧˇ'],
  ['測', 'ㄘㄜˋ'], ['它', 'ㄊㄚ'], ['胸', 'ㄒㄩㄥ'], ['盛', 'ㄕㄥˋ'],
  ['支', 'ㄓ'], ['配', 'ㄆㄟˋ'], ['趕', 'ㄍㄢˇ'], ['調', 'ㄊㄧㄠˊ'],
  ['伐', 'ㄈㄚˊ'], ['決', 'ㄐㄩㄝˊ'], ['培', 'ㄆㄟˊ'], ['寬', 'ㄎㄨㄢ'],
  ['拆', 'ㄔㄞ'], ['選', 'ㄒㄩㄢˇ'], ['擇', 'ㄗㄜˊ'], ['義', 'ㄧˋ'],
  ['矣', 'ㄧˇ'], ['罔', 'ㄨㄤˇ'], ['殆', 'ㄉㄞˋ'], ['卷', 'ㄐㄩㄢˋ'],
  ['積', 'ㄐㄧ'], ['跬', 'ㄎㄨㄟˇ'], ['江', 'ㄐㄧㄤ'], ['獎', 'ㄐㄧㄤˇ'],
  ['勵', 'ㄌㄧˋ'], ['器', 'ㄑㄧˋ'], ['種', 'ㄓㄨㄥˇ'], ['胞', 'ㄅㄠ'],
  ['提', 'ㄊㄧˊ'], ['升', 'ㄕㄥ'], ['團', 'ㄊㄨㄢˊ'], ['結', 'ㄐㄧㄝˊ'],
  ['害', 'ㄏㄞˋ'], ['怕', 'ㄆㄚˋ'], ['彈', 'ㄊㄢˊ'], ['客', 'ㄎㄜˋ'],
  ['懶', 'ㄌㄢˇ'], ['惰', 'ㄉㄨㄛˋ'], ['絲', 'ㄙ'], ['縷', 'ㄌㄩˇ'],
  ['維', 'ㄨㄟˊ'], ['艱', 'ㄐㄧㄢ'], ['育', 'ㄩˋ'], ['呼', 'ㄏㄨ'],
  ['吸', 'ㄒㄧ'], ['權', 'ㄑㄩㄢˊ'], ['勉', 'ㄇㄧㄢˇ'], ['歲', 'ㄙㄨㄟˋ'],
  ['招', 'ㄓㄠ'], ['損', 'ㄙㄨㄣˇ'], ['謙', 'ㄑㄧㄢ'], ['益', 'ㄧˋ'],
  ['乃', 'ㄋㄞˇ'], ['誰', 'ㄕㄟˊ'], ['拿', 'ㄋㄚˊ'], ['與', 'ㄩˇ'],
  ['至', 'ㄓˋ'],
]);

const ZHUYIN_CACHE_KEY = 'kids_planner_zhuyin_cache_v1';
const EN_CACHE_KEY = 'kids_planner_en_cache_v1';

function loadLocalCache(key: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCache(key: string, cache: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // ignore storage quota errors
  }
}

const runtimeZhuyinCache: Record<string, string> = loadLocalCache(ZHUYIN_CACHE_KEY);
const runtimeEnCache: Record<string, string> = loadLocalCache(EN_CACHE_KEY);

/**
 * 依據輸入文字，回傳與 Array.from(text) 長度完全一致、1對1 對齊的注音陣列
 * （解決標點符號或空白導致 split(/\s+/) 後注音錯位與缺漏的問題！）
 */
export function getZhuyinArrayForText(text: string): string[] {
  const chars = Array.from(text);
  const result: string[] = new Array(chars.length).fill('');

  let i = 0;
  while (i < chars.length) {
    let matchedLen = 0;
    for (let len = Math.min(4, chars.length - i); len >= 2; len--) {
      const sub = chars.slice(i, i + len).join('');
      if (PHRASE_ZHUYIN_DICT[sub]) {
        const syllables = PHRASE_ZHUYIN_DICT[sub];
        for (let k = 0; k < len; k++) {
          result[i + k] = syllables[k] || '';
        }
        matchedLen = len;
        break;
      }
    }
    if (matchedLen > 0) {
      i += matchedLen;
    } else {
      const ch = chars[i];
      if (/[\u4e00-\u9fff]/.test(ch)) {
        result[i] = ZHUYIN_DICT[ch] || runtimeZhuyinCache[ch] || '';
      }
      i++;
    }
  }

  return result;
}

/**
 * 同步產生注音字串（供活動表單預填使用）
 */
export function autoGenerateZhuyin(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return getZhuyinArrayForText(trimmed).filter(Boolean).join(' ').trim();
}

/**
 * 清理萌典 (Moedict) 回傳的注音字串（只保留第一讀音與標準注音符號）
 */
function cleanMoedictBopomofo(rawB: string): string {
  if (!rawB) return '';
  const firstPart = rawB.split(/[\s　,，、/]+/)[0] || '';
  return firstPart.replace(/[^ㄅ-ㄩ˙ˊˇˋ]/g, '').trim();
}

/**
 * 連線至教育部萌典 (Moedict) 公開字形與辭典資源 API，自動補齊本地字典沒有的罕見字或詞組注音
 */
export async function fetchZhuyinFromMoedictApi(text: string): Promise<{
  zhuyin: string;
  fromApi: boolean;
}> {
  const trimmed = text.trim();
  if (!trimmed) return { zhuyin: '', fromApi: false };

  const chars = Array.from(trimmed);
  const syllables = getZhuyinArrayForText(trimmed);
  let usedApi = false;

  const hasMissing = chars.some((ch, i) => /[\u4e00-\u9fff]/.test(ch) && !syllables[i]);
  if (hasMissing && chars.length >= 2 && chars.length <= 4) {
    try {
      const resp = await fetch(`https://www.moedict.tw/a/${encodeURIComponent(trimmed)}.json`);
      if (resp.ok) {
        const data = await resp.json();
        const bStr: string | undefined = data?.h?.[0]?.b;
        if (bStr) {
          const parts = bStr
            .trim()
            .split(/[\s　]+/)
            .map((p) => p.replace(/[^ㄅ-ㄩ˙ˊˇˋ]/g, ''))
            .filter(Boolean);
          if (parts.length === chars.length) {
            parts.forEach((p, k) => {
              syllables[k] = p;
              runtimeZhuyinCache[chars[k]] = p;
            });
            saveLocalCache(ZHUYIN_CACHE_KEY, runtimeZhuyinCache);
            usedApi = true;
          }
        }
      }
    } catch {
      // Fall back to per-character lookup
    }
  }

  // 針對仍缺漏的單字，逐字查詢萌典單字 API
  await Promise.all(
    chars.map(async (ch, i) => {
      if (syllables[i] || !/[\u4e00-\u9fff]/.test(ch)) return;
      try {
        const resp = await fetch(`https://www.moedict.tw/a/${encodeURIComponent(ch)}.json`);
        if (resp.ok) {
          const data = await resp.json();
          const rawB: string | undefined = data?.h?.[0]?.b;
          const cleaned = cleanMoedictBopomofo(rawB || '');
          if (cleaned) {
            syllables[i] = cleaned;
            runtimeZhuyinCache[ch] = cleaned;
            usedApi = true;
          }
        }
      } catch {
        // Ignore individual character error
      }
    })
  );

  if (usedApi) {
    saveLocalCache(ZHUYIN_CACHE_KEY, runtimeZhuyinCache);
  }

  return {
    zhuyin: syllables.filter(Boolean).join(' ').trim(),
    fromApi: usedApi,
  };
}

// 內建常見活動中英對照詞庫
const ACTIVITY_ENGLISH_DICT: { match: string; english: string }[] = [
  { match: '寫功課', english: 'Doing Homework' },
  { match: '功課', english: 'Homework' },
  { match: '作業', english: 'Homework' },
  { match: '課外閱讀', english: 'Reading Books' },
  { match: '閱讀', english: 'Reading' },
  { match: '看書', english: 'Reading Books' },
  { match: '故事', english: 'Story Time' },
  { match: '英語', english: 'English Study' },
  { match: '英文', english: 'English Practice' },
  { match: '背單字', english: 'Vocabulary Practice' },
  { match: '聽力', english: 'Listening Practice' },
  { match: '數學', english: 'Math Practice' },
  { match: '自然', english: 'Science Study' },
  { match: '科學', english: 'Science Experiment' },
  { match: '實驗', english: 'Lab Experiment' },
  { match: '國語', english: 'Chinese Study' },
  { match: '作文', english: 'Writing Practice' },
  { match: '複習', english: 'Review Lesson' },
  { match: '預習', english: 'Preview Lesson' },
  { match: '考試', english: 'Quiz & Test Prep' },
  { match: '補習', english: 'Cram School' },
  { match: '安親班', english: 'After-School Care' },
  { match: '學校上課', english: 'School Classes' },
  { match: '上課', english: 'School Class' },
  { match: '上學', english: 'Go to School' },
  { match: '放學', english: 'After School' },
  { match: '課後社團', english: 'School Club' },
  { match: '社團', english: 'Club Activity' },
  { match: '早自習', english: 'Morning Study' },
  { match: '戶外運動', english: 'Outdoor Sports' },
  { match: '運動', english: 'Sports & Exercise' },
  { match: '游泳', english: 'Swimming' },
  { match: '跳繩', english: 'Jump Rope' },
  { match: '籃球', english: 'Basketball' },
  { match: '足球', english: 'Soccer' },
  { match: '羽球', english: 'Badminton' },
  { match: '桌球', english: 'Table Tennis' },
  { match: '網球', english: 'Tennis' },
  { match: '棒球', english: 'Baseball' },
  { match: '跑步', english: 'Running & Jogging' },
  { match: '慢跑', english: 'Jogging' },
  { match: '直排輪', english: 'Inline Skating' },
  { match: '腳踏車', english: 'Cycling' },
  { match: '單車', english: 'Cycling' },
  { match: '體操', english: 'Gymnastics' },
  { match: '跆拳道', english: 'Taekwondo' },
  { match: '跳舞', english: 'Dancing' },
  { match: '舞蹈', english: 'Dance Practice' },
  { match: '散步', english: 'Walking' },
  { match: '鋼琴', english: 'Piano Practice' },
  { match: '練琴', english: 'Music Practice' },
  { match: '小提琴', english: 'Violin Practice' },
  { match: '長笛', english: 'Flute Practice' },
  { match: '直笛', english: 'Recorder Practice' },
  { match: '打鼓', english: 'Drum Practice' },
  { match: '音樂', english: 'Music Time' },
  { match: '唱歌', english: 'Singing' },
  { match: '繪畫', english: 'Drawing & Painting' },
  { match: '畫畫', english: 'Drawing' },
  { match: '美術', english: 'Art Class' },
  { match: '書法', english: 'Calligraphy' },
  { match: '手作', english: 'Arts & Crafts' },
  { match: '美勞', english: 'Craft Making' },
  { match: '折紙', english: 'Origami' },
  { match: '黏土', english: 'Clay Modeling' },
  { match: '積木', english: 'Building Blocks' },
  { match: '樂高', english: 'LEGO Building' },
  { match: '圍棋', english: 'Go Board Game' },
  { match: '象棋', english: 'Chinese Chess' },
  { match: '編程', english: 'Coding Practice' },
  { match: '程式', english: 'Coding & Programming' },
  { match: '機器人', english: 'Robotics' },
  { match: '早餐', english: 'Breakfast' },
  { match: '午餐', english: 'Lunch Time' },
  { match: '晚餐', english: 'Dinner Time' },
  { match: '點心', english: 'Snack Time' },
  { match: '用餐', english: 'Meal Time' },
  { match: '吃飯', english: 'Meal Time' },
  { match: '家事', english: 'Household Chores' },
  { match: '整理房間', english: 'Tidy Up Room' },
  { match: '收書包', english: 'Pack Schoolbag' },
  { match: '掃地', english: 'Sweeping Floor' },
  { match: '拖地', english: 'Mopping Floor' },
  { match: '倒垃圾', english: 'Take Out Trash' },
  { match: '澆花', english: 'Watering Plants' },
  { match: '遛狗', english: 'Walking the Dog' },
  { match: '洗澡', english: 'Bath & Shower' },
  { match: '盥洗', english: 'Wash & Brush Teeth' },
  { match: '刷牙', english: 'Brush Teeth' },
  { match: '自由遊戲', english: 'Free Play' },
  { match: '遊戲', english: 'Play Time' },
  { match: '電玩', english: 'Video Games' },
  { match: '電視', english: 'TV Time' },
  { match: '看卡通', english: 'Watch Cartoons' },
  { match: '動漫', english: 'Anime Time' },
  { match: '電影', english: 'Movie Time' },
  { match: '親子', english: 'Family Time' },
  { match: '桌遊', english: 'Board Games' },
  { match: '公園', english: 'Park Outing' },
  { match: '露營', english: 'Camping' },
  { match: '野餐', english: 'Picnic' },
  { match: '旅行', english: 'Family Trip' },
  { match: '午休', english: 'Midday Nap' },
  { match: '午睡', english: 'Afternoon Nap' },
  { match: '小憩', english: 'Short Nap' },
  { match: '晚間睡眠', english: 'Night Sleep' },
  { match: '睡眠', english: 'Sleep Time' },
  { match: '睡覺', english: 'Bedtime & Sleep' },
  { match: '休息', english: 'Rest & Relax' },
  { match: '彈性', english: 'Flexible Task' },
];

export function autoTranslateToEnglish(text: string, fallback = ''): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (runtimeEnCache[trimmed]) return runtimeEnCache[trimmed];

  for (const item of ACTIVITY_ENGLISH_DICT) {
    if (trimmed === item.match) return item.english;
  }
  for (const item of ACTIVITY_ENGLISH_DICT) {
    if (trimmed.includes(item.match)) return item.english;
  }
  return fallback;
}

/**
 * 連線至線上翻譯資源 API (Google GTX / MyMemory Translation API)，將本地詞庫沒有的自訂中文活動自動翻譯為英文
 */
export async function fetchEnglishFromTranslationApi(
  text: string,
  fallback = 'Custom Activity'
): Promise<{ english: string; fromApi: boolean }> {
  const trimmed = text.trim();
  if (!trimmed) return { english: '', fromApi: false };

  for (const item of ACTIVITY_ENGLISH_DICT) {
    if (trimmed === item.match) {
      return { english: item.english, fromApi: false };
    }
  }
  if (runtimeEnCache[trimmed]) {
    return { english: runtimeEnCache[trimmed], fromApi: true };
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-TW&tl=en&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      const translated: string | undefined = data?.[0]?.[0]?.[0];
      if (translated && translated.trim()) {
        const formatted = translated
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase());
        runtimeEnCache[trimmed] = formatted;
        saveLocalCache(EN_CACHE_KEY, runtimeEnCache);
        return { english: formatted, fromApi: true };
      }
    }
  } catch {
    // fallback to MyMemory API
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed
    )}&langpair=zh-TW|en`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      const translated: string | undefined = data?.responseData?.translatedText;
      if (translated && translated.trim()) {
        const formatted = translated
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase());
        runtimeEnCache[trimmed] = formatted;
        saveLocalCache(EN_CACHE_KEY, runtimeEnCache);
        return { english: formatted, fromApi: true };
      }
    }
  } catch {
    // ignore network error
  }

  const localMatch = autoTranslateToEnglish(trimmed, fallback);
  return { english: localMatch || fallback, fromApi: false };
}

interface ParsedZhuyinSyllable {
  phonetics: string[];
  tone: string;
  isLightTone: boolean;
}

/**
 * 將單一中文字的注音分解為：聲母/介音/韻母 + 聲調（直式排版於國字右側）
 */
function parseZhuyinSyllable(raw: string): ParsedZhuyinSyllable {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { phonetics: [], tone: '', isLightTone: false };
  }

  const isLightTone = trimmed.includes('˙');
  let tone = '';
  if (trimmed.includes('ˊ')) tone = 'ˊ';
  else if (trimmed.includes('ˇ')) tone = 'ˇ';
  else if (trimmed.includes('ˋ')) tone = 'ˋ';

  const cleanPhonetics = Array.from(trimmed).filter(
    (ch) => ch !== '˙' && ch !== 'ˊ' && ch !== 'ˇ' && ch !== 'ˋ'
  );

  return {
    phonetics: cleanPhonetics,
    tone,
    isLightTone,
  };
}

interface RubyTextProps {
  text: string;
  zhuyin?: string;
  className?: string;
  rtClassName?: string;
  nowrap?: boolean;
}

/**
 * 台灣教育部標準「直式注音」元件（Bopomofo Vertical Right-Side Ruby）
 * - 自動處理句子中的標點符號（，、。；！？）不影響前後字注音對齊
 * - 若遇到本地字典未收錄之罕見字，背景自動呼叫萌典 API 補齊並即時重繪
 */
export const RubyText: React.FC<RubyTextProps> = ({
  text,
  zhuyin,
  className = '',
  rtClassName = '',
  nowrap = false,
}) => {
  const [, setApiTick] = useState(0);
  const chars = Array.from(text);

  // 計算與 chars 1對1 對齊的注音陣列
  let alignedSyllables: string[];
  if (zhuyin === '') {
    // 使用者明確指定空字串代表「不顯示注音」
    alignedSyllables = new Array(chars.length).fill('');
  } else if (typeof zhuyin === 'string' && zhuyin.trim()) {
    const providedParts = zhuyin.trim().split(/\s+/);
    const autoArr = getZhuyinArrayForText(text);
    const chinesePositions = chars
      .map((ch, idx) => (/[\u4e00-\u9fff]/.test(ch) ? idx : -1))
      .filter((idx) => idx !== -1);

    if (providedParts.length === chinesePositions.length) {
      alignedSyllables = new Array(chars.length).fill('');
      chinesePositions.forEach((charIdx, k) => {
        alignedSyllables[charIdx] = providedParts[k] || autoArr[charIdx] || '';
      });
    } else {
      alignedSyllables = chars.map((ch, idx) => {
        if (!/[\u4e00-\u9fff]/.test(ch)) return '';
        return providedParts[idx] || autoArr[idx] || '';
      });
    }
  } else {
    alignedSyllables = getZhuyinArrayForText(text);
  }

  // 若句子中有任何中文字尚未有注音（罕見字），自動在背景向教育部萌典 API 查詢並更新顯示
  useEffect(() => {
    if (zhuyin === '') return;
    const hasMissingChinese = chars.some(
      (ch, idx) => /[\u4e00-\u9fff]/.test(ch) && !alignedSyllables[idx]
    );
    if (!hasMissingChinese) return;

    let cancelled = false;
    fetchZhuyinFromMoedictApi(text).then((res) => {
      if (!cancelled && res.fromApi) {
        setApiTick((t) => t + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [text, zhuyin]);

  return (
    <span
      className={`zhuyin-word inline-flex items-center ${
        nowrap ? 'flex-nowrap whitespace-nowrap' : 'flex-wrap'
      } gap-x-[2px] gap-y-[3px] leading-snug ${className}`}
      aria-label={text}
    >
      {chars.map((char, idx) => {
        const rawSyl = alignedSyllables[idx] || '';
        const isChineseChar = /[\u4e00-\u9fff]/.test(char);

        if (!isChineseChar || !rawSyl) {
          return (
            <span key={idx} className="inline-block">
              {char}
            </span>
          );
        }

        const { phonetics, tone, isLightTone } = parseZhuyinSyllable(rawSyl);

        return (
          <ruby
            key={idx}
            className="zhuyin-vertical-ruby inline-flex flex-row items-center align-middle"
          >
            <span className="zhuyin-base-char inline-block leading-none">{char}</span>
            <rt
              className={`zhuyin-vertical-rt inline-flex flex-row items-center justify-center select-none ${rtClassName}`}
              aria-hidden="true"
            >
              <span className="zhuyin-symbols-col zhuyin-phonetic-col inline-flex flex-col items-center justify-center">
                {isLightTone && (
                  <span className="zhuyin-light-tone zhuyin-light-dot block">˙</span>
                )}
                {phonetics.map((p, pIdx) => (
                  <span key={pIdx} className="zhuyin-letter zhuyin-bopomofo-char block">
                    {p}
                  </span>
                ))}
              </span>
              {tone && (
                <span className="zhuyin-side-tone zhuyin-tone-mark inline-flex items-center">
                  {tone}
                </span>
              )}
            </rt>
          </ruby>
        );
      })}
    </span>
  );
};
