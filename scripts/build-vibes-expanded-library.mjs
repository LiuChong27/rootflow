import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());
const dataDir = path.join(rootDir, 'data', 'vibes');

const sectionDefs = [
  {
    id: 'phrases',
    title: '骂人短句',
    description: '适合正面开怼、直接顶回去的短句。',
  },
  {
    id: 'sarcasm',
    title: '冷嘲热讽',
    description: '适合阴阳怪气、反讽、带刺输出的短句。',
  },
  {
    id: 'shutdown',
    title: '补刀短句',
    description: '适合打断、堵嘴、让对方闭环的短句。',
  },
  {
    id: 'insults',
    title: 'High Pressure',
    description: 'Loaded from maren.txt.',
  },
];
const regularSectionDefs = sectionDefs.filter((section) => section.id !== 'insults');
const highPressureSectionDefs = sectionDefs.filter((section) => section.id === 'insults');
const highPressureSceneId = 'mom-swears';
const halfPrunedSceneIds = new Set([
  'office-comeback',
  'campus-snark',
  'cafeteria-chaos',
  'social-platform',
]);

const templates = [
  {
    section: 'phrases',
    english: 'You turn every {subject} into {result}.',
    chinese: '你能把每次{subjectZh}都搞成{resultZh}。',
  },
  {
    section: 'phrases',
    english: 'Watching you handle {subject} is like watching {comparison}.',
    chinese: '看你处理{subjectZh}，就像看{comparisonZh}。',
  },
  {
    section: 'phrases',
    english: 'You make {subject} look harder than it is.',
    chinese: '你能把{subjectZh}搞得比它本来难十倍。',
  },
  {
    section: 'phrases',
    english: 'The moment {subject} reaches you, it starts looking embarrassing.',
    chinese: '{subjectZh}一到你手里，立刻就开始丢人。',
  },
  {
    section: 'sarcasm',
    english: 'Amazing. Another {subject} ruined right on schedule.',
    chinese: '厉害，又一次准时把{subjectZh}搞砸了。',
  },
  {
    section: 'sarcasm',
    english: 'Bold of you to be that {trait} with results like this.',
    chinese: '都这种结果了，你还敢这么{traitZh}，脸皮是真厚。',
  },
  {
    section: 'sarcasm',
    english: 'Right, because your {subject} is always such a success story.',
    chinese: '对，毕竟你的{subjectZh}一直都是“成功案例”。',
  },
  {
    section: 'shutdown',
    english: 'Save it. Your {issue} is not my problem.',
    chinese: '省省吧，你这套{issueZh}跟我没关系。',
  },
  {
    section: 'shutdown',
    english: 'Try that {issue} on someone more patient.',
    chinese: '你这套{issueZh}，去找个更有耐心的人听。',
  },
  {
    section: 'shutdown',
    english: 'Take that {trait} somewhere else.',
    chinese: '带着你的{traitZh}去别处。',
  },
];

const insultsSourcePath = path.join(dataDir, 'maren.txt');
const sharedInsultSceneContextMap = {
  [highPressureSceneId]: 'mother-insult rant',
};
const sharedInsultThemes = [
  'causing chaos and acting reckless',
  'running your mouth without backing it up',
  'turning a small situation into a spectacle',
  'making yourself look ridiculous in public',
  'bringing mess and embarrassment everywhere',
  'acting loud while adding nothing useful',
  'doubling down on behavior that looks worse by the second',
  'mistaking noise for pressure and attitude for power',
  'pulling other people into a pointless mess',
  'behaving like conflict is a performance',
  'looking bold while your behavior falls apart',
  'making a scene instead of making sense',
];

function loadSharedInsults() {
  if (!fs.existsSync(insultsSourcePath)) {
    return [];
  }

  const numberedLineMap = new Map();
  const lines = fs.readFileSync(insultsSourcePath, 'utf8').split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const match = trimmed.match(/^(\d+)\.(.*)$/);
    if (!match) return;

    const index = Number(match[1]);
    const content = String(match[2] || '').trim();
    if (!index || !content) return;

    if (!numberedLineMap.has(index)) {
      numberedLineMap.set(index, []);
    }

    numberedLineMap.get(index).push(content);
  });

  return Array.from(numberedLineMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([index, variants]) => ({
      index,
      chinese: variants[0] || '',
      englishSource: variants[1] || '',
    }))
    .filter((entry) => entry.chinese);
}

