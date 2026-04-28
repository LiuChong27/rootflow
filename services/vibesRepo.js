import sceneCardsRaw from '../data/vibes/scene-cards.json';
import sceneLibraryRaw from '../data/vibes/scene-library.json';

const AGGRESSIVE_KEYWORDS_EN = [
  'stupid',
  'idiot',
  'dumb',
  'trash',
  'pathetic',
  'clown',
  'shut',
  'embarrassing',
  'annoying',
  'ridiculous',
  'excuse',
  'delusional',
  'joke',
  'nonsense',
  'useless',
];
const AGGRESSIVE_KEYWORDS_CN = [
  '闭嘴',
  '滚',
  '蠢',
  '傻',
  '废物',
  '垃圾',
  '恶心',
  '丢人',
  '离谱',
  '神经',
  '有病',
  '脸皮',
  '借口',
  '别装',
  '省省吧',
];
const COLLOQUIAL_KEYWORDS_EN = [
  'save it',
  'yeah right',
  'give me a break',
  'not my problem',
  'come on',
  'seriously',
  'right',
  'try that',
  'take that',
];
const COLLOQUIAL_KEYWORDS_CN = [
  '省省吧',
  '少来',
  '得了吧',
  '行了',
  '别来这套',
  '不关我事',
  '闭嘴',
  '滚开',
  '就这',
  '呵呵',
];
const FORMAL_KEYWORDS_EN = [
  'therefore',
  'however',
  'furthermore',
  'moreover',
  'consequently',
  'schedule',
  'moment',
  'results',
];
const IMPERATIVE_STARTERS = [
  'save',
  'stop',
  'shut',
  'try',
  'take',
  'keep',
  'spare',
  'move',
  'listen',
  'drop',
  'skip',
];
const ENGLISH_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'by',
  'it',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'and',
  'or',
  'that',
  'this',
  'as',
  'from',
  'you',
  'your',
  'yours',
  'my',
  'me',
  'i',
]);
const TONE_MODE_OPTIONS = [
  {
    id: 'hard',
    label: '更狠',
    description: '优先保留攻击性更强的表达',
    scoringWeights: {
      aggressive: 3.2,
      colloquial: 1.1,
      formalPenalty: 0.85,
      lengthPenalty: 1,
    },
  },
  {
    id: 'medium',
    label: '适中',
    description: '在攻击性与口语化之间平衡',
    scoringWeights: {
      aggressive: 2.2,
      colloquial: 1.4,
      formalPenalty: 0.55,
      lengthPenalty: 1,
    },
  },
  {
    id: 'light',
    label: '轻度',
    description: '优先保留口语化、相对克制的表达',
    scoringWeights: {
      aggressive: 1.2,
      colloquial: 2.1,
      formalPenalty: 0.6,
      lengthPenalty: 1.15,
    },
  },
];
const DEFAULT_TONE_MODE = 'medium';
const TONE_MODE_PROFILE_MAP = TONE_MODE_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option;
  return acc;
}, {});

