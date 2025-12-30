import React, { useMemo, useRef, useEffect, useState } from 'react';
import { PersonNode } from '../types';

interface TimelineProps {
  data: PersonNode;
  selectedPerson: PersonNode | null;
  onSelect: (id: string) => void;
}

// Helper to extract nodes with dates from tree
const extractTimelineData = (node: PersonNode, list: {id: string, name: string, year: number}[] = []) => {
    if (node.attributes?.birthYear) {
        list.push({
            id: node.id,
            name: node.name,
            year: node.attributes.birthYear
        });
    }
    
    if (node.children) {
        node.children.forEach(child => extractTimelineData(child, list));
    }
    if (node._children) {
        node._children.forEach(child => extractTimelineData(child, list));
    }
    return list;
};

export const Timeline: React.FC<TimelineProps> = ({ data, selectedPerson, onSelect }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [hoveredItem, setHoveredItem] = useState<{ x: number, y: number, name: string, year: number } | null>(null);

    const timelineItems = useMemo(() => {
        const items = extractTimelineData(data);
        return items.sort((a, b) => a.year - b.year);
    }, [data]);

    const minYear = -4100; // Adam approx 4000 BC
    const maxYear = 100;   // NT Era
    const yearRange = maxYear - minYear;
    const timelineWidth = 6000; // Fixed large width in pixels for scrollability
    
    // Convert year to pixel position
    const getPositionPx = (year: number) => {
        const percentage = (year - minYear) / yearRange;
        return percentage * timelineWidth;
    };

    // Auto-scroll to selected person
    useEffect(() => {
        if (selectedPerson && selectedPerson.attributes?.birthYear && scrollRef.current) {
            const pos = getPositionPx(selectedPerson.attributes.birthYear);
            const containerWidth = scrollRef.current.clientWidth;
            scrollRef.current.scrollTo({
                left: pos - containerWidth / 2,
                behavior: 'smooth'
            });
        }
    }, [selectedPerson]);

    const handleMouseEnter = (e: React.MouseEvent, item: { name: string, year: number }) => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setHoveredItem({
            x: rect.left + rect.width / 2,
            y: rect.top,
            name: item.name,
            year: item.year
        });
    };

    if (timelineItems.length === 0) return null;

    return (
        <>
            <div 
                className="w-full bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 h-24 relative z-30 overflow-x-auto overflow-y-hidden" 
                ref={scrollRef}
            >
                 <div className="relative h-full" style={{ width: `${timelineWidth}px` }}>
                     {/* Axis Line */}
                     <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-300 dark:bg-neutral-700"></div>

                     {/* Major Era Ticks */}
                     {[-4000, -3000, -2000, -1000, 0].map(year => (
                         <div key={year} className="absolute top-1/2" style={{ left: `${getPositionPx(year)}px` }}>
                             <div className="h-4 w-0.5 bg-gray-400 dark:bg-neutral-600 -mt-2"></div>
                             <span className="absolute top-4 -translate-x-1/2 text-[10px] text-gray-400 font-mono font-bold">
                                {year < 0 ? `${Math.abs(year)} BC` : (year === 0 ? "AD 1" : `${year} AD`)}
                             </span>
                         </div>
                     ))}

                     {/* Minor Ticks */}
                     {Array.from({ length: Math.floor(yearRange / 100) }).map((_, i) => {
                         const year = minYear + (i * 100);
                         if (year % 1000 === 0) return null; 
                         return (
                            <div key={year} className="absolute top-1/2" style={{ left: `${getPositionPx(year)}px` }}>
                                <div className="h-2 w-px bg-gray-200 dark:bg-neutral-800 -mt-1"></div>
                            </div>
                         );
                     })}

                     {/* Points */}
                     {timelineItems.map((item) => {
                         const isSelected = selectedPerson?.id === item.id;
                         return (
                             <div 
                                key={item.id}
                                className={`
                                    absolute top-1/2 -translate-y-1/2 -translate-x-1/2 
                                    rounded-full cursor-pointer transition-all duration-300
                                    group
                                    ${isSelected 
                                        ? 'bg-bible-red w-4 h-4 z-10 shadow-[0_0_15px_rgba(138,43,226,0.8)] border-2 border-white' 
                                        : 'bg-bible-gold/60 hover:bg-bible-gold w-3 h-3 hover:scale-125'
                                    }
                                `}
                                style={{ left: `${getPositionPx(item.year)}px` }}
                                onClick={() => onSelect(item.id)}
                                onMouseEnter={(e) => handleMouseEnter(e, item)}
                                onMouseLeave={() => setHoveredItem(null)}
                             >
                             </div>
                         );
                     })}
                 </div>
            </div>

            {/* Fixed Position Tooltip to avoid overflow clipping */}
            {hoveredItem && (
                <div 
                    className="fixed z-50 pointer-events-none flex flex-col items-center"
                    style={{ 
                        left: hoveredItem.x, 
                        top: hoveredItem.y - 10, 
                        transform: 'translate(-50%, -100%)' 
                    }}
                >
                    <div className="bg-bible-ink text-bible-paper text-[10px] px-2 py-1.5 rounded shadow-lg border border-bible-gold/30 whitespace-nowrap">
                        <span className="font-bold font-serif block text-center">{hoveredItem.name}</span>
                        <span className="text-bible-gold/80 text-[9px] block text-center">
                            {hoveredItem.year < 0 ? `${Math.abs(hoveredItem.year)} BC` : `${hoveredItem.year} AD`}
                        </span>
                    </div>
                    {/* Arrow */}
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-bible-ink mt-[0px]"></div>
                </div>
            )}
        </>
    );
};