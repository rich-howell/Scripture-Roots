import { DetailedPersonInfo, PersonNode } from "../types";

type PeopleIndexEntry = {
  id: string;
  name: string;
  displayTitle?: string;
  gender?: string;
  birthYear?: number;
  deathYear?: number;
  firstMention?: string;
  verseCount?: number;
  alphaGroup?: string;
  spouses?: string[];
};

type PeopleIndex = Record<string, PeopleIndexEntry>;
type AliasesData = Record<string, string[]>;
type ChildrenIndex = Record<string, string[]>;
type DetailsIndex = Record<string, DetailedPersonInfo>;

const normalizeKey = (value: string) => value.trim().toLowerCase();

let peopleIndexCache: Map<string, PeopleIndexEntry> | null = null;
let aliasesCache: Map<string, string[]> | null = null;
let childrenCache: Map<string, string[]> | null = null;
let parentsCache: Map<string, string[]> | null = null;
let rootCache: PersonNode | null = null;
const detailsCache = new Map<string, Map<string, DetailedPersonInfo>>();

const bucketForId = (id: string) => {
  const first = id?.[0]?.toLowerCase();
  if (!first) return "other";
  return first >= "a" && first <= "z" ? first : "other";
};

const buildNode = (entry: PeopleIndexEntry): PersonNode => ({
  id: entry.id,
  name: entry.name,
  attributes: {
    title: entry.displayTitle,
    spouses: entry.spouses,
    birthYear: entry.birthYear,
    deathYear: entry.deathYear,
    firstMention: entry.firstMention
  },
  hasLoadedChildren: false
});

const loadPeopleIndex = async () => {
  if (peopleIndexCache) return peopleIndexCache;
  try {
    const response = await fetch("/data/people.json");
    if (!response.ok) throw new Error("Failed to load people.json");
    const raw = (await response.json()) as PeopleIndex;
    const map = new Map<string, PeopleIndexEntry>();
    Object.values(raw).forEach((entry) => {
      map.set(entry.id, entry);
    });
    peopleIndexCache = map;
  } catch (error) {
    console.warn("Local people index failed to load", error);
    peopleIndexCache = new Map();
  }
  return peopleIndexCache;
};

const loadAliasesData = async () => {
  if (aliasesCache) return aliasesCache;
  try {
    const response = await fetch("/data/aliases.json");
    if (!response.ok) throw new Error("Failed to load aliases.json");
    const raw = (await response.json()) as AliasesData;
    const map = new Map<string, string[]>();
    Object.entries(raw).forEach(([key, value]) => {
      map.set(normalizeKey(key), value);
    });
    aliasesCache = map;
  } catch (error) {
    console.warn("Local aliases failed to load", error);
    aliasesCache = new Map();
  }
  return aliasesCache;
};

const loadChildrenIndex = async () => {
  if (childrenCache) return childrenCache;
  try {
    const response = await fetch("/data/children.json");
    if (!response.ok) throw new Error("Failed to load children.json");
    const raw = (await response.json()) as ChildrenIndex;
    const map = new Map<string, string[]>();
    Object.entries(raw).forEach(([key, value]) => {
      map.set(key, Array.isArray(value) ? value : []);
    });
    childrenCache = map;
  } catch (error) {
    console.warn("Local children index failed to load", error);
    childrenCache = new Map();
  }
  return childrenCache;
};

const loadParentsIndex = async () => {
  if (parentsCache) return parentsCache;
  const childrenIndex = await loadChildrenIndex();
  const map = new Map<string, string[]>();
  childrenIndex.forEach((children, parentId) => {
    children.forEach((childId) => {
      const existing = map.get(childId) || [];
      if (!existing.includes(parentId)) existing.push(parentId);
      map.set(childId, existing);
    });
  });
  parentsCache = map;
  return parentsCache;
};

const loadDetailsBucket = async (bucket: string) => {
  if (detailsCache.has(bucket)) return detailsCache.get(bucket) as Map<string, DetailedPersonInfo>;
  try {
    const response = await fetch(`/data/details/${bucket}.json`);
    if (!response.ok) throw new Error(`Failed to load details/${bucket}.json`);
    const raw = (await response.json()) as DetailsIndex;
    const map = new Map<string, DetailedPersonInfo>();
    Object.entries(raw).forEach(([key, entry]) => {
      map.set(key, entry);
    });
    detailsCache.set(bucket, map);
    return map;
  } catch (error) {
    console.warn(`Local details bucket failed to load: ${bucket}`, error);
    const empty = new Map<string, DetailedPersonInfo>();
    detailsCache.set(bucket, empty);
    return empty;
  }
};

