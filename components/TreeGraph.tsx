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

  const MAX_LABEL_CHARS = 14;
  const ROOT_WRAP_CHARS = 24;
  const isDarkMode = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const labelFill = isDarkMode ? "#e5e7eb" : "#374151";
  const outlineStroke = isDarkMode ? "rgba(17,24,39,0.85)" : "rgba(255,255,255,0.85)";
  const formatLabel = (value: string) => {
    if (!value) return "";
    if (value.length <= MAX_LABEL_CHARS) return value;
    return `${value.slice(0, MAX_LABEL_CHARS - 1)}…`;
  };
  const wrapRootLabel = (value: string) => {
    const parts = [];
    let remaining = value.trim();
    while (remaining.length > ROOT_WRAP_CHARS) {
      let cut = remaining.lastIndexOf(" ", ROOT_WRAP_CHARS);
      if (cut <= 0) cut = ROOT_WRAP_CHARS;
      parts.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) parts.push(remaining);
    return parts;
  };
  
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
    

    const labels = nodeGroup.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.children || d.data._children ? -10 : 10)
      .attr("text-anchor", d => d.children || d.data._children ? "end" : "start")
      .text(d => (d.depth === 0 ? d.data.name : formatLabel(d.data.name)))
      .attr("id", d => `text-${d.data.id}`)
      .attr("class", "node-label text-xs font-medium")
      .attr("fill", labelFill);

    labels.clone(true).lower()
      .attr("id", d => `text-outline-${d.data.id}`)
      .attr("class", "node-label-outline text-xs font-medium")
      .attr("fill", labelFill)
      .attr("stroke", outlineStroke)
      .attr("stroke-width", 3);

    labels.filter(d => d.depth === 0).each(function(d) {
      const lines = wrapRootLabel(d.data.name);
      const text = d3.select(this);
      text.text(null);
      lines.forEach((line, index) => {
        text.append("tspan")
          .attr("x", d.children || d.data._children ? -10 : 10)
          .attr("dy", index === 0 ? "0.31em" : "1.1em")
          .text(line);
      });
    });

    d3.selectAll("text.node-label-outline")
      .filter((d: any) => d && d.depth === 0)
      .each(function(d: any) {
        const lines = wrapRootLabel(d.data.name);
        const text = d3.select(this);
        text.text(null);
        lines.forEach((line: string, index: number) => {
          text.append("tspan")
            .attr("x", d.children || d.data._children ? -10 : 10)
            .attr("dy", index === 0 ? "0.31em" : "1.1em")
            .text(line);
        });
      });

    labels.append("title").text(d => d.data.name);

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

  }, [data, width, height, onNodeClick, labelFill, outlineStroke]); 

  // Effect to handle highlighting and panning separately
  useEffect(() => {
    if (!svgRef.current || !rootRef.current || !zoomBehavior.current) return;
    
    const svg = d3.select(svgRef.current);
    
    // Reset styles
    svg.selectAll("circle").attr("r", 5).attr("stroke", "#fff").attr("stroke-width", 2);
    svg.selectAll("text.node-label")
      .attr("class", "node-label text-xs font-medium")
      .attr("fill", labelFill);
    svg.selectAll("text.node-label-outline")
      .attr("class", "node-label-outline text-xs font-medium")
      .attr("fill", labelFill)
      .attr("stroke", outlineStroke);
    svg.selectAll(".node").classed("opacity-100", false).classed("opacity-70", !!highlightId);

    if (highlightId) {
        const targetNode = rootRef.current.descendants().find(d => d.data.id === highlightId);
        
        if (targetNode) {
            // Highlight styles
            svg.select(`#circle-${highlightId}`)
                .attr("r", 8)
                .attr("stroke", "rgb(138, 43, 226)")
                .attr("stroke-width", 3);
            
            const mainLabel = svg.select(`#text-${highlightId}`)
                .attr("class", "node-label text-sm font-bold")
                .attr("fill", "rgb(138, 43, 226)");

            if (targetNode.depth === 0) {
                const lines = wrapRootLabel(targetNode.data.name);
                mainLabel.text(null);
                lines.forEach((line, index) => {
                    mainLabel.append("tspan")
                      .attr("x", targetNode.children || targetNode.data._children ? -10 : 10)
                      .attr("dy", index === 0 ? "0.31em" : "1.1em")
                      .text(line);
                });
            } else {
                mainLabel.text(targetNode.data.name);
            }

            const outlineLabel = svg.select(`#text-outline-${highlightId}`)
                .attr("class", "node-label-outline text-sm font-bold")
                .attr("fill", "rgb(138, 43, 226)")
                .attr("stroke", outlineStroke)
                .attr("stroke-width", 3);

            if (targetNode.depth === 0) {
                const lines = wrapRootLabel(targetNode.data.name);
                outlineLabel.text(null);
                lines.forEach((line, index) => {
                    outlineLabel.append("tspan")
                      .attr("x", targetNode.children || targetNode.data._children ? -10 : 10)
                      .attr("dy", index === 0 ? "0.31em" : "1.1em")
                      .text(line);
                });
            } else {
                outlineLabel.text(targetNode.data.name);
            }

            // Highlight opacity path
            // This is a bit complex for a quick effect, so we just highlight the specific node and dim others
            svg.selectAll(".node")
                .filter(d => (d as any).data.id === highlightId)
                .classed("opacity-100", true)
                .classed("opacity-70", false);

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
        svg.selectAll(".node").classed("opacity-100", true).classed("opacity-70", false);
    }

  }, [highlightId, width, height, focusOffsetX, labelFill, outlineStroke]);

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
        style={{"--bg-color": outlineStroke} as React.CSSProperties}
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
