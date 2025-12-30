import React, { useState, useEffect, useRef } from 'react';
import { PersonNode } from './types';
import { TreeGraph } from './components/TreeGraph';
import { Sidebar } from './components/Sidebar';
import { DetailsPanel } from './components/DetailsPanel';
import { BibleBooksBar } from './components/BibleBooksBar';
import { Timeline } from './components/Timeline';
import { buildBookFilteredTree, buildPersonNodeById, fetchChildren, findAncestorPath, loadRootTree } from './services/personDataService';

const App: React.FC = () => {
  const [data, setData] = useState<PersonNode | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonNode | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | undefined>(undefined);
  const [isDark, setIsDark] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const hasAutoExpanded = useRef(false);

  const AUTO_EXPAND_DEPTH = 3;

  const expandInitialGenerations = async (root: PersonNode, depth: number) => {
    const cloned = JSON.parse(JSON.stringify(root)) as PersonNode;

    const expandNode = async (node: PersonNode, remainingDepth: number) => {
      if (remainingDepth <= 0) return;
      if (node.attributes?.suppressChildren) return;

      if (node._children && !node.children) {
        node.children = node._children;
        node._children = undefined;
      }

      if ((!node.children || node.children.length === 0) && !node.hasLoadedChildren) {
        const children = await fetchChildren(node.id);
        node.children = children;
        node.hasLoadedChildren = true;
      }

      if (node.children) {
        for (const child of node.children) {
          await expandNode(child, remainingDepth - 1);
        }
      }
    };

    await expandNode(cloned, depth);
    return cloned;
  };

  // Load root data once
  const resetView = async () => {
    const root = await loadRootTree();
    if (!root) return;
    const expanded = await expandInitialGenerations(root, AUTO_EXPAND_DEPTH);
    setData(expanded);
    setSelectedPerson(null);
    setHighlightId(undefined);
  };

  useEffect(() => {
    resetView();
  }, []);

  useEffect(() => {
    if (!data || hasAutoExpanded.current) return;
    hasAutoExpanded.current = true;

    expandInitialGenerations(data, AUTO_EXPAND_DEPTH).then((expanded) => {
      setData(expanded);
    });
  }, [data]);

  // Handle Window Resize
  useEffect(() => {
    const handleResize = () => {
        // Adjust height calculation to account for top bar (approx 50px) and bottom timeline (96px)
        setDimensions({ width: window.innerWidth, height: window.innerHeight - 150 });
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Init call
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const focusOffsetX = selectedPerson && window.innerWidth >= 640 ? -200 : 0;
  const isMobile = dimensions.width < 768;

  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);

  // Theme Toggle
  useEffect(() => {
      if (isDark) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  // Helper to find node by ID deep in the tree
  const findNodeById = (node: PersonNode, id: string): PersonNode | null => {
    if (node.id === id || node.name === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    // Also check hidden children
    if (node._children) {
        for (const child of node._children) {
            const found = findNodeById(child, id);
            if (found) return found;
        }
    }
    return null;
  };

  // Helper to find full path of IDs to a node
  const findPathToNode = (root: PersonNode, id: string, path: string[] = []): string[] | null => {
      if (root.id === id || root.name === id) return [...path, root.id];
      
      // Check both visible and hidden children
      const childrenToCheck = [...(root.children || []), ...(root._children || [])];
      for (const child of childrenToCheck) {
          const result = findPathToNode(child, id, [...path, root.id]);
          if (result) return result;
      }
      return null;
  };

  const updateTreeData = (root: PersonNode, targetId: string, newChildren: PersonNode[]): PersonNode => {
    const newRoot = JSON.parse(JSON.stringify(root)); 
    
    const target = findNodeById(newRoot, targetId);
    if (target) {
        target.children = newChildren;
        target.hasLoadedChildren = true;
    }
    return newRoot;
  };

  const handleNodeClick = async (node: PersonNode) => {
    if (!data) return;
    setSelectedPerson(node);
    setHighlightId(node.id);

    if (node.id === data.id) {
        return;
    }

    if (node.attributes?.isFilterRoot) {
        return;
    }

    // Local Lazy Loading Logic
    const hasChildren = (node.children && node.children.length > 0) || (node._children && node._children.length > 0);
    if (node.attributes?.suppressChildren) {
        return;
    }

    if (!hasChildren && !node.hasLoadedChildren) {
        // Optimistically update flag so we don't fetch twice
        const updatedData = JSON.parse(JSON.stringify(data));
        const target = findNodeById(updatedData, node.id);
        if (target) target.hasLoadedChildren = true;
        setData(updatedData);

        const children = await fetchChildren(node.id);
        if (children.length > 0) {
            const dataWithChildren = updateTreeData(data, node.id, children);
            setData(dataWithChildren);
        }
    } else {
        // Toggle collapse logic
        const newRoot = JSON.parse(JSON.stringify(data));
        const target = findNodeById(newRoot, node.id);
        if (target) {
            if (target.children) {
                target._children = target.children;
                target.children = undefined;
            } else if (target._children) {
                target.children = target._children;
                target._children = undefined;
            }
        }
        setData(newRoot);
    }
  };

  const handleSearch = async (id: string) => {
    if (!data) return;
    // 1. Find the path to the node
    const pathIds = findPathToNode(data, id);

    if (pathIds) {
        // 2. Clone data to mutate
        const newData = JSON.parse(JSON.stringify(data));

        // 3. Expand all ancestors
        // We traverse the path and ensure each node has 'children' active, not '_children'
        for (const pathId of pathIds) {
             const nodeInTree = findNodeById(newData, pathId);
             if (nodeInTree) {
                 if (nodeInTree._children && !nodeInTree.children) {
                     nodeInTree.children = nodeInTree._children;
                     nodeInTree._children = undefined;
                 }
             }
        }

        // 4. Update Data first
        setData(newData);

        // 5. Set Highlight (React will batch this or run effect after render)
        // We need to use the ID to let TreeGraph find the node in the new data
        const targetNode = findNodeById(newData, id);
        if (targetNode) {
            setSelectedPerson(targetNode);
            setHighlightId(targetNode.id);
        }

    } else {
        const rootId = data.id;
        const ancestorPath = await findAncestorPath(id, rootId);
        if (ancestorPath) {
            let newData = JSON.parse(JSON.stringify(data)) as PersonNode;
            for (let i = 0; i < ancestorPath.length - 1; i += 1) {
                const parentId = ancestorPath[i];
                const childId = ancestorPath[i + 1];
                const parentNode = findNodeById(newData, parentId);
                if (!parentNode) continue;

                if (parentNode._children && !parentNode.children) {
                    parentNode.children = parentNode._children;
                    parentNode._children = undefined;
                }

                if ((!parentNode.children || parentNode.children.length === 0) && !parentNode.hasLoadedChildren) {
                    const children = await fetchChildren(parentId);
                    parentNode.children = children;
                    parentNode.hasLoadedChildren = true;
                }

                if (parentNode.children && !parentNode.children.find((child) => child.id === childId)) {
                    const missingChild = await buildPersonNodeById(childId);
                    if (missingChild) {
                        parentNode.children.push(missingChild);
                    }
                }
            }

            setData(newData);

            const targetNode = findNodeById(newData, id);
            if (targetNode) {
                setSelectedPerson(targetNode);
                setHighlightId(targetNode.id);
                return;
            }
        }

        alert(`Person found in the local index: ${id}, but they are not currently loaded in the visible tree branch. Try expanding their lineage from the root.`);
    }
  };

  const handleTimelineSelect = (id: string) => {
      handleSearch(id);
  }

  const handleBookClick = async (book: string) => {
      setSelectedBook(book);
      setSelectedPerson(null);
      setHighlightId(undefined);

      const filteredTree = await buildBookFilteredTree(book);
      if (filteredTree) {
          const expanded = await expandInitialGenerations(filteredTree, AUTO_EXPAND_DEPTH);
          setData(expanded);
          return;
      }

      alert(`No people found with first appearance in ${book}.`);
  }

  const handleClearFilter = () => {
      setSelectedBook(null);
      resetView();
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-neutral-900 text-bible-ink dark:text-gray-200 font-sans">
      {isMobile && isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 h-full w-[85vw] max-w-80 transform bg-white dark:bg-neutral-900 shadow-xl transition-transform duration-300 md:static md:w-80 md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
         <Sidebar
            onSearch={handleSearch}
            toggleTheme={toggleTheme}
            isDark={isDark}
            onResetView={resetView}
            isMobile={isMobile}
            onClose={() => setIsSidebarOpen(false)}
         />
      </div>
      
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Top: Books Bar */}
        <div className="flex-shrink-0 z-50">
            <BibleBooksBar 
                selectedPerson={selectedPerson} 
                selectedBook={selectedBook}
                onBookClick={handleBookClick} 
                onClearFilter={handleClearFilter}
                onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
                isSidebarOpen={isSidebarOpen}
            />
        </div>

        {/* Middle: Map */}
        <div className="flex-1 relative overflow-hidden bg-bible-paper/30 dark:bg-neutral-900/50">
            {data ? (
                <TreeGraph 
                    data={data} 
                    onNodeClick={(node) => handleNodeClick(node)} 
                    width={dimensions.width} 
                    height={dimensions.height}
                    highlightId={highlightId}
                    focusOffsetX={focusOffsetX}
                />
            ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading tree data...</div>
            )}
        </div>

        {/* Bottom: Timeline */}
        <div className="flex-shrink-0 z-40 relative">
             {data && <Timeline data={data} selectedPerson={selectedPerson} onSelect={handleTimelineSelect} />}
        </div>
      </div>

      {selectedPerson && (
        <DetailsPanel
            person={selectedPerson}
            onClose={() => setSelectedPerson(null)}
            onNavigate={handleSearch}
        />
      )}
    </div>
  );
};

export default App;
