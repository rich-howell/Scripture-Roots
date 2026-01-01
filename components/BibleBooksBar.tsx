import React, { useRef, useEffect } from 'react';
import { BIBLE_BOOKS } from '../constants';
import { PersonNode } from '../types';
import { Menu, X } from 'lucide-react';

interface BibleBooksBarProps {
  selectedPerson: PersonNode | null;
  selectedBook: string | null;
  onBookClick: (book: string) => void;
  onClearFilter: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const BibleBooksBar: React.FC<BibleBooksBarProps> = ({
  selectedPerson,
  selectedBook,
  onBookClick,
  onClearFilter,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Determine active book either from manual selection or person's attribute
  const activeBook = selectedBook || selectedPerson?.attributes?.firstMention;

  useEffect(() => {
    if (activeBook && scrollContainerRef.current) {
        const element = document.getElementById(`book-${activeBook}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [activeBook]);

  return (
    <div className="w-full h-12 bg-bible-ink dark:bg-black text-white py-2 z-30 shadow-md border-b border-bible-gold/30 flex items-center">
        {onToggleSidebar && (
            <button
                onClick={onToggleSidebar}
                className="ml-3 md:hidden p-2 rounded bg-white/10 hover:bg-white/20 text-white"
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
                {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
        )}

        {/* Reset Filter Button */}
        {selectedBook && (
            <button 
                onClick={onClearFilter}
                className="flex-shrink-0 ml-3 px-3 py-1 bg-red-600/80 hover:bg-red-500 text-white text-xs rounded flex items-center gap-1 transition-colors"
            >
                <X size={12} /> Clear
            </button>
        )}

        <div className="flex-1 overflow-hidden px-4">
             <div 
                ref={scrollContainerRef}
                className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 w-full"
             >
                {BIBLE_BOOKS.map((book) => {
                    const isActive = activeBook && (book === activeBook || book.includes(activeBook));
                    return (
                        <button 
                            key={book}
                            id={`book-${book}`}
                            onClick={() => onBookClick(book)}
                            className={`
                                flex-shrink-0 px-3 py-1 rounded text-xs font-serif tracking-wide transition-all duration-300 border border-transparent
                                ${isActive 
                                    ? 'bg-bible-gold text-bible-ink font-bold shadow-[0_0_10px_rgba(197,160,89,0.6)]' 
                                    : 'text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                                }
                            `}
                        >
                            {book}
                        </button>
                    );
                })}
             </div>
        </div>
        
        <div className="hidden md:block text-[9px] text-gray-500 uppercase tracking-widest mr-4 whitespace-nowrap">
            {selectedBook ? "Filter Active" : "First Appearance"}
        </div>
    </div>
  );
};
