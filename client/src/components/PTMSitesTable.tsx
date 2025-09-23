import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Filter, BarChart3, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  // Ambiguity fields
  ambiguous?: boolean;
  ambiguityGroupId?: string;
  candidateUniprotIds?: string[];
}

interface ConsolidatedPTMSite extends PTMSite {
  peptideCount: number;
  conditionQuantities: Array<{
    condition: string;
    quantitySum: number;
    quantityCount: number;
    quantity: number | null; // computed from sum/count
    peptideCount: number;
  }>;
  // Ambiguity tracking
  isAmbiguous: boolean;
  candidateProteins: Set<string>;
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
  const [showAmbiguous, setShowAmbiguous] = useState<boolean>(true);

  // Get unique values for filtering
  const conditions = Array.from(new Set(ptmSites.map(site => site.condition).filter((v): v is string => !!v)));
  const modTypes = Array.from(new Set(ptmSites.map(site => site.modificationType)));

  // Consolidate sites by position, modification type, and type (experimental/known)
  // but preserve condition-specific data
  const consolidatedSites = new Map<string, ConsolidatedPTMSite>();
  
  ptmSites.forEach(site => {
    const key = `${site.siteLocation}_${site.modificationType}_${site.type}`;
    const existing = consolidatedSites.get(key);
    
    if (existing) {
      // Update overall stats
      existing.peptideCount += 1;
      existing.siteProbability = existing.siteProbability && site.siteProbability
        ? Math.max(existing.siteProbability, site.siteProbability)
        : existing.siteProbability || site.siteProbability;
      
      // Track ambiguity
      if (site.ambiguous) {
        existing.isAmbiguous = true;
        if (site.candidateUniprotIds) {
          site.candidateUniprotIds.forEach(id => existing.candidateProteins.add(id));
        }
      }
      
      // Add condition-specific quantity
      const conditionEntry = existing.conditionQuantities.find(
        cq => cq.condition === (site.condition || 'Unknown')
      );
      
      if (conditionEntry) {
        conditionEntry.peptideCount += 1;
        if (site.quantity !== undefined && site.quantity !== null) {
          conditionEntry.quantitySum += site.quantity;
          conditionEntry.quantityCount += 1;
          conditionEntry.quantity = conditionEntry.quantitySum / conditionEntry.quantityCount;
        }
      } else {
        const quantity = site.quantity ?? null;
        existing.conditionQuantities.push({
          condition: site.condition || 'Unknown',
          quantitySum: quantity ?? 0,
          quantityCount: quantity !== null ? 1 : 0,
          quantity: quantity,
          peptideCount: 1
        });
      }
    } else {
      const quantity = site.quantity ?? null;
      const candidateProteins = new Set<string>();
      const isAmbiguous = site.ambiguous || false;
      
      if (isAmbiguous && site.candidateUniprotIds) {
        site.candidateUniprotIds.forEach(id => candidateProteins.add(id));
      }
      
      consolidatedSites.set(key, {
        ...site,
        peptideCount: 1,
        isAmbiguous,
        candidateProteins,
        conditionQuantities: [{
          condition: site.condition || 'Unknown',
          quantitySum: quantity ?? 0,
          quantityCount: quantity !== null ? 1 : 0,
          quantity: quantity,
          peptideCount: 1
        }]
      });
    }
  });

