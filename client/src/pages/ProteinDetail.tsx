import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, RefreshCw, AlertCircle } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import PTMLollipopPlot from "@/components/PTMLollipopPlot";
import PTMSitesTable from "@/components/PTMSitesTable";

interface ProteinWithPTMs {
  protein: {
    uniprotId: string;
    proteinName?: string;
    geneName?: string;
    sequence?: string;
    sequenceLength?: number;
  };
  experimentalPtms: Array<{
    siteLocation: number;
    siteAA: string;
    modificationType: string;
    siteProbability?: number;
    quantity?: number;
    flankingRegion?: string;
    condition?: string;
  }>;
  knownPtms: Array<{
    siteLocation: number;
    modificationType: string;
    pubmedIds?: string[];
    isDirectSite?: boolean;
  }>;
}

export default function ProteinDetail() {
  const { uniprotId } = useParams<{ uniprotId: string }>();
  const { currentSession } = useSession();
  const { toast } = useToast();

  // Fetch protein details
  const { data: proteinData, isLoading, error } = useQuery<ProteinWithPTMs>({
    queryKey: ['/api/sessions', currentSession?.id, 'proteins', uniprotId],
    enabled: !!currentSession && !!uniprotId,
  });

  // Fetch sequence mutation
  const fetchSequenceMutation = useMutation({
    mutationFn: () => 
      apiRequest('POST', `/api/proteins/${uniprotId}/fetch-sequence`, {
        sessionId: currentSession?.id
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSession?.id, 'proteins', uniprotId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSession?.id, 'proteins'] });
      toast({
        title: "Success",
        description: "Protein sequence fetched from UniProt successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch protein sequence",
        variant: "destructive",
      });
    },
  });

  // Fetch known PTMs mutation
  const fetchKnownPtmsMutation = useMutation({
    mutationFn: () => 
      apiRequest('POST', `/api/proteins/${uniprotId}/fetch-known-ptms`, {
        sessionId: currentSession?.id
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSession?.id, 'proteins', uniprotId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSession?.id, 'proteins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSession?.id, 'ptm-summary'] });
      toast({
        title: "Success",
        description: "Known PTMs fetched from PhosphoSitePlus successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to fetch known PTMs",
        variant: "destructive",
      });
    },
  });

  // Auto-fetch sequence if protein exists but sequence is missing
  useEffect(() => {
    if (proteinData && !proteinData.protein.sequence && !fetchSequenceMutation.isPending) {
      console.log(`Auto-fetching sequence for ${uniprotId}`);
      fetchSequenceMutation.mutate();
    }
  }, [proteinData, uniprotId, fetchSequenceMutation]);

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle>No Active Session</CardTitle>
            <CardDescription>
              Please create or select a session to view protein details.
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
            <div>
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !proteinData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error?.message || "Protein not found or failed to load protein data"}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const protein = proteinData as ProteinWithPTMs;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">
                  {protein.protein.proteinName || protein.protein.uniprotId}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {protein.protein.geneName && `${protein.protein.geneName} • `}
                  UniProt ID: {protein.protein.uniprotId}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" data-testid="button-export-protein">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main visualization area */}
          <div className="lg:col-span-2">
            <Card data-testid="card-protein-visualization">
              <CardHeader>
                <CardTitle>PTM Lollipop Plot</CardTitle>
                <CardDescription>
                  Interactive visualization of post-translational modifications along the protein sequence
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!protein.protein.sequence ? (
                  <div className="text-center py-12">
                    <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Sequence Not Available</h3>
                    <p className="text-muted-foreground mb-4">
                      Fetch the protein sequence from UniProt to enable visualization
                    </p>
                    <Button 
                      onClick={() => fetchSequenceMutation.mutate()}
                      disabled={fetchSequenceMutation.isPending}
                      data-testid="button-fetch-sequence"
                    >
                      {fetchSequenceMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                      Fetch Sequence from UniProt
                    </Button>
                  </div>
                ) : (
                  <PTMLollipopPlot
                    sequenceLength={protein.protein.sequenceLength!}
                    domains={protein.protein.domains}
                    ptmSites={[
                      ...protein.experimentalPtms.map(ptm => ({
                        siteLocation: ptm.siteLocation,
                        modificationType: ptm.modificationType,
                        type: 'experimental' as const,
                        siteAA: ptm.siteAA,
                        siteProbability: ptm.siteProbability,
                        quantity: ptm.quantity,
                        condition: ptm.condition,
                        flankingRegion: ptm.flankingRegion,
                      })),
                      ...protein.knownPtms.map(ptm => ({
                        siteLocation: ptm.siteLocation,
                        modificationType: ptm.modificationType,
                        type: 'known' as const,
                        pubmedIds: ptm.pubmedIds,
                      }))
                    ]}
                    width={800}
                    height={300}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side panel with protein info and PTM details */}
          <div className="space-y-6">
            {/* Protein Information */}
            <Card data-testid="card-protein-info">
              <CardHeader>
                <CardTitle>Protein Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">UniProt ID</label>
                  <p className="font-mono">{protein.protein.uniprotId}</p>
                </div>
                
                {protein.protein.proteinName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Protein Name</label>
                    <p>{protein.protein.proteinName}</p>
                  </div>
                )}
                
                {protein.protein.geneName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gene Name</label>
                    <p>{protein.protein.geneName}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sequence Status</label>
                  <div className="flex items-center gap-2 mt-1">
                    {protein.protein.sequence ? (
                      <Badge variant="outline" className="text-green-600">
                        {protein.protein.sequenceLength} amino acids
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-orange-600">
                          Not fetched
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => fetchSequenceMutation.mutate()}
                          disabled={fetchSequenceMutation.isPending}
                          data-testid="button-fetch-sequence-sidebar"
                        >
                          {fetchSequenceMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                          Fetch
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PTM Summary */}
            <Card data-testid="card-ptm-summary">
              <CardHeader>
                <CardTitle>PTM Summary</CardTitle>
                <CardDescription>
                  Post-translational modifications found in this protein
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Experimental PTMs</h4>
                    <div className="space-y-2">
                      {protein.experimentalPtms.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No experimental PTMs found</p>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {protein.experimentalPtms.length} modification sites
                          </p>
                          <div className="space-y-1">
                            {Array.from(
                              new Set(protein.experimentalPtms.map(ptm => ptm.modificationType))
                            ).map((type) => (
                              <Badge key={type} variant="secondary" className="mr-1">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Known PTMs</h4>
                    <div className="space-y-2">
                      {protein.knownPtms.length === 0 ? (
                        <>
                          <p className="text-sm text-muted-foreground mb-2">No known PTMs loaded</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => fetchKnownPtmsMutation.mutate()}
                            disabled={fetchKnownPtmsMutation.isPending}
                            data-testid="button-fetch-known-ptms"
                          >
                            {fetchKnownPtmsMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                            Fetch from PhosphoSitePlus
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {protein.knownPtms.length} known modification sites
                          </p>
                          <div className="space-y-1">
                            {Array.from(
                              new Set(protein.knownPtms.map(ptm => ptm.modificationType))
                            ).map((type) => (
                              <Badge key={type} variant="outline" className="mr-1">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* PTM Sites Table */}
        {protein.protein.sequence && (
          <div className="mt-8">
            <PTMSitesTable
              ptmSites={[
                ...protein.experimentalPtms.map(ptm => ({
                  siteLocation: ptm.siteLocation,
                  modificationType: ptm.modificationType,
                  type: 'experimental' as const,
                  siteAA: ptm.siteAA,
                  siteProbability: ptm.siteProbability,
                  quantity: ptm.quantity,
                  condition: ptm.condition,
                  flankingRegion: ptm.flankingRegion,
                })),
                ...protein.knownPtms.map(ptm => ({
                  siteLocation: ptm.siteLocation,
                  modificationType: ptm.modificationType,
                  type: 'known' as const,
                  pubmedIds: ptm.pubmedIds,
                }))
              ]}
              proteinSequence={protein.protein.sequence}
            />
          </div>
        )}
      </div>
    </div>
  );
}