from __future__ import annotations

import json
import re
from pathlib import Path

import pypdf

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "vibes"
PDF_NAME = "标准的英语脏话.pdf"
SOURCE_PDF = Path(r"C:\Users\86152\Desktop\1-英语小程序\英文脏话\标准的英语脏话.pdf")

SCENE_CARDS = [
    {
        "id": "general-flame",
        "title": "通用对喷",
        "eyebrow": "GENERAL FLAME",
        "tagline": "最常用的骂人句、赶人句、否定句，先把最顺手的火力装满。",
        "statement": "不想吵输，先把最通用的狠话背熟。",
        "theme": "ash-crimson",
    },
    {
        "id": "gaming-rage",
        "title": "打游戏开喷",
        "eyebrow": "GAMING RAGE",
        "tagline": "队友摆烂、对面嘲讽、节奏爆炸时最短最狠的输出方式。",
        "statement": "语速要快，句子要短，情绪要准。",
        "theme": "arcade-neon",
    },
    {
        "id": "office-comeback",
        "title": "职场回怼",
        "eyebrow": "OFFICE COMEBACK",
        "tagline": "甩锅、找借口、越界指挥时，用更像办公室的方式顶回去。",
        "statement": "不是每次都要爆粗，但每次都得把边界说清楚。",
        "theme": "slate-graphite",
    },
    {
        "id": "daily-clash",
        "title": "日常互怼",
        "eyebrow": "DAILY CLASH",
        "tagline": "朋友、室友、熟人之间最容易冒火的日常争执表达。",
        "statement": "生活里最常见的冲突，不要只会憋着。",
        "theme": "amber-concrete",
    },
    {
        "id": "lover-breakup",
        "title": "情侣翻脸",
        "eyebrow": "LOVER BREAKUP",
        "tagline": "失望、厌烦、决裂、拉黑前夜，适合关系对线的狠句。",
        "statement": "感情里最伤人的话，往往都很短。",
        "theme": "rose-smoke",
    },
    {
        "id": "threat-warning",
        "title": "警告威慑",
        "eyebrow": "THREAT WARNING",
        "tagline": "别逼我、你会后悔、出去解决，这一类升级冲突的狠招都在这里。",
        "statement": "气势上不能先输，边界上更不能先退。",
        "theme": "obsidian-alert",
    },
]

SCENE_META = {
    "general-flame": {
        "title": "通用对喷",
        "tagline": "通用狠话先学够，任何场合都不怕卡壳。",
        "intro": "最普适的火力库。适合正面回怼、嫌烦、让人闭嘴、把人赶远的时候直接开口。",
    },
    "gaming-rage": {
        "title": "打游戏开喷",
        "tagline": "句子越短越狠，越像游戏里真的会喷出来的话。",
        "intro": "专收适合游戏对线的短句。重点是节奏快、输出狠、能直接甩到队友和对面脸上。",
    },
    "office-comeback": {
        "title": "职场回怼",
        "tagline": "把不爽说出来，但说得更像办公室里会出现的回击。",
        "intro": "适合职场甩锅、越界、甩责任、拿时间压人时使用。火气在，表达也要带边界感。",
    },
    "daily-clash": {
        "title": "日常互怼",
        "tagline": "朋友、室友、熟人之间最常见的吵架句，都放到这里。",
        "intro": "偏生活场景的互怼库。适合日常不耐烦、烦人、嘴碎、说话难听、做事离谱时直接回嘴。",
    },
    "lover-breakup": {
        "title": "情侣翻脸",
        "tagline": "失望、厌烦、绝交、分手前夜，最伤人的句子通常都很直接。",
        "intro": "关系型冲突专用。内容更偏情绪决裂、失望拉满、彻底不想见对方的表达。",
    },
    "threat-warning": {
        "title": "警告威慑",
        "tagline": "从别逼我到出去解决，语气就是要把压迫感顶上去。",
        "intro": "适合冲突升级、边界拉满、放狠话、给对方压力的时候。重点不是文明，是气势。",
    },
}

