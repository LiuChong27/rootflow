#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import eng_to_ipa as eng_ipa
from g2p_en import G2p
import nltk
from nltk.corpus import wordnet as wn


REPO_ROOT = Path(__file__).resolve().parents[1]
ROOTS_DIR = REPO_ROOT / "data" / "roots"
RAW_ROOTS_PATH = REPO_ROOT / "data" / "raw" / "roots-hierarchy-fixed.json"
RAW_WORDS_PATH = REPO_ROOT / "data" / "raw" / "words-flat-fixed.json"

STOPWORDS = {
    "a",
    "an",
    "the",
    "to",
    "of",
    "for",
    "with",
    "that",
    "which",
    "who",
    "someone",
    "something",
    "somebody",
    "used",
    "especially",
    "make",
    "making",
    "used",
    "one",
    "someone",
}
LETTER_ROOT_FALLBACKS = {
    "a": "A root map",
    "b": "B root map",
    "c": "C root map",
    "d": "D root map",
    "e": "E root map",
    "f": "F root map",
    "g": "G root map",
    "h": "H root map",
    "i": "I root map",
    "j": "J root map",
    "k": "K root map",
    "l": "L root map",
    "m": "M root map",
    "n": "N root map",
    "o": "O root map",
    "p": "P root map",
    "q": "Q root map",
    "r": "R root map",
    "s": "S root map",
    "t": "T root map",
    "u": "U root map",
    "v": "V root map",
    "w": "W root map",
    "x": "X root map",
    "y": "Y root map",
    "z": "Z root map",
}
DESCRIPTION_MEANING_MAP = {
    "其他": "other",
    "总结": "summary",
    "小结": "summary",
    "元音变换": "vowel change",
    "木制品": "wood products",
    "植物": "plants",
    "线": "line",
    "颜色": "color",
    "时空": "time/space",
    "时间": "time",
    "状态": "state",
    "物理": "physics",
    "政治": "politics",
    "含义": "meaning",
    "动作": "action",
    "加强": "strengthen",
    "超越": "surpass",
    "抽象含义": "abstract meaning",
    "抽象概念类派生": "abstract concepts",
    "情感类派生": "emotion-related forms",
    "物理/状态类派生": "physical/state forms",
    "不包含类派生": "exclusion-related forms",
    "情感/性格类派生": "emotion/trait forms",
    "语言/生物类派生": "language/biology forms",
    "情感/态度类派生": "emotion/attitude forms",
    "物理/动作类派生": "physical/action forms",
    "去除/否定类派生": "removal/negation forms",
    "抽象/其他类派生": "abstract/other forms",
    "前缀分支": "prefix branch",
    "前面的": "front/before",
    "基础形式": "core form",
    "c/k 前变体": "c/k variant",
    "g 前变体": "g variant",
    "f 前变体": "f variant",
    "l 前变体": "l variant",
    "分开": "separate",
    "从无到有": "create",
    "向四周": "around",
    "中心节点：其他": "other",
    "类别": "category",
    "分支": "branch",
    "前缀": "prefix",
    "动词": "verb",
    "名词": "noun",
    "形容词": "adjective",
    "副词": "adverb",
}
ARPA_TO_IPA = {
    "AA": "ɑ",
    "AE": "æ",
    "AH": "ʌ",
    "AO": "ɔ",
    "AW": "aʊ",
    "AY": "aɪ",
    "B": "b",
    "CH": "tʃ",
    "D": "d",
    "DH": "ð",
    "EH": "ɛ",
    "ER": "ɚ",
    "EY": "eɪ",
    "F": "f",
    "G": "g",
    "HH": "h",
    "IH": "ɪ",
    "IY": "i",
    "JH": "dʒ",
    "K": "k",
    "L": "l",
    "M": "m",
    "N": "n",
    "NG": "ŋ",
    "OW": "oʊ",
    "OY": "ɔɪ",
    "P": "p",
    "R": "r",
    "S": "s",
    "SH": "ʃ",
    "T": "t",
    "TH": "θ",
    "UH": "ʊ",
    "UW": "u",
    "V": "v",
    "W": "w",
    "Y": "j",
    "Z": "z",
    "ZH": "ʒ",
}
WORDNET_POS_LABEL = {
    "n": "noun",
    "v": "verb",
    "a": "adjective",
    "s": "adjective",
    "r": "adverb",
}