export const loadRootTree = async (): Promise<PersonNode | null> => {
  if (rootCache) return rootCache;
  try {
    const response = await fetch("/data/root.json");
    if (!response.ok) throw new Error("Failed to load root.json");
    rootCache = (await response.json()) as PersonNode;
  } catch (error) {
    console.warn("Local root tree failed to load", error);
    rootCache = null;
  }
  return rootCache;
};

export const fetchPersonDetails = async (person: PersonNode): Promise<DetailedPersonInfo> => {
  const fallback: DetailedPersonInfo = {
    name: person.name,
    meaning: person.attributes?.meaning,
    role: person.attributes?.title,
    bio: person.attributes?.description || "No local biography available yet.",
    scriptures: person.attributes?.scriptures,
    spouses: person.attributes?.spouses,
    firstMention: person.attributes?.firstMention
  };

  const bucket = bucketForId(person.id);
  const detailsBucket = await loadDetailsBucket(bucket);
  const details = detailsBucket.get(person.id);
  return { ...fallback, ...(details || {}), name: person.name };
};

export const fetchChildren = async (parentId: string): Promise<PersonNode[]> => {
  const [peopleIndex, childrenIndex] = await Promise.all([loadPeopleIndex(), loadChildrenIndex()]);
  const childIds = childrenIndex.get(parentId) || [];
  return childIds
    .map((id) => peopleIndex.get(id))
    .filter((entry): entry is PeopleIndexEntry => Boolean(entry))
    .map(buildNode);
};

export const searchPerson = async (query: string): Promise<string | null> => {
  const normalized = normalizeKey(query);
  if (!normalized) return null;
  const aliases = await loadAliasesData();
  const aliasMatches = aliases.get(normalized);
  if (aliasMatches && aliasMatches.length > 0) return aliasMatches[0];
  const peopleIndex = await loadPeopleIndex();
  if (peopleIndex.has(query)) return query;
  return null;
};

export const buildPersonNodeById = async (id: string): Promise<PersonNode | null> => {
  const peopleIndex = await loadPeopleIndex();
  const entry = peopleIndex.get(id);
  return entry ? buildNode(entry) : null;
};

export const findAncestorPath = async (targetId: string, rootId: string): Promise<string[] | null> => {
  const [parentsIndex, peopleIndex] = await Promise.all([loadParentsIndex(), loadPeopleIndex()]);

  const scoreParent = (parentId: string) => peopleIndex.get(parentId)?.verseCount ?? 0;

  const visit = (currentId: string, visited: Set<string>): string[] | null => {
    if (currentId === rootId) return [rootId];
    if (visited.has(currentId)) return null;
    visited.add(currentId);

    const parents = parentsIndex.get(currentId) || [];
    const sortedParents = [...parents].sort((a, b) => scoreParent(b) - scoreParent(a));
    for (const parentId of sortedParents) {
      const result = visit(parentId, visited);
      if (result) return [...result, currentId];
    }
    return null;
  };

  return visit(targetId, new Set());
};

export const buildBookFilteredTree = async (book: string): Promise<PersonNode | null> => {
  const [peopleIndex, childrenIndex] = await Promise.all([loadPeopleIndex(), loadChildrenIndex()]);
  if (!book) return null;

  const seedIds = Array.from(peopleIndex.values())
    .filter((entry) => entry.firstMention === book)
    .map((entry) => entry.id);

  if (seedIds.length === 0) {
    return null;
  }

  const buildSubtree = (id: string, visited: Set<string>): PersonNode | null => {
    if (visited.has(id)) return null;
    visited.add(id);

    const entry = peopleIndex.get(id);
    if (!entry) {
      visited.delete(id);
      return null;
    }

    const node = buildNode(entry, true);
    const childIds = childrenIndex.get(id) || [];
    const children: PersonNode[] = [];
    for (const childId of childIds) {
      const childNode = buildSubtree(childId, visited);
      if (childNode) children.push(childNode);
    }

    if (children.length > 0) {
      node._children = children;
    }

    visited.delete(id);
    return node;
  };

  const children = seedIds
    .map((seedId) => buildSubtree(seedId, new Set()))
    .filter((node): node is PersonNode => Boolean(node));

  return {
    id: `book-${book}`,
    name: `${book} First Appearances`,
    attributes: { title: `First Appearing in ${book}`, isFilterRoot: true },
    children,
    hasLoadedChildren: true
  };
};
