#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

import pronouncing
from nltk.corpus import wordnet as wn


REPO_ROOT = Path(__file__).resolve().parents[1]
ROOTS_DIR = REPO_ROOT / "data" / "roots"
RAW_ROOTS_PATH = REPO_ROOT / "data" / "raw" / "roots-hierarchy-fixed.json"
RAW_WORDS_PATH = REPO_ROOT / "data" / "raw" / "words-flat-fixed.json"
TODAY = date.today().isoformat()

STRUCTURAL_SENTENCE_PATTERNS = (
    re.compile(r"^This branch centers on the idea of "),
    re.compile(r"^The prefix .* often adds the sense of "),
    re.compile(r"^The root .* is associated with "),
)
PLURALISH_NOUN_RE = re.compile(r"^(?:A|An) [A-Za-z][A-Za-z' -]+ is ")
VERB_DEFINITION_RE = re.compile(r"^To ([A-Za-z][A-Za-z' -]+) is to (.+)\.$")
ASCII_ONLY_PHONETIC_RE = re.compile(r"^/[A-Za-z\s-]+/$")
TOKEN_RE = re.compile(r"[A-Za-z]+")
WORDNET_POS_LABEL = {
    "n": "noun",
    "v": "verb",
    "a": "adjective",
    "s": "adjective",
    "r": "adverb",
}
IPA_CONSONANTS = {
    "B": "b",
    "CH": "tʃ",
    "D": "d",
    "DH": "ð",
    "F": "f",
    "G": "g",
    "HH": "h",
    "JH": "dʒ",
    "K": "k",
    "L": "l",
    "M": "m",
    "N": "n",
    "NG": "ŋ",
    "P": "p",
    "R": "r",
    "S": "s",
    "SH": "ʃ",
    "T": "t",
    "TH": "θ",
    "V": "v",
    "W": "w",
    "Y": "j",
    "Z": "z",
    "ZH": "ʒ",
}
IPA_VOWELS = {
    "AA": "ɑː",
    "AE": "æ",
    "AH": "ʌ",
    "AO": "ɔː",
    "AW": "aʊ",
    "AY": "aɪ",
    "EH": "e",
    "ER": "ɝ",
    "EY": "eɪ",
    "IH": "ɪ",
    "IY": "iː",
    "OW": "oʊ",
    "OY": "ɔɪ",
    "UH": "ʊ",
    "UW": "uː",
}
SYNTHETIC_NODE_OVERRIDES = {
    "c-other": {
        "root": "c-other",
        "meaning": "other c families",
        "descriptionCn": "其他 C 系词族",
        "type": "category",
    },
    "c-wrap": {
        "root": "c-wrap",
        "meaning": "wrap / enclose c families",
        "descriptionCn": "包裹 / 封闭相关 C 系词族",
        "type": "category",
    },
}


@dataclass
class SynsetInfo:
    definition: str
    pos: str
    example: str


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_word_key(value: str) -> str:
    return normalize_text(value).lower()


def clean_lookup_word(word: str) -> str:
    cleaned = normalize_text(word).replace("=", " ").replace("-", " ").replace("/", " ")
    return normalize_text(cleaned).lower()


def clean_display_word(word: str) -> str:
    return normalize_text(word).replace("=", " ").replace("/", " ")


def capitalize_sentence(text: str) -> str:
    normalized = normalize_text(text)
    if not normalized:
        return ""
    normalized = normalized[0].upper() + normalized[1:]
    if normalized[-1] not in ".!?":
        normalized += "."
    return normalized


def is_lexical_word(word: str) -> bool:
    source = normalize_text(word)
    if not source:
        return False
    if source.endswith("-") or "=" in source or "/" in source:
        return False
    letters = "".join(ch for ch in source if ch.isalpha())
    return len(letters) >= 3


def is_pluralish_or_mass(word: str) -> bool:
    lowered = normalize_word_key(word)
    return lowered.endswith("ics") or lowered.endswith("ness") or lowered.endswith("sis") or lowered.endswith("us") or lowered.endswith("ss") or lowered.endswith("ors")


