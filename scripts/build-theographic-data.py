import json
import os
import re
import urllib.request
from datetime import datetime
from collections import defaultdict

BASE_URL = "https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json"
PEOPLE_URL = f"{BASE_URL}/people.json"
VERSES_URL = f"{BASE_URL}/verses.json"
BOOKS_URL = f"{BASE_URL}/books.json"
CHAPTERS_URL = f"{BASE_URL}/chapters.json"

OUTPUT_DIR = os.path.join("public", "data")
DETAILS_DIR = os.path.join(OUTPUT_DIR, "details")

ROOT_ID = "bible_root"
ROOT_NAME = "Bible"

MAX_SCRIPTURE_REFS = 6
MAX_BIO_SENTENCES = 3
MAX_DISAMBIG_LENGTH = 40


def fetch_json(url: str):
    with urllib.request.urlopen(url) as response:
        return json.load(response)


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def split_sentences(text: str):
    cleaned = re.sub(r"\s+", " ", text.replace("\n", " ").strip())
    if not cleaned:
        return []
    return re.split(r"(?<=[.!?])\s+", cleaned)

def clean_dict_text(text: str):
    if not text:
        return None
    if isinstance(text, list):
        text = " ".join(item for item in text if isinstance(item, str))
    if not isinstance(text, str):
        return None
    cleaned = text
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    cleaned = cleaned.replace("“", "\"").replace("”", "\"")
    cleaned = cleaned.replace("‘", "'").replace("’", "'")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def extract_disambiguation(name: str, text: str | None):
    if not text or not isinstance(text, str):
        return None
    cleaned = text.strip()
    if cleaned.startswith(name):
        match = re.search(r"\(([^)]+)\)", cleaned)
        if match:
            candidate = match.group(1).strip()
            return shorten_disambiguation(name, candidate)
        remainder = cleaned[len(name):].strip(" -:;,")
        if remainder:
            return shorten_disambiguation(name, remainder)
    match = re.search(r"\(([^)]+)\)", cleaned)
    if match:
        return shorten_disambiguation(name, match.group(1).strip())
    return shorten_disambiguation(name, cleaned)

def shorten_disambiguation(name: str, text: str):
    candidate = text.strip()
    if candidate.lower().startswith(name.lower()):
        candidate = candidate[len(name):].strip(" -:;,")
    lower = candidate.lower()
    if lower.startswith("is "):
        candidate = candidate[3:].strip()
    elif lower.startswith("was "):
        candidate = candidate[4:].strip()
    if "\"" in candidate:
        parts = candidate.split("\"")
        if len(parts) >= 3 and parts[1].strip():
            candidate = parts[1].strip()
    if "," in candidate:
        head = candidate.split(",", 1)[0].strip()
        if head:
            candidate = head
    return candidate[:MAX_DISAMBIG_LENGTH].strip()

def build_display_name(name: str, disambig: str | None):
    if not disambig:
        return name
    short = extract_disambiguation(name, disambig)
    if not short or short.lower() == name.lower():
        return name
    return f"{name} ({short})"


def trim_bio(text: str, max_sentences: int):
    cleaned = clean_dict_text(text)
    if not cleaned:
        return None
    sentences = split_sentences(cleaned)
    if not sentences:
        return None
    trimmed = " ".join(sentences[:max_sentences]).strip()
    return trimmed if trimmed else None


def bucket_for_id(person_id: str) -> str:
    if not person_id:
        return "other"
    first = person_id[0].lower()
    return first if "a" <= first <= "z" else "other"

