import React from 'react';
import { SearchSuggestion } from '../services/personDataService';

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  onSelect: (id: string) => void;
  visible: boolean;
  activeIndex: number;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  onSelect,
  visible,
  activeIndex
}) => {
  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion.id)}
          className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-bible-paper dark:hover:bg-neutral-700 transition-colors border-b border-gray-100 dark:border-neutral-700 last:border-b-0 ${
            index === activeIndex ? 'bg-bible-paper dark:bg-neutral-700' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-600 flex items-center justify-center text-bible-red font-serif font-bold text-sm shrink-0">
            {suggestion.name[0]}
          </div>
          <div className="min-w-0">
            <span className="block font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
              {suggestion.name}
            </span>
            {suggestion.displayTitle && suggestion.displayTitle !== suggestion.name && (
              <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                {suggestion.displayTitle}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