def get_synset_info(word: str) -> SynsetInfo:
    lookup = clean_lookup_word(word)
    if not lookup:
        return SynsetInfo("", "noun", "")

    variants = [lookup]
    if " " in lookup:
        variants.append(lookup.replace(" ", "_"))

    synsets = []
    for variant in variants:
        synsets = wn.synsets(variant)
        if synsets:
            break

    if not synsets:
        return SynsetInfo("", "noun", "")

    primary = synsets[0]
    example = ""
    compact_lookup = lookup.replace(" ", "")
    for synset in synsets:
        for candidate in synset.examples():
            text = normalize_text(candidate)
            if not text:
                continue
            letters_only = re.sub(r"[^a-z]", "", text.lower())
            if compact_lookup and compact_lookup in letters_only:
                example = text
                break
        if example:
            break

    if not example:
        for synset in synsets:
            for candidate in synset.examples():
                text = normalize_text(candidate)
                if text:
                    example = text
                    break
            if example:
                break

    return SynsetInfo(
        definition=normalize_text(primary.definition().rstrip(".")),
        pos=WORDNET_POS_LABEL.get(primary.pos(), "noun"),
        example=example,
    )


def article_for(word: str) -> str:
    return "an" if re.match(r"(?i)[aeiou]", word or "") else "a"


def remove_redundant_definition_prefix(word: str, definition: str) -> str:
    display = clean_display_word(word).lower()
    cleaned = normalize_text(definition)
    if not display or not cleaned:
        return cleaned

    patterns = (
        rf"^{re.escape(display)}\b",
        rf"^be {re.escape(display)}\b",
        rf"^to {re.escape(display)}\b",
    )
    for pattern in patterns:
        next_value = re.sub(pattern, "", cleaned, flags=re.IGNORECASE).strip(" ,;:-")
        if next_value and next_value != cleaned:
            cleaned = next_value
            break
    return cleaned


def build_sentence_from_definition(word: str, synset_info: SynsetInfo, translation: str = "") -> str:
    display = clean_display_word(word)
    definition = remove_redundant_definition_prefix(display, synset_info.definition)
    pos = synset_info.pos

    if synset_info.example:
        return capitalize_sentence(synset_info.example)

    if not display:
        return ""

    if pos == "verb":
        if definition.startswith("to "):
            return capitalize_sentence(f"{display} means {definition}")
        if definition:
            return capitalize_sentence(f"{display} means to {definition}")
        return capitalize_sentence(f"They chose to {display} before the deadline")

    if pos == "adjective":
        if definition:
            return capitalize_sentence(f"If something is {display}, it is {definition}")
        return capitalize_sentence(f"The result felt {display} to everyone involved")

    if pos == "adverb":
        if definition:
            return capitalize_sentence(f"If you do something {display}, you do it {definition}")
        return capitalize_sentence(f"She responded {display} during the meeting")

    if definition:
        if is_pluralish_or_mass(display):
            return capitalize_sentence(f"{display} refers to {definition}")
        return capitalize_sentence(f"{article_for(display)} {display} is {definition}")

    normalized_translation = normalize_text(translation)
    if normalized_translation:
        return capitalize_sentence(f"{display} is used here with the sense of \"{normalized_translation}\"")

    return capitalize_sentence(f"{display} appears in this root family")


def should_refresh_sentence(word: str, sentence: str, synset_info: SynsetInfo) -> bool:
    current = normalize_text(sentence)
    if not current:
        return True

    if is_lexical_word(word):
        if any(pattern.match(current) for pattern in STRUCTURAL_SENTENCE_PATTERNS):
            return True

    if synset_info.definition and PLURALISH_NOUN_RE.match(current) and is_pluralish_or_mass(word):
        return True

    match = VERB_DEFINITION_RE.match(current)
    if match and normalize_word_key(match.group(1)) == normalize_word_key(word):
        if normalize_word_key(match.group(2)).startswith(normalize_word_key(word)):
            return True

    return False


def arpa_to_simple_ipa(arpa_tokens: Iterable[str]) -> str:
    pieces = []
    for token in arpa_tokens:
        base = token[:-1] if token[-1:].isdigit() else token
        stress = token[-1] if token[-1:].isdigit() else ""
        if base in IPA_VOWELS:
            ipa = IPA_VOWELS[base]
            if base == "AH" and stress == "0":
                ipa = "ə"
        else:
            ipa = IPA_CONSONANTS.get(base, base.lower())
        pieces.append(ipa)
    return "".join(pieces)


def derive_better_phonetic(word: str, current_phonetic: str) -> str:
    current = normalize_text(current_phonetic)
    if not ASCII_ONLY_PHONETIC_RE.fullmatch(current):
        return current

    lookup = clean_lookup_word(word).replace(" ", "")
    if not lookup or not re.fullmatch(r"[a-z]+", lookup):
        return current

    phones_list = pronouncing.phones_for_word(lookup)
    if not phones_list:
        return current

    tokens = phones_list[0].split()
    if pronouncing.syllable_count(phones_list[0]) != 1:
        return current

    ipa = arpa_to_simple_ipa(tokens)
    if not ipa:
        return current

    candidate = f"/{ipa}/"
    return candidate if candidate != current else current