SCENE_KEYWORDS = [
    (
        "lover-breakup",
        [
            "i hate you",
            "i detest you",
            "i loathe you",
            "we're through",
            "i'll never forgive you",
            "i wish i had never met you",
            "i never want to see your face again",
            "i don't want to see your face",
            "get out of my life",
            "you're nothing to me",
            "you are nothing to me",
            "i'm very disappointed",
            "you've ruined everything",
            "i can't take you any more",
            "i can't take you anymore",
        ],
    ),
    (
        "threat-warning",
        [
            "how dare you",
            "don't you dare",
            "don't push me",
            "you asked for it",
            "you are dead meat",
            "you'll be sorry",
            "i could kill you",
            "you want to step outside",
            "you want to take this outside",
            "you and what army",
            "you and who else",
            "this means war",
            "what do you think you are doing",
            "don't touch me",
            "get away from me",
            "come back again",
            "you've gone too far",
            "you have gone too far",
        ],
    ),
    (
        "office-comeback",
        [
            "that's your problem",
            "it's not my fault",
            "don't give me your excuses",
            "no more excuses",
            "don't waste my time",
            "i'm working",
            "mind your own business",
            "get off my back",
            "give me a break",
            "why on earth didn't you tell me the truth",
            "don't give me your attitude",
            "don't push me around",
            "put up or shut up",
            "cut the crap",
            "fed up with your bs",
            "that's the stupidest thing i've ever heard",
        ],
    ),
    (
        "gaming-rage",
        [
            "shut up",
            "stop screwing",
            "fooling",
            "messing around",
            "what did you say",
            "nonsense",
            "wise up",
            "enough is enough",
            "don't make so much noise",
            "what were you thinking",
            "can't you do anything right",
            "what do you want",
            "drop dead",
            "fuck off",
        ],
    ),
    (
        "daily-clash",
        [
            "don't bother me",
            "knock it off",
            "take a hike",
            "look at this mess",
            "look at the mess you've made",
            "don't nag me",
            "you're so careless",
            "that's terrible",
            "leave me alone",
            "don't look at me like that",
            "don't be that way",
            "what's wrong with you",
            "what's your problem",
            "who says",
            "don't talk to me like that",
        ],
    ),
]

WORD_HINTS = {
    "dork": "daily-clash",
    "nerd/geek": "gaming-rage",
    "dammit": "general-flame",
    "fuck": "general-flame",
    "dirty": "office-comeback",
    "bitch": "general-flame",
    "phycho": "general-flame",
    "shit": "general-flame",
    "dense/stupid/foolish": "daily-clash",
    "bastard": "general-flame",
}

