#!/usr/bin/env node
import path from 'node:path';
import { promises as fs } from 'node:fs';

const OUTPUT_WORDS = path.resolve(process.cwd(), 'data/raw/words-flat-fixed.json');
const OUTPUT_ROOTS = path.resolve(process.cwd(), 'data/raw/roots-hierarchy-fixed.json');

function w(...entries) {
  return entries.map(([word, translation, extra = {}]) => ({
    word,
    translation,
    ...extra,
  }));
}

function node(id, root, descriptionCn, options = {}) {
  return {
    id,
    root,
    descriptionCn,
    meaning: options.meaning || '',
    type: options.type || 'word-family',
    notes: options.notes || '',
    sourceLabel: options.sourceLabel || '',
    tag: options.tag || '',
    words: options.words || [],
    children: options.children || [],
  };
}

const tree = node('a', 'A', 'A 词根词缀总图', {
  meaning: 'A root map',
  type: 'root',
  notes: '根据 词根.txt 整理，按文本中的分叉关系展开。',
  children: [
    node('a-other', '其他', '中心节点：其他', {
      type: 'section',
      words: w(
        ['antrop', '人类'],
        ['ac', '尖锐的；锋利；酸的'],
        ['ambul', '走'],
        ['arch', '统治；首领'],
        ['am=amor', '爱'],
        ['anim', '心灵；生命'],
        ['alt', '高'],
        ['aqu', '水'],
      ),
      children: [
        node('antrop', 'antrop', '人类', {
          meaning: 'human',
          type: 'root',
          words: w(['anthropology', '人类学']),
          children: [
            node('anthropology', 'anthropology', '人类学', {
              words: w(['anthropology', '人类学']),
            }),
          ],
        }),
        node('ac', 'ac', '尖锐的；锋利；酸的', {
          meaning: 'sharp/sour',
          type: 'root',
          words: w(
            ['acute', '严重的'],
            ['acet', '变酸'],
            ['acid', '酸、尖酸'],
            ['acrobatics', '杂技'],
          ),
          children: [
            node('ac-acute', 'acute', '严重的', {
              words: w(['acute', '严重的']),
              children: [
                node('acuity', 'acuity', '敏锐', { words: w(['acuity', '敏锐']) }),
                node('acumen', 'acumen', '聪明', { words: w(['acumen', '聪明']) }),
              ],
            }),
            node('acet-aceto', 'acet=aceto', '变酸', {
              type: 'branch',
              words: w(['acet', '变酸'], ['aceto', '变酸']),
            }),
            node('acid-acr', 'acid=acr', '酸、尖酸', {
              type: 'branch',
              words: w(['acid', '酸、尖酸'], ['acr', '酸、尖酸']),
            }),
            node('acrobatics', 'acrobatics', '杂技', {
              words: w(['acrobatics', '杂技']),
              children: [
                node('acrobatic', 'acrobatic', '杂技的', { words: w(['acrobatic', '杂技的']) }),
                node('acrobat', 'acrobat', '杂技演员', { words: w(['acrobat', '杂技演员']) }),
              ],
            }),
          ],
        }),
        node('ambul', 'ambul=walk=走', '走', {
          meaning: 'walk',
          type: 'root',
          words: w(['ambulance', '救护车'], ['ambition', '雄心']),
          children: [
            node('ambulance', 'ambulance', '救护车', { words: w(['ambulance', '救护车']) }),
            node('ambition', 'ambition', '雄心', {
              words: w(['ambition', '雄心']),
              children: [
                node('ambitious', 'ambitious', '有抱负的', { words: w(['ambitious', '有抱负的']) }),
              ],
            }),
          ],
        }),
        node('arch', 'arch=rule', '统治；首领', {
          meaning: 'rule/leader',
          type: 'root',
          words: w(
            ['architect', '建筑师'],
            ['hierarchy', '层级；等级制度'],
            ['monarch', '君主帝王'],
            ['anarchy', '无政府状态；混乱'],
          ),
          children: [
            node('architect', 'architect', '建筑师', {
              words: w(['architect', '建筑师']),
              children: [
                node('architecture', 'architecture', '建筑学', {
                  words: w(['architecture', '建筑学']),
                }),
                node('architectural', 'architectural', '建筑学的', {
                  words: w(['architectural', '建筑学的']),
                }),
              ],
            }),
            node('hierarchy', 'hierarchy', '层级；等级制度', {
              words: w(['hierarchy', '层级；等级制度']),
            }),
            node('monarch', 'monarch', '君主帝王', {
              words: w(['monarch', '君主帝王']),
              children: [
                node('monarchy', 'monarchy', '君主制', { words: w(['monarchy', '君主制']) }),
              ],
            }),
            node('arch-anarchy', 'anarchy', '无政府状态；混乱', {
              words: w(['anarchy', '无政府状态；混乱']),
            }),
          ],
        }),
        node('am-amor', 'am=amor', '爱', {
          meaning: 'love',
          type: 'root',
          words: w(['enamour', '使迷恋'], ['amatoria', '好色的']),
          children: [
            node('enamour', 'enamour', '使迷恋', { words: w(['enamour', '使迷恋']) }),
            node('amatoria', 'amatoria', '好色的', {
              words: w(['amatoria', '好色的']),
              children: [
                node('amorist', 'amorist', '好色之徒', { words: w(['amorist', '好色之徒']) }),
                node('amorous', 'amorous', '好色的', { words: w(['amorous', '好色的']) }),
              ],
            }),
          ],
        }),
        node('anim', 'anim', '心灵；生命', {
          meaning: 'soul/life',
          type: 'root',
          words: w(['unanimous', '无异议的，意见一致的']),
          children: [
            node('unanimous', 'unanimous', '无异议的，意见一致的', {
              words: w(['unanimous', '无异议的，意见一致的']),
            }),
          ],
        }),
        node('alt', 'alt=alti=alto=high', '高', {
          meaning: 'high',
          type: 'root',
          words: w(
            ['altimeter', '高度计'],
            ['alto', '女低音；次高音'],
            ['exaltation', '提升；兴奋'],
            ['altar', '祭坛'],
          ),
          children: [
            node('altimeter', 'altimeter', '高度计', { words: w(['altimeter', '高度计']) }),
            node('alto', 'alto', '女低音；次高音', { words: w(['alto', '女低音；次高音']) }),
            node('exaltation', 'exaltation', '提升；兴奋', {
              words: w(['exaltation', '提升；兴奋']),
            }),
            node('altar', 'altar', '祭坛', { words: w(['altar', '祭坛']) }),
          ],
        }),
        node('aqu', 'aqu=water', '水', {
          meaning: 'water',
          type: 'root',
          words: w(
            ['aquanaut', '潜水人'],
            ['aquamarine', '蓝晶；海蓝宝石'],
            ['aqueous', '像水一样的'],
            ['aquatic', '水生的'],
            ['aqueduct', '沟渠；导水管'],
          ),
          children: [
            node('aquanaut', 'aquanaut', '潜水人', { words: w(['aquanaut', '潜水人']) }),
            node('aquamarine', 'aquamarine', '蓝晶；海蓝宝石', {
              words: w(['aquamarine', '蓝晶；海蓝宝石']),
            }),
            node('aqueous', 'aqueous', '像水一样的', { words: w(['aqueous', '像水一样的']) }),
            node('aquatic', 'aquatic', '水生的', {
              words: w(['aquatic', '水生的']),
              children: [
                node('aquation', 'aquation', '水合作用', { words: w(['aquation', '水合作用']) }),
              ],
            }),
            node('aqueduct', 'aqueduct', '沟渠；导水管', {
              words: w(['aqueduct', '沟渠；导水管']),
            }),
          ],
        }),
      ],
    }),
    node('avi', 'avi=av=avar=bird', '鸟；渴望；贪婪', {
      meaning: 'bird/avid/avarice',
      type: 'root',
      words: w(
        ['auspice', '预兆'],
        ['augur', '占卜'],
        ['avarice', '贪婪'],
        ['avid', '渴望的；贪婪的'],
        ['avian', '鸟的'],
        ['aviate', '飞行'],
      ),
      children: [
        node('auspice', 'auspice', '预兆', {
          words: w(['auspice', '预兆']),
          children: [
            node('auspicious', 'auspicious', '吉兆的', { words: w(['auspicious', '吉兆的']) }),
          ],
        }),
        node('augur', 'augur', '占卜', {
          words: w(['augur', '占卜']),
          children: [
            node('inaugurate', 'inaugurate', '开幕式；就职', {
              words: w(['inaugurate', '开幕式；就职']),
            }),
          ],
        }),
        node('avarice', 'avarice', '贪婪', {
          words: w(['avarice', '贪婪']),
          children: [
            node('avaricious', 'avaricious', '贪婪的', { words: w(['avaricious', '贪婪的']) }),
          ],
        }),
        node('avid', 'avid', '渴望的；贪婪的', {
          words: w(['avid', '渴望的；贪婪的']),
          children: [node('avidity', 'avidity', '贪婪', { words: w(['avidity', '贪婪']) })],
        }),
        node('avian', 'avian', '鸟的', {
          words: w(['avian', '鸟的']),
          children: [
            node('aviary', 'aviary', '鸟舍', {
              words: w(['aviary', '鸟舍']),
              children: [
                node('aviarist', 'aviarist', '飞禽饲养家', {
                  words: w(['aviarist', '飞禽饲养家']),
                }),
              ],
            }),
          ],
        }),
        node('aviate', 'aviate', '飞行', { words: w(['aviate', '飞行']) }),
      ],
    }),
    node('aer', 'aer=aero=air', '空气', {
      meaning: 'air',
      type: 'root',
      words: w(
        ['aerobiology', '大气生物学'],
        ['aerostatics', '空气静力学'],
        ['aerial', '航空的'],
        ['aeroplane', '飞机'],
        ['aisle', '过道'],
      ),
      children: [
        node('aerobiology', 'aerobiology', '大气生物学', {
          words: w(['aerobiology', '大气生物学']),
        }),
        node('aerostatics', 'aerostatics', '空气静力学', {
          words: w(['aerostatics', '空气静力学']),
        }),
        node('aerial', 'aerial', '航空的', { words: w(['aerial', '航空的']) }),
        node('aeroplane', 'aeroplane', '飞机', { words: w(['aeroplane', '飞机']) }),
        node('aisle', 'aisle', '过道', { words: w(['aisle', '过道']) }),
      ],
    }),
    node('auto', 'auto=aut', '自己', {
      meaning: 'self',
      type: 'root',
      words: w(['autobiography', '自传作者'], ['autocide', '自杀'], ['automatic', '自动的']),
      children: [
        node('autobiography', 'autobiography', '自传作者', {
          words: w(['autobiography', '自传作者']),
        }),
        node('autocide', 'autocide', '自杀', { words: w(['autocide', '自杀']) }),
        node('automatic', 'automatic', '自动的', {
          words: w(
            ['automatic', '自动的'],
            ['autoalarm', '自动报警器'],
            ['autoscope', '自检器'],
            ['autoxidation', '自然氧化'],
          ),
          children: [
            node('autoalarm', 'autoalarm', '自动报警器', { words: w(['autoalarm', '自动报警器']) }),
            node('autoscope', 'autoscope', '自检器', { words: w(['autoscope', '自检器']) }),
            node('autoxidation', 'autoxidation', '自然氧化', {
              words: w(['autoxidation', '自然氧化']),
            }),
          ],
        }),
      ],
    }),
    node('audi', 'audi', '听', {
      meaning: 'hear',
      type: 'root',
      words: w(['audio', '听觉的；音频的'], ['audition', '视听；试镜']),
      children: [
        node('audio', 'audio', '听觉的；音频的', {
          words: w(
            ['audio', '听觉的；音频的'],
            ['inaudible', '听不见的'],
            ['audiogram', '听力敏感图'],
            ['audiology', '听觉学'],
          ),
          children: [
            node('inaudible', 'inaudible', '听不见的', { words: w(['inaudible', '听不见的']) }),
            node('audiogram', 'audiogram', '听力敏感图', { words: w(['audiogram', '听力敏感图']) }),
            node('audiology', 'audiology', '听觉学', { words: w(['audiology', '听觉学']) }),
          ],
        }),
        node('audition', 'audition', '视听；试镜', {
          words: w(
            ['audition', '视听；试镜'],
            ['auditor', '旁听生'],
            ['auditory', '听觉的'],
            ['audit', '查账；旁听'],
          ),
          children: [
            node('auditor', 'auditor', '旁听生', { words: w(['auditor', '旁听生']) }),
            node('auditory', 'auditory', '听觉的', { words: w(['auditory', '听觉的']) }),
            node('audit', 'audit', '查账；旁听', { words: w(['audit', '查账；旁听']) }),
          ],
        }),
      ],
    }),
    node('act', 'act=ag=ig', '做、行动', {
      meaning: 'do/act',
      type: 'root',
      words: w(
        ['agony', '极大的痛苦'],
        ['cogent', '强有力的；使人信服的'],
        ['exigency', '紧急的；迫切的'],
        ['interact', '相互作用'],
        ['prodigal', '挥霍的；奢侈的'],
        ['actualize', '使实现'],
        ['actuate', '开动；趋势；激发'],
        ['agent', '代理人'],
      ),
      children: [
        node('agony', 'agony', '极大的痛苦', { words: w(['agony', '极大的痛苦']) }),
        node('cogent', 'cogent', '强有力的；使人信服的', {
          words: w(['cogent', '强有力的；使人信服的']),
        }),
        node('exigency', 'exigency', '紧急的；迫切的', {
          words: w(['exigency', '紧急的；迫切的']),
        }),
        node('interact', 'interact', '相互作用', { words: w(['interact', '相互作用']) }),
        node('prodigal', 'prodigal', '挥霍的；奢侈的', {
          words: w(['prodigal', '挥霍的；奢侈的']),
        }),
        node('actualize', 'actualize', '使实现', { words: w(['actualize', '使实现']) }),
        node('actuate', 'actuate', '开动；趋势；激发', {
          words: w(['actuate', '开动；趋势；激发']),
          children: [
            node('agitate', 'agitate', '扰动；激动', {
              words: w(['agitate', '扰动；激动']),
              children: [
                node('agitator', 'agitator', '煽动者', { words: w(['agitator', '煽动者']) }),
              ],
            }),
            node('enact', 'enact', '制定法律；扮演角色', {
              words: w(['enact', '制定法律；扮演角色']),
              children: [
                node('enactment', 'enactment', '法律', { words: w(['enactment', '法律']) }),
                node('exact', 'exact', '精确的', {
                  words: w(['exact', '精确的']),
                  children: [
                    node('exacting', 'exacting', '苛刻的；严格的', {
                      words: w(['exacting', '苛刻的；严格的']),
                    }),
                  ],
                }),
                node('transact', 'transact', '办理；交易', {
                  words: w(['transact', '办理；交易']),
                  children: [
                    node('transaction', 'transaction', '交易；买卖', {
                      words: w(['transaction', '交易；买卖']),
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        node('agent', 'agent', '代理人', {
          words: w(['agent', '代理人']),
          sourceLabel: '事务',
          tag: 'affairs',
          children: [
            node('agenda', 'agenda', '议事日程', {
              words: w(['agenda', '议事日程']),
              sourceLabel: '事务',
              tag: 'affairs',
            }),
            node('agile', 'agile', '灵活的', {
              words: w(['agile', '灵活的']),
              sourceLabel: '事务',
              tag: 'affairs',
            }),
            node('actuary', 'actuary', '统计学家', {
              words: w(['actuary', '统计学家']),
              sourceLabel: '事务',
              tag: 'affairs',
              children: [
                node('accurate', 'accurate', '准确的', {
                  words: w(['accurate', '准确的']),
                  sourceLabel: '事务',
                  tag: 'affairs',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    node('a-prefix', '前缀', '前缀分支', {
      type: 'section',
      words: w(
        ['a-', '没有；无'],
        ['amphi-', '两个；周围'],
        ['apo-', '远离'],
        ['ante-', '先前'],
        ['anti-', '相反；对抗'],
        ['ad-', '向；加强'],
      ),
      children: [
        node('a-without', 'a-=an-=without', '没有', {
          meaning: 'without',
          type: 'prefix',
          sourceLabel: '前缀',
          tag: 'other',
          words: w(
            ['abyss', '深渊；无底洞'],
            ['anacid', '无酸的'],
            ['anhydrous', '无水的'],
            ['anecdote', '奇闻'],
            ['anharmonic', '不和谐的'],
            ['apathy', '冷漠'],
            ['anomaly', '不规则'],
            ['anonymous', '无名的；匿名的'],
            ['aperiodic', '非周期的'],
            ['asexual', '无性的；无性生殖的'],
            ['asymmetry', '不对称的'],
            ['atheist', '无神论者'],
            ['anarchy', '政治混乱'],
            ['atypical', '非典型的'],
          ),
          children: [
            node('a-without-notinclude', '不包含', '不包含类派生', {
              type: 'category',
              sourceLabel: '不包含',
              tag: 'other',
              words: w(
                ['abyss', '深渊；无底洞'],
                ['anacid', '无酸的'],
                ['anhydrous', '无水的'],
                ['anecdote', '奇闻'],
              ),
            }),
            node('a-without-emotion', '情感', '情感类派生', {
              type: 'category',
              sourceLabel: '情感',
              tag: 'emotion',
              words: w(['anharmonic', '不和谐的'], ['apathy', '冷漠']),
              children: [
                node('apathy', 'apathy', '冷漠', {
                  words: w(['apathy', '冷漠']),
                  sourceLabel: '情感',
                  tag: 'emotion',
                  children: [
                    node('apathetic', 'apathetic', '冷淡的；漠不关心的', {
                      words: w(['apathetic', '冷淡的；漠不关心的']),
                      sourceLabel: '情感',
                      tag: 'emotion',
                    }),
                  ],
                }),
              ],
            }),
            node('a-without-physical', '物理/状态', '物理/状态类派生', {
              type: 'category',
              sourceLabel: '物理',
              tag: 'physics',
              words: w(
                ['anomaly', '不规则'],
                ['anonymous', '无名的；匿名的'],
                ['aperiodic', '非周期的'],
                ['asexual', '无性的；无性生殖的'],
                ['asymmetry', '不对称的'],
              ),
              children: [
                node('anomaly', 'anomaly', '不规则', {
                  words: w(['anomaly', '不规则']),
                  sourceLabel: '物理',
                  tag: 'physics',
                  children: [
                    node('anomy', 'anomy', '失范状态；混乱', {
                      words: w(['anomy', '失范状态；混乱']),
                      sourceLabel: '物理',
                      tag: 'physics',
                    }),
                  ],
                }),
              ],
            }),
            node('a-without-abstract', '抽象概念', '抽象概念类派生', {
              type: 'category',
              sourceLabel: '抽象',
              tag: 'abstract',
              words: w(['atheist', '无神论者'], ['anarchy', '政治混乱'], ['atypical', '非典型的']),
            }),
          ],
        }),
        node('amphi-ambi', 'amphi-=ambi-', '两个', {
          meaning: 'two/both',
          type: 'prefix',
          sourceLabel: '前缀',
          tag: 'other',
          words: w(
            ['ambiguity', '模棱两可；含义模糊'],
            ['ambisexual', '两性的'],
            ['ambivert', '中间性格'],
            ['ambitendency', '自我矛盾的'],
            ['ambidextrous', '两手都灵巧的；引申为欺骗的'],
            ['ambit', '界限；范围'],
            ['ambilingual', '通两国语言的人'],
            ['amphibian', '两栖类'],
            ['amphicar', '水陆两用车'],
            ['amphigamy', '受精作用'],
          ),
          children: [
            node('ambiguity', 'ambiguity', '模棱两可；含义模糊', {
              words: w(['ambiguity', '模棱两可；含义模糊']),
              children: [
                node('ambiguous', 'ambiguous', '含糊的', { words: w(['ambiguous', '含糊的']) }),
                node('ambiquity', 'ambiquity', '含糊的（变体拼写）', {
                  words: w(['ambiquity', '含糊的（变体拼写）']),
                }),
              ],
            }),
            node('amphi-emotion', '情感/性格', '情感/性格类派生', {
              type: 'category',
              sourceLabel: '情感',
              tag: 'emotion',
              words: w(
                ['ambisexual', '两性的'],
                ['ambivert', '中间性格'],
                ['ambitendency', '自我矛盾的'],
                ['ambidextrous', '两手都灵巧的；引申为欺骗的'],
              ),
            }),
            node('ambit', 'ambit', '界限；范围', {
              words: w(['ambit', '界限；范围']),
              children: [
                node('ambient', 'ambient', '周围的', {
                  words: w(['ambient', '周围的']),
                  children: [
                    node('ambiance-ambience', 'ambiance=ambience', '周围环境；气氛', {
                      type: 'branch',
                      words: w(['ambiance', '周围环境；气氛'], ['ambience', '周围环境；气氛']),
                      children: [
                        node('atmosphere', 'atmosphere', '氛围；大气层', {
                          words: w(['atmosphere', '氛围；大气层']),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            node('amphi-language-biology', '语言/生物', '语言/生物类派生', {
              type: 'category',
              sourceLabel: '生物',
              tag: 'biology',
              words: w(
                ['ambilingual', '通两国语言的人'],
                ['amphibian', '两栖类'],
                ['amphicar', '水陆两用车'],
                ['amphigamy', '受精作用'],
              ),
              children: [
                node('amphibian', 'amphibian', '两栖类', {
                  words: w(['amphibian', '两栖类']),
                  sourceLabel: '生物',
                  tag: 'biology',
                  children: [
                    node('amphibiology', 'amphibiology', '两栖动物学', {
                      words: w(['amphibiology', '两栖动物学']),
                      sourceLabel: '生物',
                      tag: 'biology',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        node('apo-ab', 'apo-=ab-', '远离', {
          meaning: 'away/from',
          type: 'prefix',
          sourceLabel: '前缀',
          tag: 'other',
          words: w(
            ['abhor', '憎恶'],
            ['abominate', '憎恶'],
            ['abjure', '放弃'],
            ['abject', '可怜的；卑鄙的'],
            ['abscond', '潜逃；避债'],
            ['absurd', '荒谬的'],
            ['abrade', '磨损；折磨'],
            ['abrupt', '突然的；粗鲁无礼的'],
            ['absent', '缺席的；心不在焉的'],
            ['absorb', '吸收；全神贯注'],
            ['abaxial', '离轴的'],
            ['abduce', '外展'],
            ['absolve', '免罪'],
            ['abrogate', '废除'],
            ['abort', '流产'],
            ['aphorism', '格言'],
            ['abstract', '摘要'],
            ['abundant', '丰富的'],
            ['object', '客观的；反对；宾语；对象'],
          ),
          children: [
            node('apo-emotion', '情感/态度', '情感/态度类派生', {
              type: 'category',
              sourceLabel: '情感',
              tag: 'emotion',
              words: w(
                ['abhor', '憎恶'],
                ['abominate', '憎恶'],
                ['abjure', '放弃'],
                ['abject', '可怜的；卑鄙的'],
                ['abscond', '潜逃；避债'],
                ['absurd', '荒谬的'],
                ['abrade', '磨损；折磨'],
                ['abrupt', '突然的；粗鲁无礼的'],
                ['absent', '缺席的；心不在焉的'],
                ['absorb', '吸收；全神贯注'],
              ),
            }),
            node('apo-physical', '物理/动作', '物理/动作类派生', {
              type: 'category',
              sourceLabel: '物理',
              tag: 'physics',
              words: w(['abaxial', '离轴的'], ['abduce', '外展']),
            }),
            node('apo-remove', '去除/否定', '去除/否定类派生', {
              type: 'category',
              sourceLabel: '去除',
              tag: 'other',
              words: w(['absolve', '免罪'], ['abrogate', '废除'], ['abort', '流产']),
            }),
            node('apo-other', '抽象/其他', '抽象/其他类派生', {
              type: 'category',
              sourceLabel: '其他',
              tag: 'other',
              words: w(
                ['aphorism', '格言'],
                ['abstract', '摘要'],
                ['object', '客观的；反对；宾语；对象'],
              ),
            }),
            node('abundant', 'abundant', '丰富的', {
              words: w(['abundant', '丰富的']),
              children: [
                node('abound', 'abound', '充满', { words: w(['abound', '充满']) }),
                node('abuse', 'abuse', '滥用', { words: w(['abuse', '滥用']) }),
                node('abundance', 'abundance', '丰富', { words: w(['abundance', '丰富']) }),
              ],
            }),
          ],
        }),
        node('ante', 'ante-', '先前', {
          meaning: 'before',
          type: 'prefix',
          sourceLabel: '前缀',
          tag: 'other',
          words: w(
            ['anterior', '前面的'],
            ['antecessor', '先行者；祖先'],
            ['anticipate', '预料'],
            ['antenna', '触角；天线'],
          ),
          children: [
            node('anterior', 'anterior', '前面的', {
              words: w(['anterior', '前面的']),
              children: [
                node('antediluvian', 'antediluvian', '大洪水之前；远古的', {
                  words: w(['antediluvian', '大洪水之前；远古的']),
                }),
                node('antemarital', 'antemarital', '婚前的', {
                  words: w(['antemarital', '婚前的']),
                }),
                node('antenatal', 'antenatal', '出生前', { words: w(['antenatal', '出生前']) }),
                node('antemortem', 'antemortem', '临死前', { words: w(['antemortem', '临死前']) }),
                node('anteprandial', 'anteprandial', '饭前的', {
                  words: w(['anteprandial', '饭前的']),
                }),
                node('antewar', 'antewar', '战争前', { words: w(['antewar', '战争前']) }),
              ],
            }),
            node('antecessor', 'antecessor', '先行者；祖先', {
              words: w(['antecessor', '先行者；祖先']),
              children: [
                node('antechapel', 'antechapel', '教堂门厅', {
                  words: w(['antechapel', '教堂门厅']),
                }),
                node('antehuman', 'antehuman', '在人类以前的', {
                  words: w(['antehuman', '在人类以前的']),
                }),
                node('anteroom', 'anteroom', '接待室', { words: w(['anteroom', '接待室']) }),
              ],
            }),
            node('anticipate', 'anticipate', '预料', { words: w(['anticipate', '预料']) }),
            node('antenna', 'antenna', '触角；天线', { words: w(['antenna', '触角；天线']) }),
          ],
        }),
        node('anti', 'anti-', '相反；对抗', {
          meaning: 'against',
          type: 'prefix',
          sourceLabel: '前缀',
          tag: 'other',
          words: w(
            ['antiaging', '防衰老'],
            ['antiaircraft', '防空'],
            ['antibiotic', '抗生素'],
            ['antibody', '抗体'],
            ['antifat', '减肥的；防止长胖的'],
          ),
        }),
        node('ad-add-axx', 'ad=add=axx', '加强', {
          meaning: 'toward/intensify',
          type: 'prefix',
          sourceLabel: '前缀',
          tag: 'other',
          words: w(
            ['adhere', '依附'],
            ['adjure', '恳请'],
            ['admonish', '劝告'],
            ['admit', '允许进入'],
            ['abide', '坚持'],
            ['agglomerate', '大块'],
            ['affiance', '婚约；信托'],
            ['augment', '增大'],
            ['accuse', '控告；谴责'],
            ['allege', '断言；宣称；指控'],
          ),
          children: [
            node('ad-core', 'ad-', '基础形式', {
              type: 'branch',
              words: w(
                ['adhere', '依附'],
                ['adjure', '恳请'],
                ['admonish', '劝告'],
                ['admit', '允许进入'],
              ),
              children: [
                node('adhere', 'adhere', '依附', {
                  words: w(['adhere', '依附']),
                  children: [
                    node('additional', 'additional', '附加的', {
                      words: w(['additional', '附加的']),
                    }),
                    node('adjacent', 'adjacent', '邻接的', {
                      words: w(['adjacent', '邻接的']),
                      children: [
                        node('adjective', 'adjective', '形容词', {
                          words: w(['adjective', '形容词']),
                        }),
                      ],
                    }),
                    node('adjoin', 'adjoin', '靠近', { words: w(['adjoin', '靠近']) }),
                    node('adjust', 'adjust', '调节；整顿', { words: w(['adjust', '调节；整顿']) }),
                    node('adulterate', 'adulterate', '参杂', { words: w(['adulterate', '参杂']) }),
                  ],
                }),
                node('adjure', 'adjure', '恳请', {
                  words: w(['adjure', '恳请']),
                  children: [
                    node('adjourn', 'adjourn', '延期；休会', {
                      words: w(['adjourn', '延期；休会']),
                    }),
                  ],
                }),
                node('admonish', 'admonish', '劝告', { words: w(['admonish', '劝告']) }),
                node('admit', 'admit', '允许进入', {
                  words: w(['admit', '允许进入']),
                  children: [
                    node('advent', 'advent', '到来', {
                      words: w(['advent', '到来']),
                      children: [
                        node('adventure', 'adventure', '冒险', { words: w(['adventure', '冒险']) }),
                      ],
                    }),
                    node('adverse', 'adverse', '敌对的', { words: w(['adverse', '敌对的']) }),
                    node('advertise', 'advertise', '公告', { words: w(['advertise', '公告']) }),
                    node('advisable', 'advisable', '可取的', { words: w(['advisable', '可取的']) }),
                    node('administer', 'administer', '实施；掌管', {
                      words: w(['administer', '实施；掌管']),
                      children: [
                        node('administration', 'administration', '经营；行政部门', {
                          words: w(['administration', '经营；行政部门']),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            node('ad-a-an', 'a-=an-', '增加', {
              type: 'branch',
              words: w(
                ['abide', '坚持'],
                ['augment', '增加'],
                ['enhance', '增加'],
                ['astir', '激动的'],
                ['astray', '迷途的'],
                ['ascribe', '归因于'],
                ['aver', '声称；断言'],
                ['abut', '邻接'],
                ['amass', '积蓄'],
                ['amenable', '应服从的'],
              ),
              children: [
                node('abide', 'abide', '坚持', { words: w(['abide', '坚持']) }),
                node('augment-enhance', 'augment=enhance', '增加', {
                  type: 'branch',
                  words: w(['augment', '增加'], ['enhance', '增加']),
                }),
                node('astir', 'astir', '激动的', {
                  words: w(['astir', '激动的']),
                  children: [
                    node('aspire', 'aspire', '渴望；追求', { words: w(['aspire', '渴望；追求']) }),
                    node('ameliorate', 'ameliorate', '改善', { words: w(['ameliorate', '改善']) }),
                  ],
                }),
                node('astray', 'astray', '迷途的', { words: w(['astray', '迷途的']) }),
                node('ascribe', 'ascribe', '归因于', { words: w(['ascribe', '归因于']) }),
                node('aver', 'aver', '声称；断言', {
                  words: w(['aver', '声称；断言']),
                  children: [
                    node('avow', 'avow', '公开声明', { words: w(['avow', '公开声明']) }),
                    node('avenue', 'avenue', '林荫道；方法途径', {
                      words: w(['avenue', '林荫道；方法途径']),
                    }),
                  ],
                }),
                node('abut', 'abut', '邻接', { words: w(['abut', '邻接']) }),
                node('amass', 'amass', '积蓄', { words: w(['amass', '积蓄']) }),
                node('amenable', 'amenable', '应服从的', { words: w(['amenable', '应服从的']) }),
              ],
            }),
            node('ad-ag', 'ag-', 'g 前变体', {
              type: 'branch',
              words: w(
                ['agglomerate', '大块'],
                ['aggrade', '淤积'],
                ['aggravate', '加重；恶化'],
                ['aggress', '攻击'],
              ),
              children: [
                node('agglomerate', 'agglomerate', '大块', { words: w(['agglomerate', '大块']) }),
                node('aggrade', 'aggrade', '淤积', { words: w(['aggrade', '淤积']) }),
                node('aggravate', 'aggravate', '加重；恶化', {
                  words: w(['aggravate', '加重；恶化']),
                }),
                node('aggress', 'aggress', '攻击', {
                  words: w(['aggress', '攻击']),
                  children: [
                    node('against', 'against', '反对', { words: w(['against', '反对']) }),
                    node('aggrieve', 'aggrieve', '使烦恼', { words: w(['aggrieve', '使烦恼']) }),
                  ],
                }),
              ],
            }),
            node('ad-af', 'af-', 'f 前变体', {
              type: 'branch',
              words: w(
                ['affiance', '婚约；信托'],
                ['affiliate', '使加入；加盟'],
                ['afforest', '造林于'],
                ['affright', '惊吓；恐怖'],
                ['affusion', '浇灌'],
                ['affair', '事务'],
              ),
              children: [
                node('affiance', 'affiance', '婚约；信托', {
                  words: w(['affiance', '婚约；信托']),
                }),
                node('affiliate', 'affiliate', '使加入；加盟', {
                  words: w(['affiliate', '使加入；加盟']),
                }),
                node('afforest', 'afforest', '造林于', { words: w(['afforest', '造林于']) }),
                node('affright', 'affright', '惊吓；恐怖', {
                  words: w(['affright', '惊吓；恐怖']),
                }),
                node('affusion', 'affusion', '浇灌', { words: w(['affusion', '浇灌']) }),
                node('affair', 'affair', '事务', {
                  words: w(['affair', '事务']),
                  children: [
                    node('afford', 'afford', '担负得起', { words: w(['afford', '担负得起']) }),
                  ],
                }),
              ],
            }),
            node('ad-aug', 'aug-=auc-=aut-', '增加、创造', {
              type: 'branch',
              words: w(
                ['augment', '增大'],
                ['august', '尊严的'],
                ['author', '创造者；作者'],
                ['authorize', '授权；委托'],
                ['authority', '权威的'],
                ['authentic', '可信的；权威的'],
              ),
              children: [
                node('aug-augment', 'augment', '增大', { words: w(['augment', '增大']) }),
                node('august', 'august', '尊严的', { words: w(['august', '尊严的']) }),
                node('author', 'author', '创造者；作者', {
                  words: w(['author', '创造者；作者']),
                  children: [
                    node('authorize', 'authorize', '授权；委托', {
                      words: w(['authorize', '授权；委托']),
                    }),
                    node('authority', 'authority', '权威的', {
                      words: w(['authority', '权威的']),
                      children: [
                        node('authentic', 'authentic', '可信的；权威的', {
                          words: w(['authentic', '可信的；权威的']),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            node('ad-ac', 'ac-', 'c/k 前变体', {
              type: 'branch',
              words: w(
                ['accuse', '控告；谴责'],
                ['accumulate', '积累'],
                ['acute', '剧烈；尖的'],
                ['accommodate', '向...提供住处'],
                ['accumbent', '横卧'],
                ['accomplish', '实现'],
                ['accompany', '陪伴'],
                ['accession', '就职'],
                ['accost', '打招呼；勾引'],
                ['accessory', '附件；附属品'],
                ['acclive', '倾斜的'],
                ['acquire', '获得'],
                ['acknowledge', '答谢；承认'],
              ),
              children: [
                node('accuse', 'accuse', '控告；谴责', { words: w(['accuse', '控告；谴责']) }),
                node('accumulate', 'accumulate', '积累', { words: w(['accumulate', '积累']) }),
                node('ad-ac-acute', 'acute', '剧烈；尖的', { words: w(['acute', '剧烈；尖的']) }),
                node('accommodate', 'accommodate', '向...提供住处', {
                  words: w(['accommodate', '向...提供住处']),
                  children: [
                    node('accommodation', 'accommodation', '住宿', {
                      words: w(['accommodation', '住宿']),
                    }),
                  ],
                }),
                node('accumbent', 'accumbent', '横卧', { words: w(['accumbent', '横卧']) }),
                node('accomplish', 'accomplish', '实现', { words: w(['accomplish', '实现']) }),
                node('accompany', 'accompany', '陪伴', { words: w(['accompany', '陪伴']) }),
                node('accession', 'accession', '就职', { words: w(['accession', '就职']) }),
                node('accost', 'accost', '打招呼；勾引', { words: w(['accost', '打招呼；勾引']) }),
                node('accessory', 'accessory', '附件；附属品', {
                  words: w(['accessory', '附件；附属品']),
                }),
                node('acclive', 'acclive', '倾斜的', { words: w(['acclive', '倾斜的']) }),
                node('acquire', 'acquire', '获得', {
                  words: w(['acquire', '获得']),
                  children: [
                    node('acquaint', 'acquaint', '使了解', {
                      words: w(['acquaint', '使了解']),
                      children: [
                        node('acquaintance', 'acquaintance', '认识；熟人', {
                          words: w(['acquaintance', '认识；熟人']),
                        }),
                      ],
                    }),
                    node('acquisition', 'acquisition', '获得；养成', {
                      words: w(['acquisition', '获得；养成']),
                    }),
                    node('acquisitive', 'acquisitive', '渴望得到的；贪婪的', {
                      words: w(['acquisitive', '渴望得到的；贪婪的']),
                    }),
                  ],
                }),
                node('acknowledge', 'acknowledge', '答谢；承认', {
                  words: w(['acknowledge', '答谢；承认']),
                }),
              ],
            }),
            node('ad-al', 'al-', 'l 前变体', {
              type: 'branch',
              words: w(
                ['allege', '断言；宣称；指控'],
                ['alleviate', '减轻；缓和'],
                ['alliance', '同盟'],
                ['ally', '同盟'],
                ['allowance', '补贴；津贴折扣'],
                ['amplifier', '放大；增强'],
                ['assembly', '集合'],
                ['approve', '赞成'],
                ['approval', '赞成'],
              ),
              children: [
                node('allege', 'allege', '断言；宣称；指控', {
                  words: w(['allege', '断言；宣称；指控']),
                }),
                node('alleviate', 'alleviate', '减轻；缓和', {
                  words: w(['alleviate', '减轻；缓和']),
                }),
                node('alliance', 'alliance', '同盟', {
                  words: w(['alliance', '同盟']),
                  children: [
                    node('ally', 'ally', '同盟', { words: w(['ally', '同盟']) }),
                    node('allowance', 'allowance', '补贴；津贴折扣', {
                      words: w(['allowance', '补贴；津贴折扣']),
                    }),
                  ],
                }),
                node('amplifier', 'amplifier', '放大；增强', {
                  words: w(['amplifier', '放大；增强']),
                }),
                node('assembly', 'assembly', '集合', { words: w(['assembly', '集合']) }),
                node('approve', 'approve', '赞成', {
                  words: w(['approve', '赞成']),
                  children: [
                    node('approval', 'approval', '赞成', { words: w(['approval', '赞成']) }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

function normalizeWordId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\x27\x22]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toDisplay(word) {
  const text = String(word || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function escapeUnicodeToAscii(text) {
  return text.replace(/[\u007f-\uffff]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${code}`;
  });
}

function createJsonText(payload) {
  return `${escapeUnicodeToAscii(JSON.stringify(payload, null, 2))}\n`;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function flattenTree(rootNode) {
  const hierarchy = [];
  const wordRows = [];
  const seenWordIds = new Set();

  function visit(current, parent = null, ancestry = []) {
    const rootPath = [...ancestry, current.id].join('>');
    const rootLevel = ancestry.length + 1;
    const inheritedSourceLabel =
      [current.sourceLabel, ...(parent?.sourceTrail || [])].find(Boolean) || '';
    const inheritedTag = [current.tag, ...(parent?.tagTrail || [])].find(Boolean) || '';
    const notes = current.notes || '根据 词根.txt 整理';

    hierarchy.push({
      rootId: current.id,
      root: current.root,
      meaning: current.meaning || '',
      descriptionCn: current.descriptionCn || '',
      type: current.type || 'root',
      parentRootId: parent ? parent.id : '',
      rootLevel,
      rootPath,
      notes,
      sourceLabel: inheritedSourceLabel,
      tags: unique([current.type, inheritedTag]),
      wordCount: Array.isArray(current.words) ? current.words.length : 0,
    });

    (current.words || []).forEach((entry, index) => {
      const baseId = normalizeWordId(entry.id || entry.word) || `${current.id}-word-${index + 1}`;
      let wordId = baseId;
      let counter = 2;
      while (seenWordIds.has(wordId)) {
        wordId = `${baseId}-${current.id}-${counter}`;
        counter += 1;
      }
      seenWordIds.add(wordId);

      const sourceLabel = entry.sourceLabel || inheritedSourceLabel || '';
      const tag = entry.tag || inheritedTag || '';
      wordRows.push({
        id: wordId,
        word: entry.word,
        display: entry.display || toDisplay(entry.word),
        phonetic: entry.phonetic || '',
        translation: entry.translation || '',
        sentence: entry.sentence || '',
        tags: unique(['root-family', tag]),
        level: typeof entry.level === 'number' ? entry.level : 1,
        rootId: current.id,
        rootPath,
        sourceLabel,
      });
    });

    const nextParent = {
      id: current.id,
      sourceTrail: unique([current.sourceLabel, ...(parent?.sourceTrail || [])]),
      tagTrail: unique([current.tag, ...(parent?.tagTrail || [])]),
    };

    (current.children || []).forEach((child) =>
      visit(child, nextParent, [...ancestry, current.id]),
    );
  }

  visit(rootNode);
  return {
    hierarchy: {
      version: 1,
      updatedAt: new Date().toISOString().slice(0, 10),
      roots: hierarchy,
    },
    wordsFlat: wordRows,
  };
}

async function main() {
  const { hierarchy, wordsFlat } = flattenTree(tree);
  await fs.mkdir(path.dirname(OUTPUT_WORDS), { recursive: true });
  await fs.writeFile(OUTPUT_WORDS, createJsonText(wordsFlat), 'utf8');
  await fs.writeFile(OUTPUT_ROOTS, createJsonText(hierarchy), 'utf8');
  console.log(`[build-a-pdf-wordbank] roots: ${hierarchy.roots.length}`);
  console.log(`[build-a-pdf-wordbank] words: ${wordsFlat.length}`);
  console.log(`[build-a-pdf-wordbank] wrote: ${OUTPUT_ROOTS}`);
  console.log(`[build-a-pdf-wordbank] wrote: ${OUTPUT_WORDS}`);
}

main().catch((error) => {
  console.error(`[build-a-pdf-wordbank] failed: ${error.message}`);
  process.exitCode = 1;
});
