import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PTMSite {
  siteLocation: number;
  modificationType: string;
  type: 'experimental' | 'known';
  siteAA?: string;
  siteProbability?: number;
  quantity?: number;
  condition?: string;
  flankingRegion?: string;
  pubmedIds?: string[];
}

interface PTMSitesTableProps {
  ptmSites: PTMSite[];
  proteinSequence?: string;
}

export default function PTMSitesTable({ ptmSites, proteinSequence }: PTMSitesTableProps) {
  const [windowSize, setWindowSize] = useState(7);
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedModType, setSelectedModType] = useState<string>('all');
  const [selectedDataType, setSelectedDataType] = useState<string>('all');

  // Get unique values for filtering
  const conditions = Array.from(new Set(ptmSites.map(site => site.condition).filter(Boolean)));
  const modTypes = Array.from(new Set(ptmSites.map(site => site.modificationType)));

  // Consolidate sites by position, modification type, and condition
  const consolidatedSites = new Map<string, PTMSite & { peptideCount: number }>();
  
  ptmSites.forEach(site => {
    const key = `${site.siteLocation}_${site.modificationType}_${site.condition || 'unknown'}_${site.type}`;
    const existing = consolidatedSites.get(key);
    
    if (existing) {
      existing.peptideCount += 1;
      existing.quantity = existing.quantity && site.quantity 
        ? (existing.quantity + site.quantity) / 2
        : existing.quantity || site.quantity;
      existing.siteProbability = existing.siteProbability && site.siteProbability
        ? Math.max(existing.siteProbability, site.siteProbability)
        : existing.siteProbability || site.siteProbability;
    } else {
      consolidatedSites.set(key, {
        ...site,
        peptideCount: 1
      });
    }
  });

  // Apply filters
  const filteredSites = Array.from(consolidatedSites.values()).filter(site => {
    if (selectedCondition !== 'all' && site.condition !== selectedCondition) return false;
    if (selectedModType !== 'all' && site.modificationType !== selectedModType) return false;
    if (selectedDataType !== 'all' && site.type !== selectedDataType) return false;
    return true;
  }).sort((a, b) => a.siteLocation - b.siteLocation);

  // Function to extract sequence window around PTM site
  const getSequenceWindow = (position: number, sequence?: string): string => {
    if (!sequence) return 'N/A';
    
    const startPos = Math.max(0, position - 1 - windowSize); // -1 for 0-based indexing
    const endPos = Math.min(sequence.length, position + windowSize);
    const beforeSite = sequence.slice(startPos, position - 1);
    const siteAA = sequence[position - 1]; // -1 for 0-based indexing
    const afterSite = sequence.slice(position, endPos);
    
    return `${beforeSite}[${siteAA}]${afterSite}`;
  };

  // Export functionality
  const exportToCSV = () => {
    const headers = [
      'Position', 'Amino Acid', 'Modification Type', 'Type', 'Condition', 
      'Peptide Count', 'Probability', 'Quantity', 'Sequence Window', 'PubMed IDs'
    ];
    
    const csvData = filteredSites.map(site => [
      site.siteLocation,
      site.siteAA || 'N/A',
      site.modificationType,
      site.type,
      site.condition || 'N/A',
      site.peptideCount,
      site.siteProbability ? (site.siteProbability * 100).toFixed(1) + '%' : 'N/A',
      site.quantity ? site.quantity.toFixed(2) : 'N/A',
      getSequenceWindow(site.siteLocation, proteinSequence),
      site.pubmedIds?.join('; ') || 'N/A'
    ]);

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ptm_sites.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card data-testid="card-ptm-sites-table">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>PTM Sites Detail Table</CardTitle>
            <CardDescription>
              Consolidated modification sites with sequence context ({filteredSites.length} sites)
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCSV}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted/20 rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="window-size">Sequence Window Size</Label>
            <Input
              id="window-size"
              type="number"
              min="3"
              max="20"
              value={windowSize}
              onChange={(e) => setWindowSize(parseInt(e.target.value) || 7)}
              className="w-20"
              data-testid="input-window-size"
            />
          </div>
          
          {conditions.length > 1 && (
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                <SelectTrigger className="w-40" data-testid="select-condition">
                  <SelectValue placeholder="All conditions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All conditions</SelectItem>
                  {conditions.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {condition.length > 20 ? condition.substring(0, 20) + '...' : condition}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Modification Type</Label>
            <Select value={selectedModType} onValueChange={setSelectedModType}>
              <SelectTrigger className="w-40" data-testid="select-mod-type">
                <SelectValue placeholder="All modifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modifications</SelectItem>
                {modTypes.map((modType) => (
                  <SelectItem key={modType} value={modType}>
                    {modType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select value={selectedDataType} onValueChange={setSelectedDataType}>
              <SelectTrigger className="w-32" data-testid="select-data-type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="experimental">Experimental</SelectItem>
                <SelectItem value="known">Known</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSelectedCondition('all');
              setSelectedModType('all');
              setSelectedDataType('all');
            }}
            data-testid="button-clear-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Position</TableHead>
                <TableHead className="w-16">AA</TableHead>
                <TableHead>Modification</TableHead>
                <TableHead className="w-20">Type</TableHead>
                {conditions.length > 1 && <TableHead>Condition</TableHead>}
                <TableHead className="w-20">Peptides</TableHead>
                <TableHead className="w-20">Probability</TableHead>
                <TableHead className="w-20">Quantity</TableHead>
                <TableHead>Sequence Window</TableHead>
                <TableHead>References</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSites.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={conditions.length > 1 ? 10 : 9} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    No PTM sites match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredSites.map((site, index) => (
                  <TableRow key={index} data-testid={`row-ptm-site-${site.siteLocation}`}>
                    <TableCell className="font-mono">{site.siteLocation}</TableCell>
                    <TableCell className="font-mono font-bold">
                      {site.siteAA || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {site.modificationType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={site.type === 'experimental' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {site.type}
                      </Badge>
                    </TableCell>
                    {conditions.length > 1 && (
                      <TableCell className="text-xs max-w-32 truncate">
                        {site.condition || 'N/A'}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      {site.peptideCount > 1 ? (
                        <Badge variant="outline" className="text-xs">
                          {site.peptideCount}
                        </Badge>
                      ) : (
                        '1'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {site.siteProbability ? `${(site.siteProbability * 100).toFixed(1)}%` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-center">
                      {site.quantity ? site.quantity.toFixed(2) : 'N/A'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {getSequenceWindow(site.siteLocation, proteinSequence)}
                    </TableCell>
                    <TableCell className="text-xs max-w-24 truncate">
                      {site.pubmedIds && site.pubmedIds.length > 0 
                        ? site.pubmedIds.slice(0, 2).join(', ') + (site.pubmedIds.length > 2 ? '...' : '')
                        : 'N/A'
                      }
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredSites.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              Showing {filteredSites.length} consolidated PTM sites. 
              {ptmSites.length !== filteredSites.length && (
                ` Consolidated from ${ptmSites.length} individual peptide observations.`
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}