const sharedInsults = loadSharedInsults();

const entryOverrides = {
  'office-comeback-01-02': {
    english: 'You have no results, but plenty of attitude.',
    chinese: '结果拿不出来，态度倒是很积极。',
  },
  'office-comeback-01-03': {
    english: 'This is not a suggestion. It is a basic requirement.',
    chinese: '这不是建议，这是基本要求。',
  },
  'office-comeback-01-04': {
    english: 'Solve the problem first, then talk about your ideas.',
    chinese: '先把问题解决，再谈你的想法。',
  },
  'office-comeback-01-07': {
    english: 'Straighten out your logic before you try to report up.',
    chinese: '汇报之前，至少先把逻辑理顺。',
  },
  'campus-snark-01-02': {
    english: 'If you did not even understand the question, spare me the commentary.',
    chinese: '题都没看懂，就别急着点评别人。',
  },
  'campus-snark-01-03': {
    english: 'This is not effort. This is you performing for yourself.',
    chinese: '你这不是努力，你这是感动自己。',
  },
  'campus-snark-01-04': {
    english: 'If you do not listen in class, do not act surprised at the exam.',
    chinese: '上课不听，考试别装意外。',
  },
  'cafeteria-chaos-01-02': {
    english: 'Being slow is not the issue. Pretending not to see people is.',
    chinese: '打饭慢不是问题，装看不见人才离谱。',
  },
  'cafeteria-chaos-01-03': {
    english: 'Stop shaking that spoon. At this rate it is going to be all soup.',
    chinese: '阿姨手别抖了，再抖就只剩汤了。',
  },
  'cafeteria-chaos-01-04': {
    english: 'The line is not decoration. Do not mistake bad manners for casualness.',
    chinese: '排队不是摆设，别把没素质当随性。',
  },
  'gaming-rage-01-02': {
    english: 'Your mechanics cannot keep up, but your mouth never logs off.',
    chinese: '操作跟不上，嘴倒是一直在线。',
  },
  'gaming-rage-01-03': {
    english: 'You are not playing the game. You are feeding the enemy highlight clips.',
    chinese: '你不是在打游戏，你是在给对面送素材。',
  },
  'gaming-rage-01-04': {
    english: 'It is fine not to know how to play. It is not fine to cosplay shot-caller.',
    chinese: '不会玩没关系，别硬演指挥位。',
  },
  'social-platform-01-02': {
    english: 'Your take is hollow, but your tone is strangely full.',
    chinese: '观点空得发响，语气倒挺满。',
  },
  'social-platform-01-03': {
    english: 'This is not insight. It is recycled emotion.',
    chinese: '你这不是输出，是复制情绪。',
  },
  'social-platform-01-04': {
    english: 'Do not dress up something shallow as depth.',
    chinese: '别把浅显包装成深刻。',
  },
};

function buildSharedInsultEnglish(scene, insultIndex) {
  const context = sharedInsultSceneContextMap[scene.id] || 'conflict';
  const theme = sharedInsultThemes[insultIndex % sharedInsultThemes.length];
  return `High-pressure ${context} line about ${theme}.`;
}

function pruneSceneEntriesByHalf(sceneId, entries) {
  if (!halfPrunedSceneIds.has(sceneId)) return entries;

  const groupedEntries = entries.reduce((acc, entry) => {
    const sectionId = String(entry?.section || '').trim() || 'default';
    if (!acc[sectionId]) acc[sectionId] = [];
    acc[sectionId].push(entry);
    return acc;
  }, {});
  const keptEntryIds = new Set();

  Object.values(groupedEntries).forEach((sectionEntries) => {
    sectionEntries.forEach((entry, index) => {
      if (index % 2 === 0) {
        keptEntryIds.add(entry.id);
      }
    });
  });

  return entries.filter((entry) => keptEntryIds.has(entry.id));
}