@dataclass
class WordContext:
    word: str
    root_id: str
    root_type: str
    translation: str
    meaning: str
    description_cn: str
    related_words: list[str]


def ensure_corpora() -> None:
    for package in ("wordnet", "omw-1.4", "averaged_perceptron_tagger_eng", "cmudict"):
        nltk.download(package, quiet=True)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_word_key(value: str) -> str:
    return normalize_spaces(value).lower()


def clean_lookup_word(word: str) -> str:
    normalized = normalize_spaces(word)
    normalized = normalized.replace("=", " ").replace("-", " ").replace("/", " ")
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip().lower()


def clean_display_word(word: str) -> str:
    return normalize_spaces(word).replace("=", " ").replace("/", " ")


def pick_related_words(words: Iterable[str], exclude: str) -> list[str]:
    result: list[str] = []
    exclude_key = normalize_word_key(exclude)
    for item in words:
        clean = normalize_spaces(item)
        if not clean or normalize_word_key(clean) == exclude_key:
            continue
        if clean not in result:
            result.append(clean)
        if len(result) >= 3:
            break
    return result


def extract_alpha_label(text: str) -> str:
    source = normalize_spaces(text)
    match = re.match(r"[A-Za-z][A-Za-z0-9='\-/]*", source)
    if not match:
        return ""
    return match.group(0).strip("-/=").lower()


def derive_description(root_data: dict) -> str:
    description = normalize_spaces(root_data.get("descriptionCn", ""))
    if description:
        return description
    root_text = normalize_spaces(root_data.get("root", ""))
    stripped = re.sub(r"^[A-Za-z0-9='\-/\s]+", "", root_text).strip()
    if stripped:
        return stripped
    meaning = normalize_spaces(root_data.get("meaning", ""))
    if meaning:
        return meaning
    if root_text:
        return root_text
    return normalize_spaces(root_data.get("rootId", ""))


def derive_root_meaning(root_data: dict) -> str:
    existing = normalize_spaces(root_data.get("meaning", ""))
    if existing:
        return existing

    root_id = normalize_spaces(root_data.get("rootId", "")).lower()
    root_text = normalize_spaces(root_data.get("root", ""))
    description = derive_description(root_data)
    root_type = normalize_spaces(root_data.get("type", "")).lower()
    alpha_label = extract_alpha_label(root_text) or extract_alpha_label(root_id)

    if root_id in LETTER_ROOT_FALLBACKS:
        return LETTER_ROOT_FALLBACKS[root_id]

    if description in DESCRIPTION_MEANING_MAP:
        return DESCRIPTION_MEANING_MAP[description]

    if root_type == "word-family":
        if alpha_label:
            return alpha_label
        return root_id or description

    if alpha_label and alpha_label not in {"other", "summary"}:
        return alpha_label

    if description:
        return DESCRIPTION_MEANING_MAP.get(description, description)

    return root_id


def get_synsets(word: str):
    lookup = clean_lookup_word(word)
    if not lookup:
        return []
    variants = [lookup]
    if " " in lookup:
        variants.append(lookup.replace(" ", "_"))
    for variant in variants:
        synsets = wn.synsets(variant)
        if synsets:
            return synsets
    return []


def is_morphology_entry(word: str, root_data: dict, synsets) -> bool:
    normalized = normalize_spaces(word)
    root_id = normalize_spaces(root_data.get("rootId", ""))
    root_type = normalize_spaces(root_data.get("type", "")).lower()
    if root_type in {"section", "category"}:
        return True
    if "=" in normalized or normalized.endswith("-"):
        return True
    if root_type == "prefix":
        return True
    if normalize_word_key(normalized) == normalize_word_key(root_id) and root_type != "word-family":
        return True
    if len(clean_lookup_word(normalized).replace(" ", "")) <= 2 and root_type != "word-family":
        return True
    if not synsets and root_type != "word-family":
        return True
    return False


