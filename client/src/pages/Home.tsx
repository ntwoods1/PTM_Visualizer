import { useState } from 'react';
import { Link } from 'wouter';
import { Plus, FileText, Database, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/contexts/SessionContext';
import { FileUpload } from '@/components/FileUpload';

export default function Home() {
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { currentSession, createSession } = useSession();

  const handleCreateSession = async () => {
    if (newSessionName.trim()) {
      await createSession(newSessionName.trim());
      setNewSessionName('');
      setIsCreateDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">PTM Visualizer</h1>
                <p className="text-sm text-muted-foreground">
                  Analyze post-translational modifications from proteomics data
                </p>
              </div>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-session">
                  <Plus className="h-4 w-4 mr-2" />
                  New Session
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-create-session">
                <DialogHeader>
                  <DialogTitle>Create New Analysis Session</DialogTitle>
                  <DialogDescription>
                    Give your analysis session a descriptive name to organize your work.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="session-name">Session Name</Label>
                    <Input
                      id="session-name"
                      placeholder="e.g., SNAI1 IP Analysis"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                      data-testid="input-session-name"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel-session"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateSession}
                      disabled={!newSessionName.trim()}
                      data-testid="button-create-session-confirm"
                    >
                      Create Session
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {currentSession ? (
          <div className="space-y-8">
            {/* Session Status */}
            <Card data-testid="card-session-status">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Current Session: {currentSession.name}
                    </CardTitle>
                    <CardDescription>
                      Status: <Badge variant="secondary" data-testid="badge-session-status">
                        {currentSession.status}
                      </Badge>
                    </CardDescription>
                  </div>
                  
                  {(currentSession.totalProteins ?? 0) > 0 && (
                    <Link href="/dashboard">
                      <Button variant="outline" data-testid="link-view-dashboard">
                        View Dashboard
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              
              {((currentSession.totalProteins ?? 0) > 0 || (currentSession.totalPtmSites ?? 0) > 0) && (
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-session-proteins">
                        {currentSession.totalProteins ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Proteins</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <p className="text-2xl font-bold text-green-600" data-testid="text-session-ptm-sites">
                        {currentSession.totalPtmSites ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">PTM Sites</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">
                        {currentSession.uploadedAt ? new Date(currentSession.uploadedAt).toLocaleDateString() : '-'}
                      </p>
                      <p className="text-sm text-muted-foreground">Upload Date</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">
                        {currentSession.fileName || 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">File Name</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* File Upload */}
            <FileUpload />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Welcome Section */}
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">Welcome to PTM Visualizer</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Upload your proteomics TSV files to visualize post-translational modifications 
                with interactive lollipop plots and explore protein sequences with UniProt integration.
              </p>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Upload Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Upload TSV files containing PTM site reports from your proteomics experiments.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-green-600" />
                    UniProt Integration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Automatically fetch protein sequences and annotations from UniProt database.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    Interactive Plots
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Explore your data with interactive lollipop plots showing PTM sites along protein sequences.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Get Started */}
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Create a new analysis session to get started
              </p>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" data-testid="button-get-started">
                    <Plus className="h-4 w-4 mr-2" />
                    Get Started
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-get-started">
                  <DialogHeader>
                    <DialogTitle>Create New Analysis Session</DialogTitle>
                    <DialogDescription>
                      Give your analysis session a descriptive name to organize your work.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="session-name-2">Session Name</Label>
                      <Input
                        id="session-name-2"
                        placeholder="e.g., SNAI1 IP Analysis"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                        data-testid="input-session-name-welcome"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-cancel-session-welcome"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateSession}
                        disabled={!newSessionName.trim()}
                        data-testid="button-create-session-welcome"
                      >
                        Create Session
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}