const sceneDefinitions = [
  {
    id: 'office-comeback',
    title: '职场',
    eyebrow: 'OFFICE COMEBACK',
    tagline: '甩锅、越界、拖进度、装专业时，办公室里该怎么带刺回去。',
    statement: '不用爆粗，也能把不爽说得很扎实。',
    intro: '适合开会、协作、汇报、交接、甩锅、拖延这些办公室高频摩擦场景。',
    theme: 'slate-graphite',
    items: [
      {
        subject: 'project handoff',
        subjectZh: '项目交接',
        result: 'a delayed mess',
        resultZh: '一场延期烂摊子',
        comparison: 'a relay race with nobody holding the baton',
        comparisonZh: '一场没人接棒的接力赛',
        trait: 'confidently unprepared',
        traitZh: '没准备还很自信',
        issue: '甩锅说法',
        issueZh: '甩锅说法',
      },
      {
        subject: 'meeting update',
        subjectZh: '会议汇报',
        result: 'a longer problem',
        resultZh: '一个被拉长的问题',
        comparison: 'a slide deck hiding from the point',
        comparisonZh: '一份拼命躲重点的幻灯片',
        trait: 'vaguely professional',
        traitZh: '模糊装专业',
        issue: '官话套话',
        issueZh: '官话套话',
      },
      {
        subject: 'deadline',
        subjectZh: '截止时间',
        result: 'someone else’s emergency',
        resultZh: '别人的紧急任务',
        comparison: 'a fire alarm that rings after the smoke',
        comparisonZh: '起火后才响的警报器',
        trait: 'casually irresponsible',
        traitZh: '不负责得很随意',
        issue: '延期借口',
        issueZh: '延期借口',
      },
      {
        subject: 'status report',
        subjectZh: '进度报告',
        result: 'guesswork with bullet points',
        resultZh: '加了项目符号的瞎猜',
        comparison: 'a spreadsheet trying to improvise',
        comparisonZh: '一张靠 improvising 的表格',
        trait: 'fake-efficient',
        traitZh: '假装高效',
        issue: '进度表演',
        issueZh: '进度表演',
      },
      {
        subject: 'feedback round',
        subjectZh: '反馈轮次',
        result: 'a blame session',
        resultZh: '一场甩锅会',
        comparison: 'a mirror refusing to reflect',
        comparisonZh: '一面拒绝照自己的镜子',
        trait: 'allergic to accountability',
        traitZh: '对负责过敏',
        issue: '推责语气',
        issueZh: '推责语气',
      },
      {
        subject: 'client call',
        subjectZh: '客户电话',
        result: 'a credibility leak',
        resultZh: '一场信誉漏水',
        comparison: 'a script forgetting its own lines',
        comparisonZh: '一个忘词的剧本',
        trait: 'loudly underqualified',
        traitZh: '能力不够还声音很大',
        issue: '场面话',
        issueZh: '场面话',
      },
      {
        subject: 'task breakdown',
        subjectZh: '任务拆分',
        result: 'confusion with formatting',
        resultZh: '排版精致的混乱',
        comparison: 'a checklist built on wishful thinking',
        comparisonZh: '一张建立在幻想上的清单',
        trait: 'organized-looking only',
        traitZh: '只会表面整齐',
        issue: '流程腔',
        issueZh: '流程腔',
      },
      {
        subject: 'follow-up email',
        subjectZh: '跟进邮件',
        result: 'extra noise',
        resultZh: '额外噪音',
        comparison: 'an auto-reply pretending to have opinions',
        comparisonZh: '一个装作有观点的自动回复',
        trait: 'passive-aggressive',
        traitZh: '阴阳怪气',
        issue: '邮件腔调',
        issueZh: '邮件腔调',
      },
      {
        subject: 'last-minute request',
        subjectZh: '临时需求',
        result: 'a time theft',
        resultZh: '偷时间行为',
        comparison: 'someone sprinting with no map',
        comparisonZh: '一个没地图还硬冲的人',
        trait: 'boundary-blind',
        traitZh: '完全没边界感',
        issue: '加塞话术',
        issueZh: '加塞话术',
      },
      {
        subject: 'team collaboration',
        subjectZh: '团队协作',
        result: 'solo damage at scale',
        resultZh: '放大型单人破坏',
        comparison: 'a group chat full of typing indicators and zero answers',
        comparisonZh: '一个全是“正在输入”却没人解决问题的群聊',
        trait: 'professionally exhausting',
        traitZh: '职业化消耗别人',
        issue: '协作废话',
        issueZh: '协作废话',
      },
    ],
  },
  {
    id: 'campus-snark',
    title: '校园',
    eyebrow: 'CAMPUS SNARK',
    tagline: '课堂、小组作业、社团、宿舍、考试周，这些场景里的讽刺和回怼全整理出来。',
    statement: '校园冲突往往很幼稚，但回嘴不能太幼稚。',
    intro: '适合课堂抬杠、小组划水、社团画饼、宿舍惹事、考试周互相烦人的时候。',
    theme: 'rose-smoke',
    items: [
      {
        subject: 'group project',
        subjectZh: '小组作业',
        result: 'a solo rescue mission',
        resultZh: '单人救火现场',
        comparison: 'a team presentation built on missing slides',
        comparisonZh: '一场靠丢页撑着的汇报',
        trait: 'proudly useless',
        traitZh: '没贡献还挺骄傲',
        issue: '划水借口',
        issueZh: '划水借口',
      },
      {
        subject: 'class discussion',
        subjectZh: '课堂讨论',
        result: 'background noise',
        resultZh: '背景噪音',
        comparison: 'a microphone feeding back to itself',
        comparisonZh: '一个对着自己回授的麦克风',
        trait: 'loud without substance',
        traitZh: '只会大声没内容',
        issue: '课堂发言腔',
        issueZh: '课堂发言腔',
      },
      {
        subject: 'attendance check',
        subjectZh: '点名',
        result: 'a drama performance',
        resultZh: '一场戏',
        comparison: 'an actor forgetting the easiest line',
        comparisonZh: '一个连最简单台词都忘的演员',
        trait: 'casually shameless',
        traitZh: '脸不红心不跳',
        issue: '缺勤说辞',
        issueZh: '缺勤说辞',
      },
      {
        subject: 'exam review',
        subjectZh: '考前复习',
        result: 'panic with stationery',
        resultZh: '拿着文具的恐慌',
        comparison: 'a highlighter trying to invent knowledge',
        comparisonZh: '一支试图凭空标出知识点的荧光笔',
        trait: 'dramatically unprepared',
        traitZh: '没准备还要演',
        issue: '临时抱佛脚发言',
        issueZh: '临时抱佛脚发言',
      },
      {
        subject: 'lab report',
        subjectZh: '实验报告',
        result: 'formatted confusion',
        resultZh: '格式完整的混乱',
        comparison: 'a graph guessing its own data',
        comparisonZh: '一张自己猜数据的图表',
        trait: 'confidently wrong',
        traitZh: '错得很自信',
        issue: '实验室套话',
        issueZh: '实验室套话',
      },
      {
        subject: 'dorm room rule',
        subjectZh: '宿舍规矩',
        result: 'something optional to you',
        resultZh: '像只对别人有效',
        comparison: 'a door sign nobody taught you to read',
        comparisonZh: '一张你永远看不懂的门牌提醒',
        trait: 'boundary-free',
        traitZh: '完全没边界感',
        issue: '宿舍借口',
        issueZh: '宿舍借口',
      },
      {
        subject: 'club planning',
        subjectZh: '社团策划',
        result: 'a promise factory',
        resultZh: '空话工厂',
        comparison: 'a whiteboard full of arrows and zero action',
        comparisonZh: '一块箭头很多但没人干活的白板',
        trait: 'good at promising',
        traitZh: '只会画饼',
        issue: '社团官话',
        issueZh: '社团官话',
      },
      {
        subject: 'library silence',
        subjectZh: '图书馆安静',
        result: 'a suggestion you ignore',
        resultZh: '一个你自动忽略的建议',
        comparison: 'a ringtone pretending to whisper',
        comparisonZh: '一个假装自己很小声的铃声',
        trait: 'annoyingly oblivious',
        traitZh: '吵而不自知',
        issue: '打扰别人那套',
        issueZh: '打扰别人那套',
      },
      {
        subject: 'presentation slide',
        subjectZh: '汇报幻灯片',
        result: 'a public apology waiting to happen',
        resultZh: '一场等着现场道歉的事故',
        comparison: 'a template begging for mercy',
        comparisonZh: '一个都看不下去的模板',
        trait: 'underprepared and proud',
        traitZh: '没准备还很得意',
        issue: '展示说辞',
        issueZh: '展示说辞',
      },
      {
        subject: 'campus rumor',
        subjectZh: '校园八卦',
        result: 'your whole personality',
        resultZh: '你的主要人格组成',
        comparison: 'a notification page trying to be a newspaper',
        comparisonZh: '一个想当报纸的通知栏',
        trait: 'nosy and excited',
        traitZh: '爱打听还很兴奋',
        issue: '打听口吻',
        issueZh: '打听口吻',
      },
    ],
  },
  {
    id: 'cafeteria-chaos',
    title: '食堂',
    eyebrow: 'CAFETERIA CHAOS',
    tagline: '排队、抢位、插队、点评别人吃什么，这些食堂场景里的火气全归档。',
    statement: '一顿饭而已，有些人偏要吃出火药味。',
    intro: '适合食堂排队、窗口点餐、抢座位、评论别人餐盘、插队、蹭桌这些高频摩擦场景。',
    theme: 'ash-crimson',
    items: [
      {
        subject: 'lunch line',
        subjectZh: '午饭排队',
        result: 'a test of public patience',
        resultZh: '公共耐心测试',
        comparison: 'a traffic jam made of trays',
        comparisonZh: '一场由餐盘组成的堵车',
        trait: 'line-cutting',
        traitZh: '插队成性',
        issue: '插队理由',
        issueZh: '插队理由',
      },
      {
        subject: 'tray handling',
        subjectZh: '端餐盘',
        result: 'a hazard zone',
        resultZh: '危险区域',
        comparison: 'a chair trying to dodge soup',
        comparisonZh: '一把拼命躲汤的椅子',
        trait: 'recklessly careless',
        traitZh: '冒失到离谱',
        issue: '手滑借口',
        issueZh: '手滑借口',
      },
      {
        subject: 'seat choosing',
        subjectZh: '找座位',
        result: 'territorial drama',
        resultZh: '领地闹剧',
        comparison: 'a parking dispute with chopsticks',
        comparisonZh: '一场带筷子的停车纠纷',
        trait: 'weirdly possessive',
        traitZh: '占座占得很离谱',
        issue: '占位说法',
        issueZh: '占位说法',
      },
      {
        subject: 'food comment',
        subjectZh: '点评别人吃什么',
        result: 'unsolicited nonsense',
        resultZh: '没人要的废话',
        comparison: 'a menu acting like a judge',
        comparisonZh: '一个突然开始判案的菜单',
        trait: 'nosy and rude',
        traitZh: '嘴欠又多管闲事',
        issue: '点评口吻',
        issueZh: '点评口吻',
      },
      {
        subject: 'extra sauce request',
        subjectZh: '多要点酱料',
        result: 'a negotiation scene',
        resultZh: '一场谈判现场',
        comparison: 'someone bargaining over one grain of rice',
        comparisonZh: '一个为了几粒米就开始砍价的人',
        trait: 'petty and loud',
        traitZh: '小气还大声',
        issue: '磨人话术',
        issueZh: '磨人话术',
      },
      {
        subject: 'table manners',
        subjectZh: '吃饭礼貌',
        result: 'background damage',
        resultZh: '对周围人的持续伤害',
        comparison: 'a spoon losing a fight with gravity',
        comparisonZh: '一把不断输给重力的勺子',
        trait: 'publicly annoying',
        traitZh: '公开烦人',
        issue: '没礼貌那套',
        issueZh: '没礼貌那套',
      },
      {
        subject: 'window order',
        subjectZh: '窗口点餐',
        result: 'confusion on repeat',
        resultZh: '循环播放的混乱',
        comparison: 'a receipt printer trying to sigh',
        comparisonZh: '一台想叹气的小票机',
        trait: 'indecisive and slow',
        traitZh: '又磨蹭又犹豫',
        issue: '磨蹭说辞',
        issueZh: '磨蹭说辞',
      },
      {
        subject: 'borrowed chair',
        subjectZh: '借椅子',
        result: 'a tiny power trip',
        resultZh: '小型权力秀',
        comparison: 'someone guarding plastic furniture like treasure',
        comparisonZh: '一个把塑料椅子当宝守的人',
        trait: 'stingy and dramatic',
        traitZh: '小气又爱演',
        issue: '护食堂资源那套',
        issueZh: '护食堂资源那套',
      },
      {
        subject: 'crowded rush hour',
        subjectZh: '高峰期人挤人',
        result: 'your excuse to act rude',
        resultZh: '你没礼貌的借口',
        comparison: 'an elbow with a timetable',
        comparisonZh: '一个带时间表的胳膊肘',
        trait: 'aggressively impatient',
        traitZh: '急得像在打仗',
        issue: '赶时间口吻',
        issueZh: '赶时间口吻',
      },
      {
        subject: 'meal break',
        subjectZh: '吃饭休息',
        result: 'a disturbance',
        resultZh: '一场打扰',
        comparison: 'a table alarm nobody installed',
        comparisonZh: '一个没人装过的餐桌警报器',
        trait: 'loud for no reason',
        traitZh: '没理由地吵',
        issue: '打扰别人那套',
        issueZh: '打扰别人那套',
      },
    ],
  },
  {
    id: 'gaming-rage',
    title: '打游戏',
    eyebrow: 'GAMING RAGE',
    tagline: '队友摆烂、乱指挥、瞎开麦、送节奏时，能直接甩出去的短句都放这里。',
    statement: '游戏里最怕的不是输，是有人一边送一边吵。',
    intro: '适合排位、开黑、语音、对线、团战、赛后互喷这些高频游戏场景。',
    theme: 'arcade-neon',
    items: [
      {
        subject: 'team fight',
        subjectZh: '团战',
        result: 'a highlight reel for the wrong team',
        resultZh: '对面集锦素材',
        comparison: 'a flashlight pointing at every mistake',
        comparisonZh: '一支专门照失误的手电筒',
        trait: 'recklessly loud',
        traitZh: '送得很大声',
        issue: '甩锅麦克风',
        issueZh: '甩锅麦克风',
      },
      {
        subject: 'map call',
        subjectZh: '报点',
        result: 'late information',
        resultZh: '过期情报',
        comparison: 'a minimap loading after the fight',
        comparisonZh: '一张团战结束后才刷新的小地图',
        trait: 'confidently late',
        traitZh: '慢半拍还很自信',
        issue: '报点借口',
        issueZh: '报点借口',
      },
      {
        subject: 'lane trade',
        subjectZh: '对线换血',
        result: 'free value for the enemy',
        resultZh: '给对面的免费福利',
        comparison: 'a gift box with your HP bar inside',
        comparisonZh: '一个装着你血条的礼盒',
        trait: 'eager to int',
        traitZh: '迫不及待送人头',
        issue: '送掉那套',
        issueZh: '送掉那套',
      },
      {
        subject: 'objective timing',
        subjectZh: '控资源时机',
        result: 'a missed window',
        resultZh: '一整个错过窗口',
        comparison: 'a stopwatch allergic to urgency',
        comparisonZh: '一个对紧迫感过敏的秒表',
        trait: 'clueless under pressure',
        traitZh: '压力一来就断线',
        issue: '节奏发言',
        issueZh: '节奏发言',
      },
      {
        subject: 'voice comms',
        subjectZh: '语音沟通',
        result: 'pure static',
        resultZh: '纯噪音',
        comparison: 'a radio fighting with itself',
        comparisonZh: '一台和自己打架的对讲机',
        trait: 'annoyingly backseat',
        traitZh: '嘴上指挥型',
        issue: '嘴指挥那套',
        issueZh: '嘴指挥那套',
      },
      {
        subject: 'cooldown tracking',
        subjectZh: '技能冷却判断',
        result: 'random hope',
        resultZh: '随机希望',
        comparison: 'a calculator guessing numbers',
        comparisonZh: '一台靠猜算数的计算器',
        trait: 'guess-heavy',
        traitZh: '全靠猜',
        issue: '乱喊开团',
        issueZh: '乱喊开团',
      },
      {
        subject: 'queue decision',
        subjectZh: '继续排位这个决定',
        result: 'a bad idea with loading music',
        resultZh: '带加载音乐的坏主意',
        comparison: 'a button asking to be ignored',
        comparisonZh: '一个明明该别点却还是点下去的按钮',
        trait: 'tilted and stubborn',
        traitZh: '上头还嘴硬',
        issue: '硬排借口',
        issueZh: '硬排借口',
      },
      {
        subject: 'aim',
        subjectZh: '准头',
        result: 'a warning sign',
        resultZh: '风险提示',
        comparison: 'a cursor running away from the target',
        comparisonZh: '一个拼命躲目标的准星',
        trait: 'all confidence no accuracy',
        traitZh: '自信拉满命中归零',
        issue: '枪法嘴硬',
        issueZh: '枪法嘴硬',
      },
      {
        subject: 'rotation',
        subjectZh: '转线',
        result: 'a scenic tour',
        resultZh: '观光路线',
        comparison: 'a taxi with no destination',
        comparisonZh: '一辆没有目的地的出租车',
        trait: 'permanently lost',
        traitZh: '长期迷路',
        issue: '迷路解释',
        issueZh: '迷路解释',
      },
      {
        subject: 'post-game analysis',
        subjectZh: '赛后复盘',
        result: 'fiction with opinions',
        resultZh: '带观点的虚构文学',
        comparison: 'a scoreboard begging to be ignored',
        comparisonZh: '一块希望大家别看的战绩板',
        trait: 'loud after losing',
        traitZh: '输了更爱叫',
        issue: '赛后甩锅',
        issueZh: '赛后甩锅',
      },
    ],
  },
  {
    id: 'social-platform',
    title: '社交平台',
    eyebrow: 'SOCIAL PLATFORM',
    tagline: '评论区、转发区、私信、热评、钓鱼发言，这些线上场景里的反讽全放进来。',
    statement: '有些人不值得长篇大论，短句就够了。',
    intro: '适合评论区开杠、社交平台阴阳、转发带刺、私信烦人、热度表演这些线上场景。',
    theme: 'obsidian-alert',
    items: [
      {
        subject: 'comment section',
        subjectZh: '评论区',
        result: 'a landfill of opinions',
        resultZh: '观点垃圾场',
        comparison: 'a megaphone arguing with a mirror',
        comparisonZh: '一个对着镜子喊话的喇叭',
        trait: 'performatively loud',
        traitZh: '表演型大声',
        issue: '评论区套路',
        issueZh: '评论区套路',
      },
      {
        subject: 'hot take',
        subjectZh: '热评观点',
        result: 'recycled noise',
        resultZh: '回收噪音',
        comparison: 'an old post wearing new punctuation',
        comparisonZh: '一条换了标点的旧帖子',
        trait: 'confidently recycled',
        traitZh: '搬运还很自信',
        issue: '观点腔调',
        issueZh: '观点腔调',
      },
      {
        subject: 'quote post',
        subjectZh: '转发带评',
        result: 'cheap attitude',
        resultZh: '廉价态度',
        comparison: 'a screenshot trying to sound brave',
        comparisonZh: '一张想装勇敢的截图',
        trait: 'passive-aggressive',
        traitZh: '阴阳怪气',
        issue: '转发阴阳',
        issueZh: '转发阴阳',
      },
      {
        subject: 'private message',
        subjectZh: '私信',
        result: 'unsolicited nonsense',
        resultZh: '没人要的废话',
        comparison: 'a notification nobody invited',
        comparisonZh: '一个根本没人请来的通知',
        trait: 'weirdly entitled',
        traitZh: '自来熟得离谱',
        issue: '私信说辞',
        issueZh: '私信说辞',
      },
      {
        subject: 'ratio attempt',
        subjectZh: '想靠带节奏压人',
        result: 'public secondhand embarrassment',
        resultZh: '公开丢人',
        comparison: 'a crowd chant with no rhythm',
        comparisonZh: '一段完全不齐的起哄',
        trait: 'desperately online',
        traitZh: '上网上急了',
        issue: '带节奏那套',
        issueZh: '带节奏那套',
      },
      {
        subject: 'caption',
        subjectZh: '配文',
        result: 'borrowed personality',
        resultZh: '借来的个性',
        comparison: 'a slogan trying to be a soul',
        comparisonZh: '一条试图冒充灵魂的口号',
        trait: 'try-hard',
        traitZh: '硬凹人设',
        issue: '装腔作势那套',
        issueZh: '装腔作势那套',
      },
      {
        subject: 'reply thread',
        subjectZh: '楼中楼回复',
        result: 'a staircase of nonsense',
        resultZh: '一层层废话',
        comparison: 'a chain of people missing the point together',
        comparisonZh: '一群人排队偏题',
        trait: 'argument-hungry',
        traitZh: '见杠就上',
        issue: '抬杠流程',
        issueZh: '抬杠流程',
      },
      {
        subject: 'engagement farming',
        subjectZh: '骗互动',
        result: 'obvious bait',
        resultZh: '明显诱饵',
        comparison: 'a hook painted with emojis',
        comparisonZh: '一枚涂满表情包的鱼钩',
        trait: 'attention-starved',
        traitZh: '缺关注感',
        issue: '钓鱼文案',
        issueZh: '钓鱼文案',
      },
      {
        subject: 'algorithm advice',
        subjectZh: '教别人怎么做内容',
        result: 'guesswork in guru packaging',
        resultZh: '包装成经验的瞎猜',
        comparison: 'a tutorial built on luck',
        comparisonZh: '一篇建立在运气上的教程',
        trait: 'fake-expert',
        traitZh: '装专家',
        issue: '大师口吻',
        issueZh: '大师口吻',
      },
      {
        subject: 'repost opinion',
        subjectZh: '转别人内容后附带高论',
        result: 'borrowed confidence',
        resultZh: '借来的自信',
        comparison: 'a watermark trying to lead the conversation',
        comparisonZh: '一个水印突然想主导讨论',
        trait: 'originality-free',
        traitZh: '原创能力归零',
        issue: '借题发挥那套',
        issueZh: '借题发挥那套',
      },
    ],
  },
  {
    id: highPressureSceneId,
    title: '含妈脏话',
    eyebrow: 'MOM SWEARS',
    tagline: '把 High Pressure 单独拆出来，集中放这一类更重口的含妈脏话。',
    statement: '这一张卡只放 High Pressure，不混进其他场景。',
    intro: '这里单独收纳 High Pressure 里的含妈脏话内容，和其他场景彻底拆开。',
    theme: 'obsidian-alert',
    items: [],
  },
];