let activeToneMode = DEFAULT_TONE_MODE;
const SECTION_TEXT_FALLBACKS = {
  phrases: {
    title: '常用短句',
    description: '适合正面回击、直接表达的短句。',
  },
  sarcasm: {
    title: '讽刺短句',
    description: '适合带一点讽刺感和反问语气的短句。',
  },
  shutdown: {
    title: '终结短句',
    description: '适合快速收尾、结束拉扯的短句。',
  },
  insults: {
    title: '高压短句',
    description: '较强硬、攻击性更高的表达。',
  },
};
const INSULT_CONTEXT_TRANSLATIONS = {
  'daily-drama': '日常拉扯',
  'office-chaos': '职场混乱',
  'campus-chaos': '校园冲突',
  'cafeteria-chaos': '食堂混战',
  'match-throwing': '故意送分',
  'comment-section': '评论区混战',
};
const INSULT_TRAIT_TRANSLATIONS = {
  'attention addict': '注意力瘾君子',
  'bad joke': '失败笑话',
  'blame machine': '甩锅机器',
  'brain-lag hero': '脑子掉线的“英雄”',
  'chaos addict': '混乱成瘾者',
  'chaos mascot': '混乱吉祥物',
  'cheap bully': '低级霸凌者',
  clown: '小丑',
  'confidence fraud': '自信骗局',
  crybaby: '爱哭鬼',
  'delusion factory': '幻想制造机',
  'drama leech': '戏精寄生虫',
  'excuse machine': '借口制造机',
  'fake genius': '假天才',
  idiot: '白痴',
  loser: '失败者',
  loudmouth: '大嘴炮',
  'manners bankrupt': '礼貌破产户',
  'meltdown starter': '情绪爆炸引线',
  'nonsense dealer': '废话贩子',
  parasite: '寄生虫',
  'pathetic ego': '可怜的自我膨胀',
  'rude rookie': '无礼新手',
  'temper bomb': '脾气炸弹',
  'toxic mouth': '有毒的嘴',
  trainwreck: '事故现场',
  'trash talker': '垃圾话选手',
  'verbal garbage': '语言垃圾桶',
  'walking headache': '行走的头疼源',
  'weak brain': '弱智脑回路',
};
const INSULT_SENTENCE_TRANSLATIONS = {
  'i see exactly what you are doing in this daily drama.':
    '你在这场日常闹剧里打什么算盘，我看得一清二楚。',
  'i see exactly what you are doing in this office mess.':
    '你在这场职场烂局里打什么算盘，我看得一清二楚。',
  'i see exactly what you are doing in this campus nonsense.':
    '你在这场校园闹剧里打什么算盘，我看得一清二楚。',
  'i see exactly what you are doing in this cafeteria chaos.':
    '你在这场食堂混战里打什么算盘，我看得一清二楚。',
  'i see exactly what you are doing in this throwing the match.':
    '你在这波故意送分里打什么算盘，我看得一清二楚。',
  'i see exactly what you are doing in this comment-section chaos.':
    '你在这场评论区混战里打什么算盘，我看得一清二楚。',
  'nothing about this behavior deserves respect.': '你这种行为没有任何一处值得尊重。',
  'that attitude makes everything around you worse.': '你这副态度只会把周围一切都拖得更糟。',
  'that is intimidation, not strength.': '这叫虚张声势，不叫实力。',
  'that move is loud, ugly, and obvious.': '你这招又吵、又丑、还特别明显。',
  'that was a cheap move and everybody saw it.': '这招很低级，而且所有人都看见了。',
  'there is nothing smart about what you are doing.': '你现在这套做法，半点都不聪明。',
  'this is exactly why people stop trusting you.': '这就是大家不再信任你的原因。',
  'this kind of daily drama exposes your character fast.': '这种日常闹剧最能暴露你的本质。',
  'this kind of office mess exposes your character fast.': '这种职场烂局最能暴露你的本质。',
  'this kind of campus nonsense exposes your character fast.': '这种校园闹剧最能暴露你的本质。',
  'this kind of cafeteria chaos exposes your character fast.': '这种食堂混战最能暴露你的本质。',
  'this kind of throwing the match exposes your character fast.': '这种故意送分最能暴露你的本质。',
  'this kind of comment-section chaos exposes your character fast.':
    '这种评论区混战最能暴露你的本质。',
  'you are making your intentions painfully obvious.': '你的意图已经明显到刺眼了。',
  'you are not in control. you are just causing damage.': '你不是在控场，你只是在制造破坏。',
  'you are not intimidating. you are just exposed.': '你不是有压迫感，你只是把自己暴露得更彻底。',
  'you are not making yourself look powerful here.': '你这样只会显得虚弱，不会显得强大。',
  'you are proving my point every second.': '你每一秒都在帮我证明我说得对。',
  'you are telling on yourself with every move.': '你每一个动作都在自爆底牌。',
  'you do not get respect by acting like this.': '靠这副样子，换不来尊重。',
  'you keep confusing noise with authority.': '你总把噪音当权威。',
  'you keep crossing lines like that and call it confidence.': '你一次次越线，还把那叫自信。',
  'you keep picking the ugliest way to handle things.': '你总挑最难看的方式处理问题。',
  'your behavior is the ugliest part of this daily drama.':
    '你这行为，是这场日常闹剧里最难看的部分。',
  'your behavior is the ugliest part of this office mess.':
    '你这行为，是这场职场烂局里最难看的部分。',
  'your behavior is the ugliest part of this campus nonsense.':
    '你这行为，是这场校园闹剧里最难看的部分。',
  'your behavior is the ugliest part of this cafeteria chaos.':
    '你这行为，是这场食堂混战里最难看的部分。',
  'your behavior is the ugliest part of this throwing the match.':
    '你这行为，是这波故意送分里最难看的部分。',
  'your behavior is the ugliest part of this comment-section chaos.':
    '你这行为，是这场评论区混战里最难看的部分。',
};

