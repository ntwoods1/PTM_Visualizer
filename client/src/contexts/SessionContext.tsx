import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { AnalysisSession } from '@shared/schema';

interface SessionContextType {
  currentSession: AnalysisSession | null;
  sessions: AnalysisSession[];
  createSession: (name: string) => Promise<AnalysisSession>;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [currentSession, setCurrentSession] = useState<AnalysisSession | null>(null);
  const queryClient = useQueryClient();

  // Load current session from localStorage on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('currentSessionId');
    if (savedSessionId) {
      fetchSessionById(savedSessionId);
    }
  }, []);

  const fetchSessionById = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const session = await response.json();
        setCurrentSession(session);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
      localStorage.removeItem('currentSessionId');
    }
  };

  const createSessionMutation = useMutation({
    mutationFn: async (name: string) => {
      const sessionData = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        status: 'created' as const,
        totalProteins: 0,
        totalPtmSites: 0
      };
      
      const response = await apiRequest('POST', '/api/sessions', sessionData);
      return response.json();
    },
    onSuccess: (newSession) => {
      setCurrentSession(newSession);
      localStorage.setItem('currentSessionId', newSession.id);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest('DELETE', `/api/sessions/${sessionId}`);
      return response.json();
    },
    onSuccess: (_, sessionId) => {
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        localStorage.removeItem('currentSessionId');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    }
  });

  const createSession = async (name: string): Promise<AnalysisSession> => {
    return createSessionMutation.mutateAsync(name);
  };

  const selectSession = (sessionId: string) => {
    fetchSessionById(sessionId);
    localStorage.setItem('currentSessionId', sessionId);
  };

  const deleteSession = async (sessionId: string): Promise<void> => {
    return deleteSessionMutation.mutateAsync(sessionId);
  };

  const refreshSession = () => {
    if (currentSession) {
      fetchSessionById(currentSession.id);
    }
  };

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        sessions: [],
        createSession,
        selectSession,
        deleteSession,
        refreshSession
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}