function applyTemplate(template, item) {
  const english = template.english.replace(/\{(\w+)\}/g, (_, key) => item[key] || '');
  const chinese = template.chinese.replace(/\{(\w+)\}/g, (_, key) => item[key] || '');
  return { english, chinese };
}

function buildEntries(scene) {
  const entries = [];

  if (scene.id === highPressureSceneId) {
    sharedInsults.forEach((insult, insultIndex) => {
      entries.push({
        id: `${scene.id}-insults-${String(insult.index).padStart(2, '0')}`,
        sceneId: scene.id,
        section: 'insults',
        type: 'phrase',
        english: buildSharedInsultEnglish(scene, insultIndex),
        chinese: insult.chinese,
        sourcePage: 0,
        sourceSection:
          sectionDefs.find((section) => section.id === 'insults')?.title || 'High Pressure',
        sourceKind: 'crafted',
        baseEntryId: insult.englishSource ? `maren-${String(insult.index).padStart(2, '0')}` : '',
      });
    });

    return entries;
  }

  scene.items.forEach((item, itemIndex) => {
    templates.forEach((template, templateIndex) => {
      const { english, chinese } = applyTemplate(template, item);
      entries.push({
        id: `${scene.id}-${String(itemIndex + 1).padStart(2, '0')}-${String(templateIndex + 1).padStart(2, '0')}`,
        sceneId: scene.id,
        section: template.section,
        type: 'phrase',
        english,
        chinese,
        sourcePage: 0,
        sourceSection:
          sectionDefs.find((section) => section.id === template.section)?.title || '场景定制',
        sourceKind: 'crafted',
        baseEntryId: '',
      });
    });
  });

  const entriesWithOverrides = entries.map((entry) => {
    const override = entryOverrides[entry.id];
    if (!override) {
      return entry;
    }

    return {
      ...entry,
      english: override.english,
      chinese: override.chinese,
    };
  });

  return pruneSceneEntriesByHalf(scene.id, entriesWithOverrides);
}

const sceneCards = sceneDefinitions.map((scene) => ({
  id: scene.id,
  title: scene.title,
  eyebrow: scene.eyebrow,
  tagline: scene.tagline,
  statement: scene.statement,
  theme: scene.theme,
}));

const sceneLibrary = {
  scenes: Object.fromEntries(
    sceneDefinitions.map((scene) => [
      scene.id,
      {
        title: scene.title,
        tagline: scene.tagline,
        intro: scene.intro,
        sections: scene.id === highPressureSceneId ? highPressureSectionDefs : regularSectionDefs,
        entries: buildEntries(scene),
      },
    ]),
  ),
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  path.join(dataDir, 'scene-cards.json'),
  `${JSON.stringify(sceneCards, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(dataDir, 'scene-library.json'),
  `${JSON.stringify(sceneLibrary, null, 2)}\n`,
  'utf8',
);

const totalEntries = Object.values(sceneLibrary.scenes).reduce(
  (sum, scene) => sum + scene.entries.length,
  0,
);

console.log(`Scenes: ${sceneDefinitions.length}`);
console.log(`Total entries: ${totalEntries}`);