def family_label_from_root_id(root_id: str) -> str:
    parts = [part for part in normalize_text(root_id).split("-") if part]
    if not parts:
        return normalize_text(root_id)

    if len(parts) >= 4 and len(parts[0]) == 1 and parts[1] in {"other", "wrap"}:
        return parts[-1]

    if len(parts) >= 3 and len(parts[0]) == 1 and parts[1] not in {"other", "wrap"}:
        return " / ".join(parts[1:])

    if len(parts) >= 2 and len(parts[0]) == 1:
        return parts[-1]

    return " / ".join(parts[1:]) if len(parts) > 1 else parts[0]


def derive_root_display(root_data: dict) -> str:
    root_id = normalize_text(root_data.get("rootId"))
    current_root = normalize_text(root_data.get("root"))
    if current_root and current_root != root_id:
        return current_root
    return family_label_from_root_id(root_id) or root_id


def derive_root_meaning(root_data: dict) -> str:
    current = normalize_text(root_data.get("meaning"))
    root_id = normalize_text(root_data.get("rootId"))
    if current and current != root_id:
        return current
    label = family_label_from_root_id(root_id)
    if not label:
        return current or root_id
    return f"{label} family"


def derive_root_description(root_data: dict) -> str:
    current = normalize_text(root_data.get("descriptionCn"))
    root_id = normalize_text(root_data.get("rootId"))
    if current and current != root_id:
        return current
    label = family_label_from_root_id(root_id)
    if not label:
        return current or root_id
    return f"{label} 词族"


def infer_root_path(root_id: str, raw_word_paths_by_root: dict[str, list[str]]) -> str:
    paths = [path for path in raw_word_paths_by_root.get(root_id, []) if path]
    if paths:
        return Counter(paths).most_common(1)[0][0]
    return root_id


def path_segments(root_path: str, fallback_root_id: str) -> list[str]:
    parts = [segment.strip() for segment in str(root_path or "").split(">") if segment.strip()]
    return parts or [fallback_root_id]


def summarize_root(root_data: dict) -> dict:
    return {
        "rootId": root_data["rootId"],
        "root": normalize_text(root_data.get("root")),
        "meaning": normalize_text(root_data.get("meaning")),
        "descriptionCn": normalize_text(root_data.get("descriptionCn")),
        "type": normalize_text(root_data.get("type")) or "root",
        "parentRootId": normalize_text(root_data.get("parentRootId")),
        "rootLevel": int(root_data.get("rootLevel") or 1),
        "rootPath": normalize_text(root_data.get("rootPath")) or root_data["rootId"],
        "notes": normalize_text(root_data.get("notes")),
        "sourceLabel": normalize_text(root_data.get("sourceLabel")),
        "tags": list(root_data.get("tags") or []),
        "wordCount": len(root_data.get("words") or []),
        "updatedAt": normalize_text(root_data.get("updatedAt")) or TODAY,
    }


