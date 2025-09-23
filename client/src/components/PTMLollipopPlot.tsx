import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface PTMSite {
  siteLocation: number;
  modificationType: string;
  type: 'experimental' | 'known';
  siteAA?: string;
  siteProbability?: number;
  quantity?: number;
  pubmedIds?: string[];
}

interface PTMLollipopPlotProps {
  sequenceLength: number;
  ptmSites: PTMSite[];
  width?: number;
  height?: number;
}

export default function PTMLollipopPlot({ 
  sequenceLength, 
  ptmSites, 
  width = 800, 
  height = 300 
}: PTMLollipopPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !sequenceLength || ptmSites.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const margin = { top: 40, right: 40, bottom: 60, left: 40 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([1, sequenceLength])
      .range([0, plotWidth]);

    const colorScale = d3.scaleOrdinal<string>()
      .domain(Array.from(new Set(ptmSites.map(site => site.modificationType))))
      .range(d3.schemeCategory10);

    // Draw protein sequence line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', plotWidth)
      .attr('y1', plotHeight - 40)
      .attr('y2', plotHeight - 40)
      .attr('stroke', '#666')
      .attr('stroke-width', 4)
      .attr('opacity', 0.7);

    // Add sequence length labels
    g.append('text')
      .attr('x', 0)
      .attr('y', plotHeight - 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text('1');

    g.append('text')
      .attr('x', plotWidth)
      .attr('y', plotHeight - 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text(sequenceLength.toString());

    // Group PTM sites by position to handle overlaps
    const groupedSites = d3.group(ptmSites, d => d.siteLocation);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'ptm-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    // Draw PTM lollipops
    Array.from(groupedSites.entries()).forEach(([position, sites]) => {
      const x = xScale(position);
      
      sites.forEach((site, index) => {
        const yOffset = 20 + (index * 15); // Stack overlapping sites
        const lollipopHeight = Math.min(yOffset + 40, plotHeight - 60);
        
        // Draw stick
        g.append('line')
          .attr('x1', x)
          .attr('x2', x)
          .attr('y1', plotHeight - 40)
          .attr('y2', plotHeight - 40 - lollipopHeight)
          .attr('stroke', colorScale(site.modificationType))
          .attr('stroke-width', 2)
          .attr('opacity', site.type === 'experimental' ? 1 : 0.6);

        // Draw circle (lollipop head)
        const circle = g.append('circle')
          .attr('cx', x)
          .attr('cy', plotHeight - 40 - lollipopHeight)
          .attr('r', site.type === 'experimental' ? 6 : 4)
          .attr('fill', colorScale(site.modificationType))
          .attr('stroke', site.type === 'experimental' ? '#fff' : 'none')
          .attr('stroke-width', 2)
          .attr('opacity', site.type === 'experimental' ? 1 : 0.7)
          .style('cursor', 'pointer');

        // Add hover interactions
        circle
          .on('mouseover', function(event) {
            d3.select(this)
              .transition()
              .duration(100)
              .attr('r', site.type === 'experimental' ? 8 : 6)
              .attr('stroke-width', 3);

            const tooltipContent = `
              <strong>${site.modificationType}</strong><br/>
              Position: ${position}${site.siteAA ? ` (${site.siteAA})` : ''}<br/>
              Type: ${site.type}<br/>
              ${site.siteProbability ? `Probability: ${(site.siteProbability * 100).toFixed(1)}%<br/>` : ''}
              ${site.quantity ? `Quantity: ${site.quantity.toFixed(2)}<br/>` : ''}
              ${site.pubmedIds && site.pubmedIds.length > 0 ? `PubMed IDs: ${site.pubmedIds.slice(0, 3).join(', ')}${site.pubmedIds.length > 3 ? '...' : ''}` : ''}
            `;

            tooltip
              .style('opacity', 1)
              .html(tooltipContent)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mousemove', function(event) {
            tooltip
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this)
              .transition()
              .duration(100)
              .attr('r', site.type === 'experimental' ? 6 : 4)
              .attr('stroke-width', site.type === 'experimental' ? 2 : 0);

            tooltip.style('opacity', 0);
          });
      });
    });

    // Add legend
    const legend = g.append('g')
      .attr('transform', `translate(${plotWidth - 200}, 20)`);

    const legendData = Array.from(new Set(ptmSites.map(site => site.modificationType)));
    
    legend.selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`)
      .each(function(d) {
        const item = d3.select(this);
        
        item.append('circle')
          .attr('cx', 6)
          .attr('cy', 0)
          .attr('r', 4)
          .attr('fill', colorScale(d));
        
        item.append('text')
          .attr('x', 16)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(d);
      });

    // Add type legend
    const typeLegend = g.append('g')
      .attr('transform', `translate(20, 20)`);

    const typeData = [
      { type: 'experimental', label: 'Experimental PTMs', r: 6, opacity: 1 },
      { type: 'known', label: 'Known PTMs', r: 4, opacity: 0.7 }
    ];

    typeLegend.selectAll('.type-legend-item')
      .data(typeData)
      .enter()
      .append('g')
      .attr('class', 'type-legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`)
      .each(function(d) {
        const item = d3.select(this);
        
        item.append('circle')
          .attr('cx', 6)
          .attr('cy', 0)
          .attr('r', d.r)
          .attr('fill', '#666')
          .attr('opacity', d.opacity)
          .attr('stroke', d.type === 'experimental' ? '#fff' : 'none')
          .attr('stroke-width', 2);
        
        item.append('text')
          .attr('x', 16)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(d.label);
      });

    // Cleanup function to remove tooltip on component unmount
    return () => {
      d3.selectAll('.ptm-tooltip').remove();
    };
  }, [sequenceLength, ptmSites, width, height]);

  if (!sequenceLength || ptmSites.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/20 rounded-lg border-2 border-dashed border-muted">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">No PTM data available</p>
          <p className="text-sm text-muted-foreground">
            {!sequenceLength ? 'Protein sequence required' : 'No PTM sites found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border rounded-lg bg-white"
        data-testid="ptm-lollipop-plot"
      />
      <div className="mt-4 text-sm text-muted-foreground">
        <p>
          Interactive PTM visualization showing {ptmSites.length} modification sites across {sequenceLength} amino acids.
          Hover over circles for details.
        </p>
      </div>
    </div>
  );
}