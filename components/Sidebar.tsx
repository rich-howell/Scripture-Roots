import React, { useState } from 'react';
import { Search, ChevronRight, Book, Users, GitBranch, Moon, Sun } from 'lucide-react';
import { searchPerson } from '../services/personDataService';

interface SidebarProps {
  onSearch: (id: string) => void;
  toggleTheme: () => void;
  isDark: boolean;
  onResetView: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}

const MAJOR_FIGURES = [
    { name: "Adam", role: "First Man" },
    { name: "Noah", role: "Patriarch" },
    { name: "Abraham", role: "Father of Nations" },
    { name: "Moses", role: "Lawgiver" },
    { name: "David", role: "King" },
    { name: "Solomon", role: "The Wise" },
];

export const Sidebar: React.FC<SidebarProps> = ({ onSearch, toggleTheme, isDark, onResetView, isMobile, onClose }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showTribes, setShowTribes] = useState(false);
  const [showLineages, setShowLineages] = useState(false);

  const TRIBES = [
      "Reuben", "Simeon", "Levi", "Judah", "Dan", "Naphtali",
      "Gad", "Asher", "Issachar", "Zebulun", "Joseph", "Benjamin"
  ];

  const LINEAGES = [
      { label: "Messianic Line (to Jesus)", target: "Jesus" },
      { label: "Davidic Line", target: "David" },
      { label: "Priestly Line", target: "Aaron" },
      { label: "Patriarchs", target: "Abraham" },
      { label: "Post-Flood Line", target: "Noah" }
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    // In a real app, this would traverse the tree data or use an index.
    // Here we use a local alias index to normalize names.
    const normalizedId = await searchPerson(query);
    setIsSearching(false);
    
    if (normalizedId) {
        onSearch(normalizedId);
        if (isMobile && onClose) onClose();
    } else {
        alert("Could not find that person in the record.");
    }
  };

  const handleNavigateByName = async (name: string) => {
    setIsSearching(true);
    const normalizedId = await searchPerson(name);
    setIsSearching(false);

    if (normalizedId) {
        onSearch(normalizedId);
        if (isMobile && onClose) onClose();
    } else {
        alert("Could not find that person in the record.");
    }
  };

  const handleMajorClick = async (name: string) => {
    handleNavigateByName(name);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 z-10 shadow-xl">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-bible-paper dark:bg-neutral-900">
        <div>
            <img
              src={isDark ? "/assets/logo.png" : "/assets/logo-light.png"}
              alt="Scripture Roots"
            />
        </div>
        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors">
            {isDark ? <Sun size={20} className="text-bible-gold" /> : <Moon size={20} className="text-bible-ink" />}
        </button>
      </div>
      {isMobile && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="md:hidden px-4 py-3 text-xs font-medium text-bible-ink dark:text-gray-200 bg-bible-paper dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-800"
        >
          Close Menu
        </button>
      )}

      {/* Search */}
      <div className="p-4">
        <form onSubmit={handleSearch} className="relative group">
            <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a person..." 
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-bible-gold/50 transition-all font-sans text-sm"
            />
            <Search className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-bible-gold transition-colors" size={18} />
            {isSearching && <div className="absolute right-3 top-3.5 animate-spin w-4 h-4 border-2 border-bible-gold border-t-transparent rounded-full"></div>}
        </form>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Key Figures</h3>
            <ul className="space-y-1">
                {MAJOR_FIGURES.map(figure => (
                    <li key={figure.name}>
                        <button 
                            onClick={() => handleMajorClick(figure.name)}
                            className="w-full flex items-center justify-between p-2 rounded-md hover:bg-bible-paper dark:hover:bg-neutral-800 group transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-700 flex items-center justify-center text-bible-red font-serif font-bold group-hover:bg-bible-red group-hover:text-white transition-colors">
                                    {figure.name[0]}
                                </div>
                                <div>
                                    <span className="block font-medium text-sm text-gray-800 dark:text-gray-200">{figure.name}</span>
                                    <span className="block text-xs text-gray-500">{figure.role}</span>
                                </div>
                            </div>
                            <ChevronRight size={14} className="text-gray-300 group-hover:text-bible-accent" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>

        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Explore</h3>
             <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => setShowTribes((prev) => !prev)}
                    className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-100 dark:border-neutral-700 hover:border-bible-gold/50 transition-colors group"
                >
                    <Users className="mb-2 text-bible-ink dark:text-gray-400 group-hover:text-bible-gold" />
                    <span className="text-xs font-medium">Tribes</span>
                </button>
                 <button
                    onClick={() => setShowLineages((prev) => !prev)}
                    className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-100 dark:border-neutral-700 hover:border-bible-gold/50 transition-colors group"
                 >
                    <GitBranch className="mb-2 text-bible-ink dark:text-gray-400 group-hover:text-bible-gold" />
                    <span className="text-xs font-medium">Lineages</span>
                </button>
             </div>
             {showTribes && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {TRIBES.map((tribe) => (
                        <button
                            key={tribe}
                            onClick={() => handleNavigateByName(tribe)}
                            className="text-xs px-2 py-2 rounded border border-gray-100 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-bible-gold/50 transition-colors"
                        >
                            {tribe}
                        </button>
                    ))}
                </div>
             )}
             {showLineages && (
                <div className="mt-3 space-y-2">
                    {LINEAGES.map((lineage) => (
                        <button
                            key={lineage.label}
                            onClick={() => handleNavigateByName(lineage.target)}
                            className="w-full text-left text-xs px-3 py-2 rounded border border-gray-100 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-bible-gold/50 transition-colors"
                        >
                            {lineage.label}
                        </button>
                    ))}
                </div>
             )}
             <button
                onClick={() => {
                    setShowTribes(false);
                    setShowLineages(false);
                    onResetView();
                    if (isMobile && onClose) onClose();
                }}
                className="mt-3 w-full flex items-center justify-center gap-2 p-3 bg-bible-paper dark:bg-neutral-800 rounded-lg border border-gray-100 dark:border-neutral-700 hover:border-bible-gold/50 transition-colors text-xs font-medium text-bible-ink dark:text-gray-200"
             >
                Reset View
             </button>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-neutral-800 text-center">
         <p className="text-[10px] text-gray-400">Local data - D3.js</p>
      </div>
    </div>
  );
};