REWRITES = {
    "general-flame": [
        {
            "english": "Cut the act and say what you actually mean.",
            "chinese": "少装了，有话就直接说。",
            "baseEntryId": "pdf-elegant-033",
        },
        {
            "english": "If you're here to start shit, do it properly.",
            "chinese": "你要是来找事的，就别半吊子。",
            "baseEntryId": "pdf-coarse-008",
        },
        {
            "english": "You don't get to talk big and act dumb.",
            "chinese": "你没资格一边装狠一边犯蠢。",
            "baseEntryId": "pdf-elegant-024",
        },
        {
            "english": "Back off before I lose the little patience I have left.",
            "chinese": "趁我耐心还没彻底没了，赶紧滚远点。",
            "baseEntryId": "pdf-elegant-017",
        },
        {
            "english": "You're loud, wrong, and somehow still confident.",
            "chinese": "你又吵、又错、还莫名其妙很自信。",
            "baseEntryId": "pdf-elegant-032",
        },
    ],
    "gaming-rage": [
        {
            "english": "Stop feeding and stop talking like you carried.",
            "chinese": "别送了，也别装得像这把是你带飞的。",
            "baseEntryId": "pdf-elegant-072",
        },
        {
            "english": "If your play is that bad, at least keep your mouth shut.",
            "chinese": "操作这么烂，至少把嘴闭上。",
            "baseEntryId": "pdf-elegant-029",
        },
        {
            "english": "You had one job and still managed to throw the whole game.",
            "chinese": "就这一个活你都能干砸，整把都让你送掉了。",
            "baseEntryId": "pdf-elegant-090",
        },
        {
            "english": "Don't ping me like crazy when you're the problem.",
            "chinese": "别疯狂点我，问题本来就在你身上。",
            "baseEntryId": "pdf-elegant-008",
        },
        {
            "english": "Queue again after you learn what the hell you're doing.",
            "chinese": "先搞明白自己在干什么，再来排位。",
            "baseEntryId": "pdf-elegant-106",
        },
    ],
    "office-comeback": [
        {
            "english": "Your poor planning is not automatically my emergency.",
            "chinese": "你的计划稀烂，不代表就该变成我的紧急任务。",
            "baseEntryId": "pdf-elegant-049",
        },
        {
            "english": "If you want accountability, start with your own mistakes.",
            "chinese": "你要谈负责，先从你自己的失误开始。",
            "baseEntryId": "pdf-elegant-059",
        },
        {
            "english": "Drop the excuses and tell me the actual fix.",
            "chinese": "别再找借口了，直接说你准备怎么补救。",
            "baseEntryId": "pdf-elegant-043",
        },
        {
            "english": "Don't dump your mess on my desk and call it teamwork.",
            "chinese": "别把你的烂摊子甩到我桌上，还好意思叫协作。",
            "baseEntryId": "pdf-elegant-057",
        },
        {
            "english": "If you're going to challenge me, come with facts instead of attitude.",
            "chinese": "你要质疑我就拿事实来，别只带态度。",
            "baseEntryId": "pdf-elegant-086",
        },
    ],
    "daily-clash": [
        {
            "english": "You make every simple thing feel like a full-time annoyance.",
            "chinese": "你能把每件小事都搞成持续不断的烦人现场。",
            "baseEntryId": "pdf-elegant-002",
        },
        {
            "english": "Quit acting like this chaos happened by magic.",
            "chinese": "别装得像这一地鸡毛是自己凭空出现的。",
            "baseEntryId": "pdf-elegant-089",
        },
        {
            "english": "I asked for basic sense, not whatever this is.",
            "chinese": "我要求的只是基本脑子，不是你现在这副德行。",
            "baseEntryId": "pdf-elegant-080",
        },
        {
            "english": "You talk a lot for someone who keeps making the same mistake.",
            "chinese": "你话是真的多，可你犯的错也是真的重复。",
            "baseEntryId": "pdf-elegant-069",
        },
        {
            "english": "Try being useful before you start being dramatic.",
            "chinese": "先学会有用，再学会发疯。",
            "baseEntryId": "pdf-elegant-074",
        },
    ],
    "lover-breakup": [
        {
            "english": "I'm done arguing with someone who keeps breaking the same promise.",
            "chinese": "我不想再跟一个反复食言的人争了。",
            "baseEntryId": "pdf-elegant-098",
        },
        {
            "english": "You don't get to hurt me and still expect access to me.",
            "chinese": "你没资格一边伤我，一边还想继续靠近我。",
            "baseEntryId": "pdf-elegant-084",
        },
        {
            "english": "At this point, even your apology sounds exhausting.",
            "chinese": "事到如今，连你的道歉听起来都让我觉得累。",
            "baseEntryId": "pdf-elegant-070",
        },
        {
            "english": "You turned love into a mess and expect me to stay calm.",
            "chinese": "你把这段感情搞得一团糟，还想让我冷静。",
            "baseEntryId": "pdf-elegant-090",
        },
        {
            "english": "I don't miss you. I miss the version of you that didn't lie.",
            "chinese": "我不是想你，我只是怀念那个还没开始骗我的你。",
            "baseEntryId": "pdf-elegant-097",
        },
    ],
    "threat-warning": [
        {
            "english": "Keep pushing and you're going to find out where my limit is.",
            "chinese": "你再往前逼一步，就会知道我的底线在哪。",
            "baseEntryId": "pdf-elegant-099",
        },
        {
            "english": "Walk back in here with that attitude and we're done playing nice.",
            "chinese": "你再带着这副态度走进来，就别指望我继续客气。",
            "baseEntryId": "pdf-elegant-107",
        },
        {
            "english": "Take one more shot and we'll settle this outside.",
            "chinese": "你再来一句，我们就出去把这事解决掉。",
            "baseEntryId": "pdf-other-009",
        },
        {
            "english": "You wanted a fight, now don't act surprised when it shows up.",
            "chinese": "你自己非要挑事，那就别装作没想到后果。",
            "baseEntryId": "pdf-elegant-108",
        },
        {
            "english": "I'm giving you one last warning, not a second chance.",
            "chinese": "我这是最后一次警告你，不是在给你第二次机会。",
            "baseEntryId": "pdf-elegant-094",
        },
    ],
}


def find_pdf() -> Path:
    if SOURCE_PDF.exists():
        return SOURCE_PDF
    candidates = list(Path.home().glob(f"**/{PDF_NAME}"))
    if candidates:
        return candidates[0]
    raise FileNotFoundError(f"Could not find {PDF_NAME}")


