import React, { useEffect, useState } from 'react';
import { X, BookOpen, User, Users, Info, Loader2 } from 'lucide-react';
import { DetailedPersonInfo, PersonNode } from '../types';
import { fetchPersonDetails, searchPerson } from '../services/personDataService';

interface DetailsPanelProps {
  person: PersonNode | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({ person, onClose, onNavigate }) => {
  const [details, setDetails] = useState<DetailedPersonInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (person) {
      setLoading(true);
      // Prefer local details, then fall back to node attributes for basics.
      fetchPersonDetails(person)
        .then(data => {
            setDetails(data);
            setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
        setDetails(null);
    }
  }, [person]);

  const formatYear = (year?: number) => {
    if (year === undefined || year === null) return "Unknown";
    if (year < 0) return `${Math.abs(year)} BC`;
    if (year === 0) return "AD 1";
    return `${year} AD`;
  };

  const resolveAndNavigate = async (name: string) => {
    const id = await searchPerson(name);
    if (id) onNavigate(id);
  };

  const renderNameList = (items?: string[], ids?: string[]) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item, index) => {
                const targetId = ids?.[index];
                const isClickable = Boolean(targetId);
                return (
                    <button
                        key={`${item}-${index}`}
                        onClick={() => {
                            if (targetId) {
                                onNavigate(targetId);
                            } else {
                                resolveAndNavigate(item);
                            }
                        }}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer ${
                            isClickable
                                ? 'bg-bible-red/10 text-bible-red hover:bg-bible-red hover:text-white dark:bg-bible-red/20 dark:hover:bg-bible-red'
                                : 'text-gray-600 dark:text-gray-400 hover:text-bible-accent'
                        }`}
                    >
                        {item}
                    </button>
                );
            })}
        </div>
    );
  };

  if (!person) return null;

  return (
    <div className="fixed right-0 top-0 w-full sm:w-[400px] bg-white dark:bg-neutral-900 shadow-2xl z-50 transform transition-transform duration-300 border-l border-bible-gold/20 fixed-panel-mobile">
      
      {/* Header Image Placeholder */}
      <div className="h-32 bg-bible-ink relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60"></div>
        <img 
             src={`https://picsum.photos/400/200?grayscale&blur=2`} 
             alt="Biblical Texture" 
             className="w-full h-full object-cover opacity-40"
        />
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-20 text-white hover:text-bible-gold transition-colors bg-black/20 p-1 rounded-full backdrop-blur-sm"
        >
          <X size={24} />
        </button>
        <div className="absolute bottom-4 left-6 right-16 pointer-events-none">
            <h2 className="text-3xl font-serif text-white font-bold tracking-wide">{person.name}</h2>
            {details?.role && <span className="text-bible-gold text-sm font-medium uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded">{details.role}</span>}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 text-bible-ink dark:text-gray-200">
        
        {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="animate-spin text-bible-gold" size={32} />
                <p className="text-sm text-gray-500 italic">Consulting the archives...</p>
            </div>
        ) : details ? (
            <>
                {/* Meaning */}
                {details.meaning && (
                    <div className="bg-bible-paper dark:bg-neutral-800 p-4 rounded-lg border border-bible-gold/30">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-bible-accent mb-2 uppercase tracking-wide">
                            <Info size={14} /> Name Meaning
                        </h4>
                        <p className="italic font-serif text-lg">"{details.meaning}"</p>
                    </div>
                )}

                {/* Bio */}
                <div>
                     <h3 className="font-serif font-bold text-lg mb-2 flex items-center gap-2">
                        <User size={18} className="text-bible-red" /> Biography
                     </h3>
                     <p className="leading-relaxed text-gray-700 dark:text-gray-300 text-sm">
                        {details.bio}
                     </p>
                </div>

                {/* Quick Facts */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded border border-gray-100 dark:border-neutral-700">
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Birth</span>
                        <div className="font-medium">{formatYear(details.birthYear ?? person.attributes?.birthYear)}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded border border-gray-100 dark:border-neutral-700">
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Death</span>
                        <div className="font-medium">{formatYear(details.deathYear ?? person.attributes?.deathYear)}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded border border-gray-100 dark:border-neutral-700">
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">First Mention</span>
                        <div className="font-medium">{details.firstMention ?? person.attributes?.firstMention ?? "Unknown"}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded border border-gray-100 dark:border-neutral-700">
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Verse Count</span>
                        <div className="font-medium">{details.verseCount ?? "Unknown"}</div>
                    </div>
                </div>

                {/* Family */}
                {(details.spouses?.length || details.parents?.length || details.children?.length) ? (
                    <div className="space-y-3">
                        {details.spouses && details.spouses.length > 0 && (
                            <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded border border-gray-100 dark:border-neutral-700">
                                <span className="text-xs font-bold text-gray-500 uppercase block mb-2">Spouse</span>
                                {renderNameList(details.spouses, details.spousesIds)}
                            </div>
                        )}
                        {details.parents && details.parents.length > 0 && (
                            <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded border border-gray-100 dark:border-neutral-700">
                                 <span className="text-xs font-bold text-gray-500 uppercase block mb-2">Parents</span>
                                 {renderNameList(details.parents, details.parentsIds)}
                            </div>
                        )}
                        {details.children && details.children.length > 0 && (
                            <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded border border-gray-100 dark:border-neutral-700">
                                 <span className="text-xs font-bold text-gray-500 uppercase block mb-2">Children</span>
                                 {renderNameList(details.children, details.childrenIds)}
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Scriptures */}
                {details.scriptures && details.scriptures.length > 0 && (
                    <div>
                        <h3 className="font-serif font-bold text-lg mb-3 flex items-center gap-2">
                            <BookOpen size={18} className="text-bible-gold" /> Key Scriptures
                        </h3>
                        <ul className="space-y-2">
                            {details.scriptures.map((ref, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-neutral-800 px-3 py-2 rounded border-l-2 border-bible-gold">
                                    <span className="font-medium">{ref}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </>
        ) : (
            <div className="text-center text-gray-500">Failed to load details.</div>
        )}
      </div>
    </div>
  );
};
