import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/contexts/SessionContext';

interface UploadResult {
  success: boolean;
  processed?: {
    proteins: number;
    ptmSites: number;
  };
  validationErrors?: Array<{
    row: number;
    error: string;
  }>;
  error?: string;
}

export function FileUpload() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const { currentSession, refreshSession } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!currentSession) {
        throw new Error('No active session');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/sessions/${currentSession.id}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (result) => {
      setUploadResult(result);
      refreshSession();
      queryClient.invalidateQueries({ 
        queryKey: ['/api/sessions', currentSession!.id, 'proteins'] 
      });
      
      if (result.success) {
        toast({
          title: 'Upload successful!',
          description: `Processed ${result.processed.proteins} proteins and ${result.processed.ptmSites} PTM sites.`,
        });
      }
    },
    onError: (error: Error) => {
      setUploadResult({
        success: false,
        error: error.message
      });
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      });
    }
  });

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    accept: {
      'text/tab-separated-values': ['.tsv'],
      'text/plain': ['.tsv', '.txt']
    },
    multiple: false,
    onDrop: (files) => {
      if (files.length > 0) {
        setUploadResult(null);
        uploadMutation.mutate(files[0]);
      }
    }
  });

  if (!currentSession) {
    return (
      <Card className="w-full max-w-2xl mx-auto" data-testid="card-no-session">
        <CardHeader>
          <CardTitle>No Active Session</CardTitle>
          <CardDescription>
            Please create or select a session before uploading files.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card data-testid="card-file-upload">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload PTM Data
          </CardTitle>
          <CardDescription>
            Upload a TSV file containing post-translational modification data.
            Session: <strong>{currentSession.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            } ${uploadMutation.isPending ? 'pointer-events-none opacity-50' : ''}`}
            data-testid="dropzone-upload"
          >
            <input {...getInputProps()} data-testid="input-file-upload" />
            
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-lg font-medium">Processing file...</p>
                <p className="text-sm text-muted-foreground">
                  Parsing PTM data and extracting protein information
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {acceptedFiles.length > 0 ? (
                  <FileText className="h-8 w-8 text-primary" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
                
                {isDragActive ? (
                  <p className="text-lg font-medium">Drop the file here</p>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      Drag & drop a TSV file here, or click to select
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports .tsv files up to 50MB
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {acceptedFiles.length > 0 && !uploadMutation.isPending && (
            <div className="mt-4 p-3 bg-muted rounded-lg" data-testid="info-selected-file">
              <p className="text-sm font-medium">Selected file:</p>
              <p className="text-sm text-muted-foreground">
                {acceptedFiles[0].name} ({Math.round(acceptedFiles[0].size / 1024)} KB)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {uploadResult && (
        <Card data-testid="card-upload-result">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {uploadResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Upload {uploadResult.success ? 'Successful' : 'Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadResult.success && uploadResult.processed && (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600" data-testid="text-proteins-count">
                    {uploadResult.processed.proteins}
                  </p>
                  <p className="text-sm text-muted-foreground">Proteins</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-ptm-sites-count">
                    {uploadResult.processed.ptmSites}
                  </p>
                  <p className="text-sm text-muted-foreground">PTM Sites</p>
                </div>
              </div>
            )}

            {uploadResult.error && (
              <Alert variant="destructive" data-testid="alert-upload-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadResult.error}</AlertDescription>
              </Alert>
            )}

            {uploadResult.validationErrors && uploadResult.validationErrors.length > 0 && (
              <Alert data-testid="alert-validation-warnings">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">
                    {uploadResult.validationErrors.length} validation warnings:
                  </p>
                  <ul className="text-sm space-y-1">
                    {uploadResult.validationErrors.slice(0, 5).map((error, index) => (
                      <li key={index} className="text-muted-foreground">
                        Row {error.row}: {error.error}
                      </li>
                    ))}
                    {uploadResult.validationErrors.length > 5 && (
                      <li className="text-muted-foreground">
                        ... and {uploadResult.validationErrors.length - 5} more
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}