def build_node(entry, has_loaded=False, extra_attributes=None):
    extra_attributes = extra_attributes or {}
    return {
        "id": entry.get("id"),
        "name": entry.get("name") or entry.get("id"),
        "attributes": {
            "title": entry.get("displayTitle"),
            "spouses": entry.get("spouses") or [],
            "birthYear": entry.get("birthYear"),
            "deathYear": entry.get("deathYear"),
            "firstMention": entry.get("firstMention"),
            **extra_attributes,
        },
        "hasLoadedChildren": has_loaded,
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(DETAILS_DIR, exist_ok=True)

    people = fetch_json(PEOPLE_URL)
    verses = fetch_json(VERSES_URL)
    books = fetch_json(BOOKS_URL)
    chapters = fetch_json(CHAPTERS_URL)

    book_map = {}
    for book in books:
        fields = book.get("fields", {})
        book_map[book["id"]] = {
            "name": fields.get("bookName"),
            "order": fields.get("bookOrder", 999),
        }

    chapter_map = {}
    for chapter in chapters:
        fields = chapter.get("fields", {})
        book_ids = fields.get("book") or []
        chapter_map[chapter["id"]] = {
            "num": fields.get("chapterNum"),
            "book_id": book_ids[0] if book_ids else None,
        }

    verse_map = {}
    for verse in verses:
        fields = verse.get("fields", {})
        book_ids = fields.get("book") or []
        chapter_ids = fields.get("chapter") or []
        verse_map[verse["id"]] = {
            "book_id": book_ids[0] if book_ids else None,
            "chapter_id": chapter_ids[0] if chapter_ids else None,
            "verse_num": fields.get("verseNum"),
            "verse_id": fields.get("verseID"),
        }

    record_to_lookup = {}
    lookup_to_name = {}
    lookup_to_display_name = {}
    lookup_to_fields = {}

    for person in people:
        fields = person.get("fields", {})
        lookup = fields.get("personLookup")
        if not lookup:
            continue
        record_to_lookup[person["id"]] = lookup
        lookup_to_name[lookup] = fields.get("name") or lookup
        lookup_to_fields[lookup] = fields

    for lookup, fields in lookup_to_fields.items():
        name = fields.get("name") or lookup
        disambiguation = fields.get("Disambiguation (temp)")
        lookup_to_display_name[lookup] = build_display_name(name, disambiguation)

    def resolve_lookup_list(record_ids):
        resolved = []
        for record_id in record_ids or []:
            lookup = record_to_lookup.get(record_id)
            if lookup:
                resolved.append(lookup)
        return resolved

    def resolve_name_list(record_ids):
        resolved = []
        for lookup in resolve_lookup_list(record_ids):
            resolved.append(lookup_to_display_name.get(lookup) or lookup_to_name.get(lookup) or lookup)
        return resolved

    def verse_ref(verse_id):
        verse = verse_map.get(verse_id)
        if not verse:
            return None
        book = book_map.get(verse.get("book_id") or "")
        chapter = chapter_map.get(verse.get("chapter_id") or "")
        book_name = book.get("name") if book else None
        chapter_num = chapter.get("num") if chapter else None
        verse_num = verse.get("verse_num")
        if not (book_name and chapter_num and verse_num):
            return None
        return f"{book_name} {chapter_num}:{verse_num}"

    def verse_sort_key(verse_id):
        verse = verse_map.get(verse_id)
        if not verse:
            return 99999999
        verse_id_value = verse.get("verse_id")
        if verse_id_value is None:
            return 99999999
        try:
            return int(verse_id_value)
        except (ValueError, TypeError):
            return 99999999

    people_index = {}
    children_map = {}
    aliases = defaultdict(list)
    details_buckets = defaultdict(dict)

    for lookup, fields in lookup_to_fields.items():
        name = lookup_to_display_name.get(lookup) or fields.get("name") or lookup
        display_title = fields.get("displayTitle")
        disambiguation = fields.get("Disambiguation (temp)")
        display_name = name
        verse_count = fields.get("verseCount", 0)
        min_year = fields.get("minYear")
        max_year = fields.get("maxYear")

        verse_ids = fields.get("verses") or []
        verse_ids_sorted = sorted(verse_ids, key=verse_sort_key)
        scriptures = []
        seen_refs = set()
        first_mention = None
        for verse_id in verse_ids_sorted:
            verse = verse_map.get(verse_id)
            if verse and not first_mention:
                book_info = book_map.get(verse.get("book_id") or "")
                first_mention = book_info.get("name") if book_info else None
            ref = verse_ref(verse_id)
            if not ref or ref in seen_refs:
                continue
            scriptures.append(ref)
            seen_refs.add(ref)
            if len(scriptures) >= MAX_SCRIPTURE_REFS:
                break

        spouses_ids = resolve_lookup_list(fields.get("partners"))
        parents_ids = resolve_lookup_list((fields.get("father") or []) + (fields.get("mother") or []))
        children_ids = resolve_lookup_list(fields.get("children"))

        spouses = [lookup_to_display_name.get(s, lookup_to_name.get(s, s)) for s in spouses_ids]
        parents = [lookup_to_display_name.get(p, lookup_to_name.get(p, p)) for p in parents_ids]
        children_names = [lookup_to_display_name.get(c, lookup_to_name.get(c, c)) for c in children_ids]

        people_index[lookup] = {
            "id": lookup,
            "name": display_name,
            "displayTitle": display_title or extract_disambiguation(name, disambiguation),
            "gender": fields.get("gender"),
            "birthYear": min_year,
            "deathYear": max_year,
            "firstMention": first_mention,
            "verseCount": verse_count,
            "alphaGroup": fields.get("alphaGroup"),
            "spouses": spouses,
        }

        children_map[lookup] = children_ids

        alias_key = normalize_name(name)
        aliases[alias_key].append((lookup, verse_count))

        bio_source = fields.get("dictionaryText") or fields.get("dictText")
        bio = trim_bio(bio_source, MAX_BIO_SENTENCES)

        details_buckets[bucket_for_id(lookup)][lookup] = {
            "id": lookup,
            "name": display_name,
            "role": display_title,
            "bio": bio,
            "scriptures": scriptures,
            "spouses": spouses,
            "spousesIds": spouses_ids,
            "parents": parents,
            "parentsIds": parents_ids,
            "children": children_names,
            "childrenIds": children_ids,
            "firstMention": first_mention,
            "birthYear": min_year,
            "deathYear": max_year,
            "verseCount": verse_count,
        }

    alias_output = {}
    for key, entries in aliases.items():
        entries_sorted = sorted(entries, key=lambda item: item[1], reverse=True)
        alias_output[key] = [item[0] for item in entries_sorted]

    adam_candidates = []
    for lookup, fields in lookup_to_fields.items():
        if fields.get("name") == "Adam":
            adam_candidates.append((lookup, fields.get("verseCount", 0)))

    adam_lookup = None
    if adam_candidates:
        adam_candidates.sort(key=lambda item: item[1], reverse=True)
        adam_lookup = adam_candidates[0][0]

    if adam_lookup and adam_lookup in people_index:
        root_entry = people_index[adam_lookup]
        root = build_node(root_entry, has_loaded=True)
        child_ids = list(children_map.get(adam_lookup, []))
        root["_children"] = [build_node(people_index[cid]) for cid in child_ids if cid in people_index]
    else:
        root = {
            "id": ROOT_ID,
            "name": ROOT_NAME,
            "attributes": {
                "title": "All People",
            },
            "_children": [],
            "hasLoadedChildren": True,
        }

    with open(os.path.join(OUTPUT_DIR, "people.json"), "w", encoding="utf-8") as handle:
        json.dump(people_index, handle, ensure_ascii=True, separators=(",", ":"))

    with open(os.path.join(OUTPUT_DIR, "children.json"), "w", encoding="utf-8") as handle:
        json.dump(children_map, handle, ensure_ascii=True, separators=(",", ":"))

    with open(os.path.join(OUTPUT_DIR, "aliases.json"), "w", encoding="utf-8") as handle:
        json.dump(alias_output, handle, ensure_ascii=True, separators=(",", ":"))

    with open(os.path.join(OUTPUT_DIR, "root.json"), "w", encoding="utf-8") as handle:
        json.dump(root, handle, ensure_ascii=True, separators=(",", ":"))

    for bucket, payload in details_buckets.items():
        with open(os.path.join(DETAILS_DIR, f"{bucket}.json"), "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=True, separators=(",", ":"))

    print(f"Generated {len(people_index)} people")
    print(f"Generated {len(children_map)} children entries")
    print(f"Generated {len(alias_output)} alias entries")
    root_children = root.get("_children") or root.get("children") or []
    print(f"Root children count {len(root_children)}")


if __name__ == "__main__":
    main()