function toSafeArray(input) {
  return Array.isArray(input) ? input : [];
}

function normalizeText(input) {
  return String(input || '').trim();
}

function hasBrokenPlaceholder(text) {
  const source = normalizeText(text);
  if (!source) return true;
  return /[?？]{2,}/.test(source) || source.includes('锟') || source.includes('翻译待补充');
}

function sanitizeText(text, fallback = '') {
  const source = normalizeText(text);
  if (hasBrokenPlaceholder(source)) return normalizeText(fallback);
  return source;
}

function normalizeEnglishKey(text) {
  return normalizeText(text).toLowerCase().replace(/\s+/g, ' ');
}

function translateInsultSentence(english = '') {
  const normalizedKey = normalizeEnglishKey(english);
  if (!normalizedKey) return '';

  const directTranslation = INSULT_SENTENCE_TRANSLATIONS[normalizedKey];
  if (directTranslation) return directTranslation;

  const normalizedPhrase = normalizedKey.replace(/[.!?]+$/g, '');
  const [contextRaw, ...traitParts] = normalizedPhrase.split(' ');
  const contextTranslation = INSULT_CONTEXT_TRANSLATIONS[contextRaw];
  const traitTranslation = INSULT_TRAIT_TRANSLATIONS[traitParts.join(' ')];
  if (!contextTranslation || !traitTranslation) return '';

  return `在${contextTranslation}里，你就是${traitTranslation}。`;
}

function sanitizeChineseTranslation(chinese, english = '', section = '') {
  const source = normalizeText(chinese);
  if (!source || hasBrokenPlaceholder(source)) {
    const englishText = normalizeText(english);
    if (section === 'insults') {
      const translated = translateInsultSentence(englishText);
      if (translated) return translated;
    }
    return englishText || '暂无中文释义';
  }
  return source;
}

function normalizeToneMode(inputMode) {
  const mode = normalizeText(inputMode);
  return TONE_MODE_PROFILE_MAP[mode] ? mode : DEFAULT_TONE_MODE;
}

function getToneProfile(inputMode) {
  return TONE_MODE_PROFILE_MAP[normalizeToneMode(inputMode)];
}

