import { useState, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { Search, ArrowLeft, Download, Zap, Database, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/contexts/SessionContext';
import { PTM_COLORS } from '@shared/schema';
import type { Protein } from '@shared/schema';

interface ProteinSummary extends Protein {
  ptmCount: number;
  ptmTypes: string[];
  averageProbability: number;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPtmType, setSelectedPtmType] = useState<string>('all');
  const { currentSession } = useSession();

  // Fetch proteins in current session
  const { data: proteins, isLoading: proteinsLoading } = useQuery({
    queryKey: [`/api/sessions/${currentSession?.id}/proteins`],
    enabled: !!currentSession?.id,
  });

  // Fetch PTM types summary
  const { data: ptmSummary, isLoading: summaryLoading } = useQuery({
    queryKey: [`/api/sessions/${currentSession?.id}/ptm-summary`],
    enabled: !!currentSession?.id,
  });

  // Process proteins data for display
  const proteinSummaries = useMemo(() => {
    if (!proteins || !Array.isArray(proteins)) return [];
    
    return proteins.map((proteinWithPtms: any) => {
      const protein = proteinWithPtms.protein;
      const experimentalPtms = proteinWithPtms.experimentalPtms || [];
      const uniquePtmTypes = Array.from(new Set(experimentalPtms.map((ptm: any) => ptm.modificationType)));
      
      return {
        ...protein,
        ptmCount: experimentalPtms.length,
        ptmTypes: uniquePtmTypes,
        averageProbability: experimentalPtms.length > 0 
          ? experimentalPtms.reduce((sum: number, ptm: any) => sum + (ptm.siteProbability || 0), 0) / experimentalPtms.length 
          : 0
      };
    }) as ProteinSummary[];
  }, [proteins]);

  // Filter and search proteins
  const filteredProteins = useMemo(() => {
    let filtered = proteinSummaries;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(protein => 
        protein.proteinName?.toLowerCase().includes(query) ||
        protein.geneName?.toLowerCase().includes(query) ||
        protein.uniprotId.toLowerCase().includes(query)
      );
    }

    // PTM type filter
    if (selectedPtmType !== 'all') {
      filtered = filtered.filter(protein => 
        protein.ptmTypes.includes(selectedPtmType)
      );
    }

    return filtered;
  }, [proteinSummaries, searchQuery, selectedPtmType]);

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle>No Active Session</CardTitle>
            <CardDescription>
              Please create or select a session from the home page.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-back-home">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Protein Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Session: {currentSession.name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" data-testid="button-export-data">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Session Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="card-session-overview">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Proteins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {currentSession.totalProteins ?? 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">PTM Sites</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {currentSession.totalPtmSites ?? 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Upload Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={currentSession.status === 'completed' ? 'default' : 'secondary'}>
                {currentSession.status}
              </Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Upload Date</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {currentSession.uploadedAt 
                  ? new Date(currentSession.uploadedAt).toLocaleDateString()
                  : 'N/A'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PTM Types Overview */}
        {ptmSummary && Array.isArray(ptmSummary) && ptmSummary.length > 0 && !summaryLoading && (
          <Card className="mb-8" data-testid="card-ptm-summary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                PTM Types Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(ptmSummary as any[]).map((ptm: any, index: number) => {
                  return (
                    <Badge 
                      key={ptm.modificationType} 
                      variant="outline"
                      className="px-3 py-1"
                      style={{ 
                        borderColor: PTM_COLORS[ptm.modificationType as keyof typeof PTM_COLORS] || PTM_COLORS.Other,
                        color: PTM_COLORS[ptm.modificationType as keyof typeof PTM_COLORS] || PTM_COLORS.Other
                      }}
                      data-testid={`badge-ptm-${ptm.modificationType.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {ptm.modificationType} ({ptm.count})
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="mb-6" data-testid="card-search-filters">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search proteins by name, gene, or UniProt ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-proteins"
                  />
                </div>
              </div>
              
              <div className="w-full md:w-48">
                <Select value={selectedPtmType} onValueChange={setSelectedPtmType}>
                  <SelectTrigger data-testid="select-ptm-filter">
                    <SelectValue placeholder="Filter by PTM type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All PTM Types</SelectItem>
                    {Array.isArray(ptmSummary) && ptmSummary.map((ptm: any) => (
                      <SelectItem key={ptm.modificationType} value={ptm.modificationType}>
                        {ptm.modificationType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proteins Table */}
        <Card data-testid="card-proteins-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Proteins ({filteredProteins.length})
            </CardTitle>
            <CardDescription>
              Click on any protein to view detailed PTM visualization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proteinsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[150px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProteins.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No proteins found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedPtmType !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Upload a TSV file to see protein data here.'
                  }
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>UniProt ID</TableHead>
                      <TableHead>Protein Name</TableHead>
                      <TableHead>Gene</TableHead>
                      <TableHead>Organism</TableHead>
                      <TableHead>Sequence</TableHead>
                      <TableHead>PTM Sites</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProteins.map((protein) => (
                      <TableRow 
                        key={protein.id} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => setLocation(`/protein/${protein.uniprotId}`)}
                        data-testid={`row-protein-${protein.uniprotId}`}
                      >
                        <TableCell className="font-mono font-medium">
                          {protein.uniprotId}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {protein.proteinName || '-'}
                        </TableCell>
                        <TableCell>
                          {protein.geneName || '-'}
                        </TableCell>
                        <TableCell>
                          {protein.organism || 'Homo sapiens'}
                        </TableCell>
                        <TableCell>
                          {protein.sequence ? (
                            <Badge variant="outline" className="text-green-600">
                              {protein.sequenceLength || protein.sequence.length} AA
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600">
                              Not fetched
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {protein.ptmCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/protein/${protein.uniprotId}`);
                            }}
                            data-testid={`button-view-protein-${protein.uniprotId}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}