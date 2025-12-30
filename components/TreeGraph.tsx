import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PersonNode } from '../types';
import { Maximize, Minus, Plus } from 'lucide-react';

interface TreeGraphProps {
  data: PersonNode;
  onNodeClick: (node: PersonNode, d3Node: d3.HierarchyPointNode<PersonNode>) => void;
  width: number;
  height: number;
  highlightId?: string;
  focusOffsetX?: number;
}

export const TreeGraph: React.FC<TreeGraphProps> = ({ data, onNodeClick, width, height, highlightId, focusOffsetX = 0 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Keep track of the d3 selection for zoom programmatic control
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gSelection = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  
  // Store root to access node positions for auto-pan
  const rootRef = useRef<d3.HierarchyPointNode<PersonNode> | null>(null);

  // Initialize and Render Graph
  useEffect(() => {
    if (!svgRef.current || !data) return;

    // Clear previous render
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    gSelection.current = g;

    // Setup Layout
    const hierarchy = d3.hierarchy<PersonNode>(data);
    const treeLayout = d3.tree<PersonNode>().nodeSize([40, 160]); 

    hierarchy.descendants().forEach((d, i) => {
      // @ts-ignore - Adding custom id
      d.id = d.data.id || i; 
      if (d.data._children && !d.data.children) {
          d.children = undefined; 
      }
    });

    const root = treeLayout(hierarchy);
    rootRef.current = root; // Save for auto-pan

    // Setup Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    zoomBehavior.current = zoom;
    svg.call(zoom);

    // Initial Center if no highlight, otherwise we rely on the highlight effect below
    if (!highlightId) {
        const initialTransform = d3.zoomIdentity.translate(50, height / 2).scale(1);
        svg.call(zoom.transform, initialTransform);
    }

    // Links
    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkHorizontal<d3.HierarchyPointLink<PersonNode>, d3.HierarchyPointNode<PersonNode>>()
        .x(d => d.y)
        .y(d => d.x) as any
      )
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.6);

    // Nodes
    const nodeGroup = g.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", d => `node cursor-pointer transition-opacity duration-300`) // ID matching handled in separate effect for perf
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick(d.data, d);
      });

    // Node Circles
    nodeGroup.append("circle")
      .attr("r", 5) // Base radius
      .attr("id", d => `circle-${d.data.id}`) // Add ID for selection
      .attr("fill", d => d.children || d.data._children ? "#c5a059" : "#94a3b8")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Labels
    nodeGroup.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.children || d.data._children ? -10 : 10)
      .attr("text-anchor", d => d.children || d.data._children ? "end" : "start")
      .text(d => d.data.name)
      .attr("id", d => `text-${d.data.id}`)
      .attr("class", "text-xs font-medium fill-current text-gray-700 dark:text-gray-300")
      .clone(true).lower()
      .attr("stroke", "var(--bg-color, white)")
      .attr("stroke-width", 3);

    // Attribute Tags
    nodeGroup.each(function(d) {
        if (d.data.attributes?.spouses && d.data.attributes.spouses.length > 0) {
            d3.select(this).append("text")
            .attr("dy", "1.4em")
            .attr("x", d.children || d.data._children ? -10 : 10)
            .attr("text-anchor", d.children || d.data._children ? "end" : "start")
            .text(`& ${d.data.attributes.spouses[0]}`)
            .attr("class", "text-[8px] fill-gray-500 italic");
        }
    });

  }, [data, width, height, onNodeClick]); 

  // Effect to handle highlighting and panning separately
  useEffect(() => {
    if (!svgRef.current || !rootRef.current || !zoomBehavior.current) return;
    
    const svg = d3.select(svgRef.current);
    
    // Reset styles
    svg.selectAll("circle").attr("r", 5).attr("stroke", "#fff").attr("stroke-width", 2);
    svg.selectAll("text.fill-current").attr("class", "text-xs font-medium fill-current text-gray-700 dark:text-gray-300");
    svg.selectAll(".node").classed("opacity-100", false).classed("opacity-40", !!highlightId);

    if (highlightId) {
        const targetNode = rootRef.current.descendants().find(d => d.data.id === highlightId);
        
        if (targetNode) {
            // Highlight styles
            svg.select(`#circle-${highlightId}`)
                .attr("r", 8)
                .attr("stroke", "#8a2be2")
                .attr("stroke-width", 3);
            
            svg.select(`#text-${highlightId}`)
                .attr("class", "text-sm font-bold fill-current text-bible-red");

            // Highlight opacity path
            // This is a bit complex for a quick effect, so we just highlight the specific node and dim others
            svg.selectAll(".node")
                .filter(d => (d as any).data.id === highlightId)
                .classed("opacity-100", true)
                .classed("opacity-40", false);

            // PAN TO NODE
            // Calculate translation to center the node
            // Tree is horizontal: y is x-axis (depth), x is y-axis (vertical)
            const scale = 1.2; // Zoom in a bit on select
            const x = -targetNode.y * scale + width / 2 + focusOffsetX;
            const y = -targetNode.x * scale + height / 2;
            
            svg.transition().duration(750).call(
                zoomBehavior.current.transform, 
                d3.zoomIdentity.translate(x, y).scale(scale)
            );
        }
    } else {
        svg.selectAll(".node").classed("opacity-100", true).classed("opacity-40", false);
    }

  }, [highlightId, width, height, focusOffsetX]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomBehavior.current) {
        d3.select(svgRef.current).transition().call(zoomBehavior.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehavior.current) {
        d3.select(svgRef.current).transition().call(zoomBehavior.current.scaleBy, 0.7);
    }
  };

  const handleResetZoom = () => {
     if (svgRef.current && zoomBehavior.current) {
        d3.select(svgRef.current).transition().call(zoomBehavior.current.transform, d3.zoomIdentity.translate(50, height / 2).scale(1));
     }
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-50 dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800" ref={wrapperRef}>
      <svg 
        ref={svgRef} 
        width={width} 
        height={height}
        className="w-full h-full cursor-move select-none"
        style={{"--bg-color": "rgba(255,255,255,0.8)"} as React.CSSProperties}
      />
      
      {/* Controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 bg-white dark:bg-neutral-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700">
        <button onClick={handleZoomIn} className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded text-bible-ink dark:text-gray-200" title="Zoom In">
          <Plus size={20} />
        </button>
        <button onClick={handleZoomOut} className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded text-bible-ink dark:text-gray-200" title="Zoom Out">
          <Minus size={20} />
        </button>
        <button onClick={handleResetZoom} className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded text-bible-ink dark:text-gray-200" title="Reset View">
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
};