function normalizeEnglishText(input) {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeChineseText(input) {
  return normalizeText(input)
    .replace(/[，。！？、；：,.!?;:"'`~（）()\[\]【】]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function stemEnglishWord(word) {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function tokenizeEnglish(input) {
  return normalizeEnglishText(input)
    .split(' ')
    .map((token) => stemEnglishWord(token))
    .filter((token) => token && !ENGLISH_STOP_WORDS.has(token));
}

function levenshteinDistance(leftText, rightText) {
  const left = String(leftText || '');
  const right = String(rightText || '');
  const leftLen = left.length;
  const rightLen = right.length;
  const matrix = Array.from({ length: leftLen + 1 }, () => new Array(rightLen + 1).fill(0));

  for (let i = 0; i <= leftLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= rightLen; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= leftLen; i += 1) {
    for (let j = 1; j <= rightLen; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[leftLen][rightLen];
}

function stringSimilarity(leftText, rightText) {
  const left = String(leftText || '');
  const right = String(rightText || '');
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length, 1);
}

function tokenSimilarity(leftTokens, rightTokens) {
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  if (!leftSet.size && !rightSet.size) return 1;
  if (!leftSet.size || !rightSet.size) return 0;

  let intersection = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) intersection += 1;
  });
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

function countKeywordHits(text, keywords) {
  return keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);
}

function startsWithImperative(englishText) {
  const firstWord = normalizeEnglishText(englishText).split(' ')[0];
  return IMPERATIVE_STARTERS.includes(firstWord);
}

function scoreEntryTone(entry, toneProfile) {
  const profile = toneProfile || getToneProfile(DEFAULT_TONE_MODE);
  const englishNorm = normalizeEnglishText(entry.english);
  const chineseNorm = normalizeChineseText(entry.chinese);
  const englishTokenCount = tokenizeEnglish(englishNorm).length;
  const contractions =
    englishNorm.match(/\b(?:don't|can't|won't|you're|it's|that's|ain't|gonna|wanna|gotta)\b/g)
      ?.length || 0;

  const aggressiveScore =
    countKeywordHits(englishNorm, AGGRESSIVE_KEYWORDS_EN) * 1.3 +
    countKeywordHits(chineseNorm, AGGRESSIVE_KEYWORDS_CN) * 1.6 +
    (startsWithImperative(englishNorm) ? 0.8 : 0) +
    (/!/.test(entry.english || '') ? 0.5 : 0) +
    (/\byour\b/.test(englishNorm) ? 0.2 : 0);

  const colloquialScore =
    countKeywordHits(englishNorm, COLLOQUIAL_KEYWORDS_EN) * 1.1 +
    countKeywordHits(chineseNorm, COLLOQUIAL_KEYWORDS_CN) * 1.2 +
    contractions * 0.75 +
    (englishTokenCount >= 4 && englishTokenCount <= 14 ? 1 : 0) +
    (englishTokenCount <= 10 ? 0.4 : 0);

  const formalPenalty = countKeywordHits(englishNorm, FORMAL_KEYWORDS_EN) * 0.55;
  const lengthPenalty = Math.max(0, englishTokenCount - 18) * 0.08;

  return {
    total:
      aggressiveScore * profile.scoringWeights.aggressive +
      colloquialScore * profile.scoringWeights.colloquial -
      formalPenalty * profile.scoringWeights.formalPenalty -
      lengthPenalty * profile.scoringWeights.lengthPenalty,
    aggressiveScore,
    colloquialScore,
    englishTokenCount,
  };
}

function isEntrySemanticallySimilar(leftEntry, rightEntry) {
  const leftEnglish = normalizeEnglishText(leftEntry.english);
  const rightEnglish = normalizeEnglishText(rightEntry.english);
  const leftChinese = normalizeChineseText(leftEntry.chinese);
  const rightChinese = normalizeChineseText(rightEntry.chinese);

  if (leftEnglish && rightEnglish) {
    if (leftEnglish === rightEnglish) return true;
    const englishStringSimilarity = stringSimilarity(leftEnglish, rightEnglish);
    const englishTokenSimilarity = tokenSimilarity(
      tokenizeEnglish(leftEnglish),
      tokenizeEnglish(rightEnglish),
    );
    if (englishStringSimilarity >= 0.78) return true;
    if (englishStringSimilarity >= 0.66 && englishTokenSimilarity >= 0.56) return true;
  }

  if (leftChinese && rightChinese) {
    if (leftChinese === rightChinese) return true;
    const chineseSimilarity = stringSimilarity(leftChinese, rightChinese);
    if (chineseSimilarity >= 0.82) return true;
  }

  return false;
}

function isCandidateBetter(current, candidate, toneProfile) {
  if (toneProfile?.id === 'hard') {
    if (candidate.score.aggressiveScore !== current.score.aggressiveScore) {
      return candidate.score.aggressiveScore > current.score.aggressiveScore;
    }
    if (candidate.score.total !== current.score.total) {
      return candidate.score.total > current.score.total;
    }
  } else if (toneProfile?.id === 'light') {
    if (candidate.score.colloquialScore !== current.score.colloquialScore) {
      return candidate.score.colloquialScore > current.score.colloquialScore;
    }
    if (candidate.score.aggressiveScore !== current.score.aggressiveScore) {
      return candidate.score.aggressiveScore < current.score.aggressiveScore;
    }
    if (candidate.score.total !== current.score.total) {
      return candidate.score.total > current.score.total;
    }
  } else if (candidate.score.total !== current.score.total) {
    return candidate.score.total > current.score.total;
  }

  if (candidate.score.aggressiveScore !== current.score.aggressiveScore) {
    return candidate.score.aggressiveScore > current.score.aggressiveScore;
  }
  if (candidate.score.colloquialScore !== current.score.colloquialScore) {
    return candidate.score.colloquialScore > current.score.colloquialScore;
  }
  if (candidate.score.englishTokenCount !== current.score.englishTokenCount) {
    return candidate.score.englishTokenCount < current.score.englishTokenCount;
  }
  return candidate.index < current.index;
}

function dedupeSectionEntries(entries, toneProfile) {
  const clusters = [];

  entries.forEach((entry, index) => {
    const candidate = {
      entry,
      index,
      score: scoreEntryTone(entry, toneProfile),
    };
    const existingCluster = clusters.find(
      (cluster) =>
        isEntrySemanticallySimilar(candidate.entry, cluster.anchor.entry) ||
        isEntrySemanticallySimilar(candidate.entry, cluster.best.entry),
    );

    if (!existingCluster) {
      clusters.push({
        anchor: candidate,
        best: candidate,
      });
      return;
    }

    if (isCandidateBetter(existingCluster.best, candidate, toneProfile)) {
      existingCluster.best = candidate;
    }
  });

  return clusters
    .map((cluster) => cluster.best)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.entry);
}

function cleanSceneEntries(entries, toneProfile) {
  const grouped = entries.reduce((acc, entry) => {
    const sectionId = normalizeText(entry.section) || 'default';
    if (!acc[sectionId]) acc[sectionId] = [];
    acc[sectionId].push(entry);
    return acc;
  }, {});

  const selectedIdSet = new Set();
  Object.keys(grouped).forEach((sectionId) => {
    if (sectionId === 'insults') {
      grouped[sectionId].forEach((entry) => {
        selectedIdSet.add(entry.id);
      });
      return;
    }

    dedupeSectionEntries(grouped[sectionId], toneProfile).forEach((entry) => {
      selectedIdSet.add(entry.id);
    });
  });

  return entries.filter((entry) => selectedIdSet.has(entry.id));
}

function normalizeEntry(entry) {
  const section = normalizeText(entry?.section);
  const sectionFallback = SECTION_TEXT_FALLBACKS[section] || {};
  const english = normalizeText(entry?.english);
  return {
    id: normalizeText(entry?.id),
    sceneId: normalizeText(entry?.sceneId),
    section,
    type: normalizeText(entry?.type),
    english,
    chinese: sanitizeChineseTranslation(entry?.chinese, english, section),
    sourcePage: Number(entry?.sourcePage || 0),
    sourceSection: sanitizeText(entry?.sourceSection, sectionFallback.title || '场景句库'),
    sourceKind: normalizeText(entry?.sourceKind),
    baseEntryId: normalizeText(entry?.baseEntryId),
  };
}

function normalizeSection(section) {
  const sectionId = normalizeText(section?.id);
  const fallback = SECTION_TEXT_FALLBACKS[sectionId] || {};
  return {
    id: sectionId,
    title: sanitizeText(section?.title, fallback.title || sectionId),
    description: sanitizeText(section?.description, fallback.description),
  };
}

function normalizeSceneCard(card) {
  return {
    id: normalizeText(card?.id),
    title: sanitizeText(card?.title, card?.id),
    eyebrow: normalizeText(card?.eyebrow),
    tagline: sanitizeText(card?.tagline),
    statement: sanitizeText(card?.statement),
    theme: normalizeText(card?.theme),
  };
}

function normalizeSceneDetail(sceneId, detail, toneProfile) {
  const normalizedEntries = toSafeArray(detail?.entries)
    .map(normalizeEntry)
    .filter((entry) => entry.id);
  const entries = toneProfile
    ? cleanSceneEntries(normalizedEntries, toneProfile)
    : normalizedEntries;

  return {
    id: sceneId,
    title: sanitizeText(detail?.title, sceneId),
    tagline: sanitizeText(detail?.tagline),
    intro: sanitizeText(detail?.intro),
    sections: toSafeArray(detail?.sections).map(normalizeSection),
    entries,
  };
}

const sceneCards = toSafeArray(sceneCardsRaw)
  .map(normalizeSceneCard)
  .filter((card) => card.id);
const rawLibrary = (sceneLibraryRaw && sceneLibraryRaw.scenes) || {};
const rawSceneDetailMap = {};
const lightweightCardSummaryMap = {};
const preparedSceneMapByToneMode = {};

Object.keys(rawLibrary).forEach((sceneId) => {
  const normalizedDetail = normalizeSceneDetail(sceneId, rawLibrary[sceneId], null);
  rawSceneDetailMap[sceneId] = normalizedDetail;

  const sectionCountMap = normalizedDetail.entries.reduce((acc, entry) => {
    const sectionId = normalizeText(entry.section);
    if (!sectionId) return acc;
    acc[sectionId] = Number(acc[sectionId] || 0) + 1;
    return acc;
  }, {});
  const sectionStats = normalizedDetail.sections.map((section) => ({
    id: section.id,
    title: section.title,
    count: Number(sectionCountMap[section.id] || 0),
  }));
  lightweightCardSummaryMap[sceneId] = {
    sectionStats,
    totalCount: normalizedDetail.entries.length,
  };
});

const rawEntryById = Object.values(rawSceneDetailMap)
  .flatMap((detail) => detail.entries)
  .reduce((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {});

function buildSceneDetailMapForToneMode(toneMode) {
  const mode = normalizeToneMode(toneMode);
  if (preparedSceneMapByToneMode[mode]) return preparedSceneMapByToneMode[mode];

  const toneProfile = getToneProfile(mode);
  const sceneDetailMap = {};

  Object.keys(rawSceneDetailMap).forEach((sceneId) => {
    const rawDetail = rawSceneDetailMap[sceneId];
    const cleanedEntries = cleanSceneEntries(rawDetail.entries, toneProfile);
    const enrichedEntries = cleanedEntries.map((entry) => ({
      ...entry,
      baseEntryEnglish: entry.baseEntryId
        ? normalizeText(rawEntryById[entry.baseEntryId]?.english)
        : '',
    }));

    sceneDetailMap[sceneId] = {
      ...rawDetail,
      entries: enrichedEntries,
      sections: rawDetail.sections.map((section) => ({
        ...section,
        entries: enrichedEntries
          .filter((entry) => entry.section === section.id)
          .map((entry) => ({ ...entry })),
      })),
    };
  });

  preparedSceneMapByToneMode[mode] = sceneDetailMap;
  return sceneDetailMap;
}

function buildCardSummary(card, sceneDetailMap) {
  const detail = sceneDetailMap[card.id];
  const entries = detail ? detail.entries : [];
  const sectionStats = detail
    ? detail.sections.map((section) => ({
        id: section.id,
        title: section.title,
        count: entries.filter((entry) => entry.section === section.id).length,
      }))
    : [];

  return {
    ...card,
    sectionStats,
    totalCount: entries.length,
  };
}

function buildLightweightCardSummary(card) {
  const lightweightSummary = lightweightCardSummaryMap[card.id];
  return {
    ...card,
    sectionStats: lightweightSummary
      ? lightweightSummary.sectionStats.map((section) => ({ ...section }))
      : [],
    totalCount: lightweightSummary ? lightweightSummary.totalCount : 0,
  };
}

function resolveToneMode(options) {
  return normalizeToneMode(options?.toneMode || activeToneMode);
}

export default {
  getToneModeOptions() {
    return TONE_MODE_OPTIONS.map(({ id, label, description }) => ({
      id,
      label,
      description,
    }));
  },
  getToneMode() {
    return activeToneMode;
  },
  setToneMode(toneMode) {
    activeToneMode = normalizeToneMode(toneMode);
    return activeToneMode;
  },
  listSceneCards(options = {}) {
    const toneMode = resolveToneMode(options);
    const sceneDetailMap = buildSceneDetailMapForToneMode(toneMode);
    return sceneCards.map((card) => buildCardSummary(card, sceneDetailMap));
  },
  listSceneCardsLite() {
    return sceneCards.map((card) => buildLightweightCardSummary(card));
  },
  getSceneById(sceneId, options = {}) {
    const toneMode = resolveToneMode(options);
    const sceneDetailMap = buildSceneDetailMapForToneMode(toneMode);
    const targetId = normalizeText(sceneId);
    const card = sceneCards.find((item) => item.id === targetId);
    const detail = sceneDetailMap[targetId];
    if (!card || !detail) return null;

    const summary = buildCardSummary(card, sceneDetailMap);
    return {
      ...summary,
      ...detail,
      toneMode,
    };
  },
};