def normalize_english(text: str) -> str:
    text = text.replace("’", "'").replace("“", '"').replace("”", '"').replace("…", "...")
    text = text.replace("—", "-").replace("–", "-")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"([A-Za-z]+)\s*'\s*([A-Za-z]+)", r"\1'\2", text)
    text = re.sub(r"([A-Za-z]{2,})' ([A-Za-z]{1,2})\b", r"\1'\2", text)
    replacements = {
        "itis": "it is",
        "itanymore": "it anymore",
        "alot": "a lot",
        "itoff": "it off",
        "itout": "it out",
        "themeaning": "the meaning",
        "It'snone": "It's none",
        "talkto": "talk to",
        "tbother": "t bother",
        "tlook": "t look",
        "tgive": "t give",
        "tnag": "t nag",
        "ttouch": "t touch",
        "tbe": "t be",
        "tpush": "t push",
        "towant": "to want",
        "tosee": "to see",
        "fromme": "from me",
        "lookat": "look at",
        "atthe": "at the",
        "killyou": "kill you",
        "lasttime": "last time",
        "aredoing": "are doing",
        "hellout": "hell out",
        "thef***": "the f***",
        "orshut": "or shut",
        "tostep": "to step",
        "takethis": "take this",
        "stepoutside": "step outside",
        "topick": "to pick",
        "afight": "a fight",
        "orDare": "or Dare",
        "don'tlike": "don't like",
        "yourbutton": "your button",
        "sideare": "side are",
        "dirtylier": "dirty liar",
        "dirtyasshole": "dirty asshole",
        "sillyjackass": "silly jackass",
        "littlepink": "little pink",
        "You'r e": "You're",
        "I'v e": "I've",
        "I'l l": "I'll",
        "We'r e": "We're",
        "I' m": "I'm",
        'speak out"fuck"': 'speak out "fuck"',
        "Iwish": "I wish",
        "Ihad": "I had",
        "Inever": "I never",
        "Justlook": "Just look",
        "toexplode": "to explode",
        "Ican": "I can",
        "Iloathe": "I loathe",
        "Idetest": "I detest",
        "Ihate": "I hate",
        "Idon": "I don",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = text.replace("'r e", "'re")
    text = text.replace("'v e", "'ve")
    text = text.replace("'l l", "'ll")
    text = text.replace("'m ", "'m ")
    text = re.sub(
        r"\b(You're|I've|I'll|I'm|We're|Don't|can't|Can't|won't|What's|It's)(?=[A-Za-z])",
        r"\1 ",
        text,
    )
    text = re.sub(r"(n't|'re|'ve|'ll|'m|'d|'s)(?=[A-Za-z])", r"\1 ", text)
    text = re.sub(r"\s+([?.!,;:/])", r"\1", text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\s*/\s*", " / ", text)
    if text.endswith("'"):
        text = f"{text[:-1]}?"
    text = re.sub(r"\s{2,}", " ", text).strip(" .;:")
    return text


def normalize_chinese(text: str) -> str:
    text = re.sub(r"\s+", "", text)
    return text.strip(" /")


def split_english_chinese(text: str) -> tuple[str, str]:
    match = re.search(r"[\u4e00-\u9fff]", text)
    if not match:
        return normalize_english(text), ""
    index = match.start()
    english = normalize_english(text[:index])
    chinese = normalize_chinese(text[index:])
    return english, chinese


def extract_blocks(pdf_path: Path) -> list[dict]:
    reader = pypdf.PdfReader(str(pdf_path))
    page_defaults = {
        1: None,
        2: "优雅骂人",
        3: "优雅骂人",
        4: "粗话骂人",
        5: "其他",
        6: "其他",
        7: "其他",
    }
    blocks = []
    for page_index, page in enumerate(reader.pages, start=1):
        lines = [line.rstrip() for line in page.extract_text(extraction_mode="layout").splitlines() if line.strip()]
        current_section = page_defaults.get(page_index)
        pending_item = None
        for line in reversed(lines):
            stripped = line.strip()
            if stripped.startswith("右脑王英语学习机"):
                continue
            if stripped == "标准的英语脏话":
                continue
            if re.match(r"^\d{4}-\d{2}-\d{2}", stripped):
                continue
            if "一，优雅骂人" in stripped:
                if pending_item:
                    blocks.append(pending_item)
                    pending_item = None
                current_section = "优雅骂人"
                continue
            if "二，粗话骂人" in stripped:
                if pending_item:
                    blocks.append(pending_item)
                    pending_item = None
                current_section = "粗话骂人"
                continue
            if "三，其他" in stripped:
                if pending_item:
                    blocks.append(pending_item)
                    pending_item = None
                current_section = "其他"
                continue
            number_match = re.match(r"^(\d+)\.\s*(.+)$", stripped)
            if number_match:
                if pending_item:
                    blocks.append(pending_item)
                pending_item = {
                    "sourcePage": page_index,
                    "sourceSection": current_section or "未分类",
                    "number": int(number_match.group(1)),
                    "parts": [number_match.group(2).strip()],
                }
                continue
            if pending_item:
                pending_item["parts"].append(stripped)
        if pending_item:
            blocks.append(pending_item)
    return blocks


def dedupe_and_sort_blocks(blocks: list[dict]) -> list[dict]:
    best = {}
    for block in blocks:
        key = (block["sourceSection"], block["number"])
        score = sum(len(part) for part in block["parts"])
        existing = best.get(key)
        if not existing or score > existing["score"]:
            best[key] = {"score": score, "block": block}
    ordered = [item["block"] for item in best.values()]
    section_order = {"优雅骂人": 0, "粗话骂人": 1, "其他": 2}
    ordered.sort(key=lambda item: (section_order.get(item["sourceSection"], 99), item["number"]))
    return ordered


def scene_from_text(english: str, source_section: str) -> str:
    english_lower = english.lower()
    if source_section == "粗话骂人":
        for word_key, scene_id in WORD_HINTS.items():
            if english_lower.startswith(word_key):
                return scene_id
    for scene_id, keywords in SCENE_KEYWORDS:
        if any(keyword in english_lower for keyword in keywords):
            return scene_id
    return "general-flame"


def build_entries(blocks: list[dict]) -> list[dict]:
    section_slug = {"优雅骂人": "elegant", "粗话骂人": "coarse", "其他": "other"}
    entries = []
    for block in blocks:
        combined = " ".join(part for part in block["parts"] if part)
        english, chinese = split_english_chinese(combined)
        if not english:
            continue
        scene_id = scene_from_text(english, block["sourceSection"])
        is_word = block["sourceSection"] == "粗话骂人"
        source_slug = section_slug.get(block["sourceSection"], "misc")
        entries.append(
            {
                "id": f"pdf-{source_slug}-{block['number']:03d}",
                "sceneId": scene_id,
                "section": "words" if is_word else "phrases",
                "type": "word" if is_word else "phrase",
                "english": english,
                "chinese": chinese or "待补充翻译",
                "sourcePage": block["sourcePage"],
                "sourceSection": block["sourceSection"],
                "sourceKind": "pdf",
                "baseEntryId": "",
            }
        )
    return entries


def build_library(entries: list[dict]) -> dict:
    library = {}
    for card in SCENE_CARDS:
        scene_id = card["id"]
        originals = [entry for entry in entries if entry["sceneId"] == scene_id]
        rewrites = []
        for index, rewrite in enumerate(REWRITES.get(scene_id, []), start=1):
            rewrites.append(
                {
                    "id": f"rewrite-{scene_id}-{index:02d}",
                    "sceneId": scene_id,
                    "section": "rewrites",
                    "type": "rewrite",
                    "english": rewrite["english"],
                    "chinese": rewrite["chinese"],
                    "sourcePage": 0,
                    "sourceSection": "场景化改写",
                    "sourceKind": "rewrite",
                    "baseEntryId": rewrite["baseEntryId"],
                }
            )
        all_entries = originals + rewrites
        all_entries.sort(key=lambda item: ({"phrases": 0, "words": 1, "rewrites": 2}[item["section"]], item["id"]))
        library[scene_id] = {
            "title": SCENE_META[scene_id]["title"],
            "tagline": SCENE_META[scene_id]["tagline"],
            "intro": SCENE_META[scene_id]["intro"],
            "sections": [
                {"id": "phrases", "title": "狠话句子", "description": "适合直接甩出去的整句表达。"},
                {"id": "words", "title": "单词短语", "description": "适合补强火力的脏话词和标签词。"},
                {"id": "rewrites", "title": "场景化改写", "description": "把 PDF 原句改成更像这个场景里真的会说的话。"},
            ],
            "entries": all_entries,
        }
    return library


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    pdf_path = find_pdf()
    blocks = dedupe_and_sort_blocks(extract_blocks(pdf_path))
    entries = build_entries(blocks)
    library = build_library(entries)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    write_json(DATA_DIR / "scene-cards.json", SCENE_CARDS)
    write_json(DATA_DIR / "scene-library.json", {"scenes": library})
    print(f"PDF: {pdf_path}")
    print(f"Original entries: {len(entries)}")


if __name__ == "__main__":
    main()