def arpa_list_to_ipa(phones: list[str]) -> str:
    if not phones:
        return ""
    syllables: list[str] = []
    stress_mark = ""
    for token in phones:
        stress = ""
        base = token
        if token[-1:].isdigit():
            base = token[:-1]
            if token.endswith("1"):
                stress = "ˈ"
            elif token.endswith("2"):
                stress = "ˌ"
        ipa = ARPA_TO_IPA.get(base, base.lower())
        if stress:
            ipa = stress + ipa
        syllables.append(ipa)
    return "".join(syllables)


def get_phonetic(word: str, morphology: bool, g2p: G2p) -> str:
    cleaned = clean_display_word(word)
    if not cleaned:
        return ""

    ipa_value = normalize_spaces(eng_ipa.convert(cleaned))
    ipa_value = ipa_value.replace("*", "").strip()
    if ipa_value and not ipa_value.replace(" ", "") == cleaned.lower():
        return f"/{ipa_value}/"

    arpa = g2p(cleaned)
    ipa_from_arpa = arpa_list_to_ipa([item for item in arpa if re.fullmatch(r"[A-Z]{1,3}[0-2]?", item)])
    if ipa_from_arpa:
        return f"/{ipa_from_arpa}/"

    fallback = cleaned.lower()
    if morphology and fallback.endswith("-"):
        fallback = fallback[:-1]
    return f"/{fallback}/" if fallback else ""


def first_example_with_word(synsets, word: str) -> str:
    lookup = clean_lookup_word(word).replace(" ", "")
    if not lookup:
        return ""
    for synset in synsets:
        for example in synset.examples():
            text = normalize_spaces(example)
            if not text:
                continue
            letters_only = re.sub(r"[^a-z]", "", text.lower())
            if lookup in letters_only:
                return text
    for synset in synsets:
        for example in synset.examples():
            text = normalize_spaces(example)
            if text:
                return text
    return ""


def choose_primary_definition(synsets) -> tuple[str, str]:
    if not synsets:
        return "", ""
    synset = synsets[0]
    return normalize_spaces(synset.definition().rstrip(".")), WORDNET_POS_LABEL.get(synset.pos(), "noun")


def article_for(word: str) -> str:
    return "an" if re.match(r"(?i)[aeiou]", word or "") else "a"


def build_lexical_sentence(word: str, definition: str, pos_label: str) -> str:
    display = clean_display_word(word)
    if not display:
        return ""
    if definition:
        if pos_label == "verb":
            return f"To {display} is to {definition}."
        if pos_label == "adjective":
            return f"If something is {display}, it is {definition}."
        if pos_label == "adverb":
            return f"To act {display} is to do it {definition}."
        return f"{article_for(display).capitalize()} {display} is {definition}."
    if pos_label == "verb":
        return f"The team chose to {display} before the deadline."
    if pos_label == "adjective":
        return f"The final result was {display} enough to stand out."
    if pos_label == "adverb":
        return f"She responded {display} during the discussion."
    return f"The {display} quickly became part of the discussion."


def build_morphology_sentence(context: WordContext) -> str:
    display = clean_display_word(context.word)
    meaning = normalize_spaces(context.meaning or context.translation or context.description_cn).strip()
    related = pick_related_words(context.related_words, context.word)
    related_text = ""
    if related:
        related_text = " in words like " + ", ".join(related[:-1] + [related[-1]]) if len(related) == 1 else " in words like " + ", ".join(related[:-1]) + f", and {related[-1]}"

    if context.root_type == "prefix" or display.endswith("-"):
        if meaning:
            return f'The prefix {display} often adds the sense of "{meaning}"{related_text}.'
        return f"The prefix {display} appears{related_text}."

    if context.root_type in {"branch", "category", "section"}:
        if meaning:
            return f'This branch centers on the idea of "{meaning}"{related_text}.'
        return f"This branch groups related forms{related_text}."

    if meaning:
        return f'The root {display} is associated with "{meaning}"{related_text}.'
    return f"The root {display} appears{related_text}."