  // Apply filters
  const filteredSites = Array.from(consolidatedSites.values()).filter(site => {
    if (selectedCondition !== 'all') {
      // Check if this PTM site has data for the selected condition
      const hasCondition = site.conditionQuantities.some(cq => cq.condition === selectedCondition);
      if (!hasCondition) return false;
    }
    if (selectedModType !== 'all' && site.modificationType !== selectedModType) return false;
    if (selectedDataType !== 'all' && site.type !== selectedDataType) return false;
    if (!showAmbiguous && site.isAmbiguous) return false;
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
      'Position', 'Amino Acid', 'Modification Type', 'Type', 'Ambiguous', 'Candidate Proteins',
      'Conditions', 'Peptide Count', 'Probability', 'Condition Quantities', 'Sequence Window', 'PubMed IDs'
    ];
    
    const csvData = filteredSites.map(site => [
      site.siteLocation,
      site.siteAA || 'N/A',
      site.modificationType,
      site.type,
      site.isAmbiguous ? 'Yes' : 'No',
      site.isAmbiguous ? Array.from(site.candidateProteins).join('; ') : 'N/A',
      site.conditionQuantities.map(cq => cq.condition).join('; '),
      site.peptideCount,
      site.siteProbability ? (site.siteProbability * 100).toFixed(1) + '%' : 'N/A',
      site.conditionQuantities.map(cq => `${cq.condition}: ${cq.quantity?.toFixed(2) || 'N/A'}`).join('; '),
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

          <div className="space-y-2">
            <Label>Display Options</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-ambiguous"
                checked={showAmbiguous}
                onCheckedChange={(checked) => setShowAmbiguous(checked === true)}
                data-testid="checkbox-show-ambiguous"
              />
              <Label 
                htmlFor="show-ambiguous" 
                className="text-sm font-normal cursor-pointer"
              >
                Include ambiguous sites
              </Label>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSelectedCondition('all');
              setSelectedModType('all');
              setSelectedDataType('all');
              setShowAmbiguous(true);
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
                <TableHead className="w-20">Ambiguous</TableHead>
                <TableHead className="w-32">Candidates</TableHead>
                {conditions.length > 1 && <TableHead>Condition</TableHead>}
                <TableHead className="w-20">Peptides</TableHead>
                <TableHead className="w-20">Probability</TableHead>
                <TableHead className="w-24">Quantities</TableHead>
                <TableHead>Sequence Window</TableHead>
                <TableHead>References</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSites.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={conditions.length > 1 ? 12 : 11} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    No PTM sites match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredSites.map((site, index) => (
                  <TableRow key={`${site.siteLocation}-${site.modificationType}-${site.type}`} data-testid={`row-ptm-site-${site.siteLocation}-${site.modificationType.replace(/\s+/g, '-')}-${site.type}`}>
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
                    <TableCell className="text-center">
                      {site.isAmbiguous ? (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            Yes
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-32 truncate">
                      {site.isAmbiguous && site.candidateProteins.size > 0 ? (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">
                            {site.candidateProteins.size} proteins
                          </div>
                          <div className="font-mono text-xs" title={Array.from(site.candidateProteins).join(', ')}>
                            {Array.from(site.candidateProteins).slice(0, 2).join(', ')}
                            {site.candidateProteins.size > 2 && '...'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    {conditions.length > 1 && (
                      <TableCell className="text-xs max-w-32 truncate">
                        {selectedCondition !== 'all' 
                          ? selectedCondition
                          : site.conditionQuantities.length > 1 
                            ? `Multiple (${site.conditionQuantities.length})`
                            : site.conditionQuantities[0]?.condition || 'N/A'
                        }
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
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 px-2"
                            data-testid={`button-view-quantities-${site.siteLocation}-${site.modificationType.replace(/\s+/g, '-')}-${site.type}`}
                          >
                            <BarChart3 className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>
                              Quantities by Condition
                            </DialogTitle>
                            <DialogDescription>
                              Position {site.siteLocation} ({site.siteAA}) - {site.modificationType}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="w-full h-80" data-testid={`chart-quantities-${site.siteLocation}-${site.modificationType.replace(/\s+/g, '-')}-${site.type}`}>
                            {(() => {
                              const chartData = site.conditionQuantities
                                .filter(cq => cq.quantity !== null && cq.condition)
                                .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
                                .map((cq, index) => {
                                  const condition = cq.condition || 'Unknown';
                                  return {
                                    id: `condition-${index}`,
                                    condition: condition,
                                    shortCondition: condition.length > 15 ? condition.substring(0, 15) + '...' : condition,
                                    quantity: cq.quantity || 0,
                                    peptideCount: cq.peptideCount
                                  };
                                });
                              
                              if (chartData.length === 0) {
                                return (
                                  <div className="flex items-center justify-center h-full">
                                    <p className="text-center text-muted-foreground text-sm">
                                      No quantity data available
                                    </p>
                                  </div>
                                );
                              }
                              
                              return (
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={chartData}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                                    <XAxis 
                                      dataKey="shortCondition"
                                      angle={-45}
                                      textAnchor="end"
                                      height={80}
                                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                      axisLine={{ stroke: 'hsl(var(--border))' }}
                                      tickLine={{ stroke: 'hsl(var(--border))' }}
                                    />
                                    <YAxis 
                                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                      axisLine={{ stroke: 'hsl(var(--border))' }}
                                      tickLine={{ stroke: 'hsl(var(--border))' }}
                                    />
                                    <Tooltip
                                      content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                          const data = payload[0].payload;
                                          return (
                                            <div className="bg-background/95 border rounded-lg p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/95">
                                              <p className="font-medium text-sm mb-1">
                                                {data.condition}
                                              </p>
                                              <p className="text-sm text-muted-foreground">
                                                Quantity: <span className="font-mono">{data.quantity.toFixed(2)}</span>
                                              </p>
                                              <p className="text-sm text-muted-foreground">
                                                {data.peptideCount} peptide{data.peptideCount !== 1 ? 's' : ''}
                                              </p>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                    <Bar 
                                      dataKey="quantity" 
                                      fill="hsl(var(--primary))" 
                                      radius={[4, 4, 0, 0]}
                                      className="hover:opacity-80 transition-opacity"
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              );
                            })()} 
                          </div>
                        </DialogContent>
                      </Dialog>
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