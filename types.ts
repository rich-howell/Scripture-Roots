export interface PersonNode {
  id: string; // Unique identifier (usually name)
  name: string;
  attributes?: {
    title?: string;
    description?: string;
    spouses?: string[];
    meaning?: string;
    scriptures?: string[];
    born?: string; // String format for display e.g. "approx 4000 BC"
    died?: string;
    birthYear?: number; // Integer for timeline (negative for BC, positive for AD)
    deathYear?: number;
    firstMention?: string; // Name of the Bible Book
    [key: string]: any;
  };
  children?: PersonNode[];
  _children?: PersonNode[]; // For collapsing in D3
  hasLoadedChildren?: boolean; // Flag to check if we've fetched AI children
}

export interface TreeData {
  name: string;
  children: PersonNode[];
}

export interface SearchResult {
  id: string;
  name: string;
  role: string;
  path: string[]; // Path of IDs to find this node
}

export interface DetailedPersonInfo {
  name: string;
  meaning?: string;
  role?: string;
  bio?: string;
  scriptures?: string[];
  spouses?: string[];
  parents?: string[];
  children?: string[]; // Names only for display
  firstMention?: string;
  birthYear?: number;
  deathYear?: number;
  verseCount?: number;
}