def build_word_context(word_entry: dict, root_data: dict, all_words_in_root: list[str]) -> WordContext:
    root_type = normalize_spaces(root_data.get("type", "")).lower()
    translation = normalize_spaces(word_entry.get("translation", ""))
    meaning = normalize_spaces(root_data.get("meaning", ""))
    if root_type in {"section", "category"} and translation:
        meaning = translation
    return WordContext(
        word=normalize_spaces(word_entry.get("word", "")),
        root_id=normalize_spaces(root_data.get("rootId", "")),
        root_type=root_type,
        translation=translation,
        meaning=meaning,
        description_cn=derive_description(root_data),
        related_words=all_words_in_root,
    )


def update_root_files() -> tuple[dict[str, dict], dict[tuple[str, str], dict]]:
    ensure_corpora()
    g2p = G2p()
    root_map: dict[str, dict] = {}
    word_map: dict[tuple[str, str], dict] = {}

    for path in sorted(ROOTS_DIR.glob("*.json")):
        root_data = read_json(path)
        root_data["descriptionCn"] = derive_description(root_data)
        root_data["meaning"] = derive_root_meaning(root_data)

        all_words_in_root = [normalize_spaces(item.get("word", "")) for item in root_data.get("words", [])]
        for word_entry in root_data.get("words", []):
            word = normalize_spaces(word_entry.get("word", ""))
            if not word:
                continue

            synsets = get_synsets(word)
            morphology = is_morphology_entry(word, root_data, synsets)
            word_entry["phonetic"] = get_phonetic(word, morphology, g2p)

            example = first_example_with_word(synsets, word)
            if example:
                word_entry["sentence"] = example
            else:
                definition, pos_label = choose_primary_definition(synsets)
                if morphology:
                    context = build_word_context(word_entry, root_data, all_words_in_root)
                    word_entry["sentence"] = build_morphology_sentence(context)
                else:
                    word_entry["sentence"] = build_lexical_sentence(word, definition, pos_label)

        write_json(path, root_data)
        root_id = normalize_spaces(root_data.get("rootId", ""))
        if root_id:
            root_map[root_id] = root_data
        for word_entry in root_data.get("words", []):
            word_id = normalize_spaces(word_entry.get("id", ""))
            word = normalize_word_key(word_entry.get("word", ""))
            if word_id:
                word_map[(root_id, word_id)] = word_entry
            if word:
                word_map.setdefault((root_id, f"word::{word}"), word_entry)

    return root_map, word_map


def sync_raw_roots(root_map: dict[str, dict]) -> None:
    raw = read_json(RAW_ROOTS_PATH)
    for item in raw.get("roots", []):
        root_id = normalize_spaces(item.get("rootId", ""))
        source = root_map.get(root_id)
        if not source:
            continue
        for key in (
            "root",
            "meaning",
            "descriptionCn",
            "updatedAt",
            "parentRootId",
            "rootLevel",
            "rootPath",
            "type",
            "notes",
            "sourceLabel",
            "tags",
        ):
            if key in source:
                item[key] = source.get(key)
        item["wordCount"] = len(source.get("words", []))
    write_json(RAW_ROOTS_PATH, raw)


def sync_raw_words(word_map: dict[tuple[str, str], dict]) -> None:
    raw_words = read_json(RAW_WORDS_PATH)
    for item in raw_words:
        root_id = normalize_spaces(item.get("rootId", ""))
        word_id = normalize_spaces(item.get("id", ""))
        word = normalize_word_key(item.get("word", ""))
        source = word_map.get((root_id, word_id)) or word_map.get((root_id, f"word::{word}"))
        if not source:
            continue
        for key in ("word", "display", "phonetic", "translation", "sentence", "tags", "level"):
            if key in source:
                item[key] = source.get(key)
    write_json(RAW_WORDS_PATH, raw_words)


def main() -> None:
    root_map, word_map = update_root_files()
    sync_raw_roots(root_map)
    sync_raw_words(word_map)


if __name__ == "__main__":
    main()