def main() -> None:
    root_paths = sorted(ROOTS_DIR.glob("*.json"))
    raw_words = read_json(RAW_WORDS_PATH)
    raw_word_paths_by_root: dict[str, list[str]] = defaultdict(list)
    for item in raw_words:
        root_id = normalize_text(item.get("rootId"))
        root_path = normalize_text(item.get("rootPath"))
        if root_id and root_path:
            raw_word_paths_by_root[root_id].append(root_path)

    root_records: dict[str, dict] = {}
    word_lookup: dict[tuple[str, str], dict] = {}
    counters = {
        "phonetics_upgraded": 0,
        "sentences_refreshed": 0,
        "root_metadata_repaired": 0,
    }

    for path in root_paths:
        root_data = read_json(path)
        root_id = normalize_text(root_data.get("rootId"))
        if not root_id:
            continue

        original_meta = (
            normalize_text(root_data.get("root")),
            normalize_text(root_data.get("meaning")),
            normalize_text(root_data.get("descriptionCn")),
            normalize_text(root_data.get("type")),
            normalize_text(root_data.get("parentRootId")),
            int(root_data.get("rootLevel") or 0),
            normalize_text(root_data.get("rootPath")),
        )

        inferred_path = infer_root_path(root_id, raw_word_paths_by_root)
        segments = path_segments(inferred_path, root_id)
        root_data["root"] = derive_root_display(root_data)
        root_data["meaning"] = derive_root_meaning(root_data)
        root_data["descriptionCn"] = derive_root_description(root_data)
        root_data["type"] = normalize_text(root_data.get("type")) or "root"
        root_data["rootPath"] = inferred_path
        root_data["rootLevel"] = len(segments)
        root_data["parentRootId"] = segments[-2] if len(segments) > 1 else ""
        root_data["updatedAt"] = TODAY
        if not isinstance(root_data.get("tags"), list):
            root_data["tags"] = []

        if original_meta != (
            normalize_text(root_data.get("root")),
            normalize_text(root_data.get("meaning")),
            normalize_text(root_data.get("descriptionCn")),
            normalize_text(root_data.get("type")),
            normalize_text(root_data.get("parentRootId")),
            int(root_data.get("rootLevel") or 0),
            normalize_text(root_data.get("rootPath")),
        ):
            counters["root_metadata_repaired"] += 1

        for word_entry in root_data.get("words", []):
            word = normalize_text(word_entry.get("word"))
            current_phonetic = normalize_text(word_entry.get("phonetic"))
            better_phonetic = derive_better_phonetic(word, current_phonetic)
            if better_phonetic and better_phonetic != current_phonetic:
                word_entry["phonetic"] = better_phonetic
                counters["phonetics_upgraded"] += 1

            synset_info = get_synset_info(word)
            current_sentence = normalize_text(word_entry.get("sentence"))
            if should_refresh_sentence(word, current_sentence, synset_info):
                replacement = build_sentence_from_definition(
                    word,
                    synset_info,
                    normalize_text(word_entry.get("translation")),
                )
                if replacement and replacement != current_sentence:
                    word_entry["sentence"] = replacement
                    counters["sentences_refreshed"] += 1

            word_key = normalize_word_key(word)
            if word_key:
                word_lookup[(root_id, word_key)] = word_entry

        write_json(path, root_data)
        root_records[root_id] = root_data

    root_summaries = {root_id: summarize_root(data) for root_id, data in root_records.items()}
    path_map: dict[str, str] = {}
    for root_id, summary in root_summaries.items():
        path_map[root_id] = summary["rootPath"]

    for paths in raw_word_paths_by_root.values():
        for root_path in paths:
            segments = path_segments(root_path, root_path)
            for index, segment in enumerate(segments):
                prefix_path = ">".join(segments[: index + 1])
                path_map.setdefault(segment, prefix_path)

    for root_id, root_path in sorted(path_map.items()):
        if root_id in root_summaries:
            continue
        segments = path_segments(root_path, root_id)
        override = SYNTHETIC_NODE_OVERRIDES.get(root_id, {})
        root_summaries[root_id] = {
            "rootId": root_id,
            "root": override.get("root", root_id),
            "meaning": override.get("meaning", f"{family_label_from_root_id(root_id)} family"),
            "descriptionCn": override.get(
                "descriptionCn", f"{family_label_from_root_id(root_id)} 词族"
            ),
            "type": override.get("type", "category" if len(segments) > 1 else "root"),
            "parentRootId": segments[-2] if len(segments) > 1 else "",
            "rootLevel": len(segments),
            "rootPath": root_path,
            "notes": "",
            "sourceLabel": "",
            "tags": [override.get("type", "category" if len(segments) > 1 else "root")],
            "wordCount": 0,
            "updatedAt": TODAY,
        }

    ordered_root_ids = sorted(
        root_summaries,
        key=lambda item: (
            root_summaries[item]["rootLevel"],
            root_summaries[item]["rootPath"],
            item,
        ),
    )
    raw_roots = {
        "version": 1,
        "updatedAt": TODAY,
        "roots": [root_summaries[root_id] for root_id in ordered_root_ids],
    }
    write_json(RAW_ROOTS_PATH, raw_roots)

    for raw_word in raw_words:
        root_id = normalize_text(raw_word.get("rootId"))
        word_key = normalize_word_key(raw_word.get("word"))
        source = word_lookup.get((root_id, word_key))
        if not source:
            continue
        raw_word["word"] = source.get("word", raw_word.get("word", ""))
        raw_word["display"] = source.get("display", raw_word.get("display", ""))
        raw_word["phonetic"] = source.get("phonetic", raw_word.get("phonetic", ""))
        raw_word["translation"] = source.get("translation", raw_word.get("translation", ""))
        raw_word["sentence"] = source.get("sentence", raw_word.get("sentence", ""))
        raw_word["tags"] = source.get("tags", raw_word.get("tags", []))
        raw_word["level"] = source.get("level", raw_word.get("level", 1))
        summary = root_summaries.get(root_id)
        if summary:
            raw_word["rootPath"] = summary["rootPath"]

    write_json(RAW_WORDS_PATH, raw_words)

    print(
        json.dumps(
            {
                **counters,
                "root_files": len(root_records),
                "raw_roots": len(raw_roots["roots"]),
                "raw_words": len(raw_words),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
