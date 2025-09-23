import { 
  type PTMSite, 
  type InsertPTMSite,
  type Protein,
  type InsertProtein,
  type KnownPTM,
  type InsertKnownPTM,
  type AnalysisSession,
  type InsertAnalysisSession,
  type ProteinWithPTMs
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // PTM Site operations
  createPTMSite(ptmSite: InsertPTMSite): Promise<PTMSite>;
  getPTMSitesByProtein(uniprotId: string, sessionId?: string): Promise<PTMSite[]>;
  getPTMSitesBySession(sessionId: string): Promise<PTMSite[]>;
  deletePTMSitesBySession(sessionId: string): Promise<void>;
  
  // Protein operations
  createProtein(protein: InsertProtein): Promise<Protein>;
  getProtein(uniprotId: string, sessionId?: string): Promise<Protein | undefined>;
  getProteinsBySession(sessionId: string): Promise<Protein[]>;
  updateProteinSequence(uniprotId: string, sessionId: string, sequence: string, length: number): Promise<void>;
  deleteProteinsBySession(sessionId: string): Promise<void>;
  
  // Known PTM operations  
  createKnownPTM(knownPtm: InsertKnownPTM): Promise<KnownPTM>;
  upsertKnownPTM(knownPtm: InsertKnownPTM): Promise<KnownPTM>;
  getKnownPTMsByProtein(uniprotId: string): Promise<KnownPTM[]>;
  
  // Analysis session operations
  createAnalysisSession(session: InsertAnalysisSession): Promise<AnalysisSession>;
  getAnalysisSession(id: string): Promise<AnalysisSession | undefined>;
  updateAnalysisSessionStats(id: string, totalProteins: number, totalPtmSites: number): Promise<void>;
  updateAnalysisSessionStatus(id: string, status: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Combined data for visualization
  getProteinWithPTMs(uniprotId: string, sessionId?: string): Promise<ProteinWithPTMs | undefined>;
  getProteinsInSession(sessionId: string): Promise<ProteinWithPTMs[]>;
  
  // Search and filtering
  searchProteinsByName(query: string, sessionId?: string): Promise<Protein[]>;
  getPTMTypesSummary(sessionId?: string): Promise<Array<{ modificationType: string; count: number }>>;
}

export class MemStorage implements IStorage {
  private ptmSites: Map<string, PTMSite>;
  private proteins: Map<string, Protein>;
  private knownPtms: Map<string, KnownPTM>;
  private analysisSessions: Map<string, AnalysisSession>;

  constructor() {
    this.ptmSites = new Map();
    this.proteins = new Map();
    this.knownPtms = new Map();
    this.analysisSessions = new Map();
  }

  // PTM Site operations
  async createPTMSite(insertPtmSite: InsertPTMSite): Promise<PTMSite> {
    const id = randomUUID();
    const ptmSite: PTMSite = { 
      ...insertPtmSite, 
      id,
      quantity: insertPtmSite.quantity ?? null,
      flankingRegion: insertPtmSite.flankingRegion ?? null,
      multiplicity: insertPtmSite.multiplicity ?? null,
      experimentName: insertPtmSite.experimentName ?? null,
      condition: insertPtmSite.condition ?? null,
    };
    this.ptmSites.set(id, ptmSite);
    return ptmSite;
  }

  async getPTMSitesByProtein(uniprotId: string, sessionId?: string): Promise<PTMSite[]> {
    return Array.from(this.ptmSites.values()).filter(
      (site) => site.uniprotId === uniprotId && (!sessionId || site.sessionId === sessionId),
    );
  }

  async getPTMSitesBySession(sessionId: string): Promise<PTMSite[]> {
    return Array.from(this.ptmSites.values()).filter(
      (site) => site.sessionId === sessionId,
    );
  }

  async deletePTMSitesBySession(sessionId: string): Promise<void> {
    const sitesToDelete = Array.from(this.ptmSites.entries())
      .filter(([_, site]) => site.sessionId === sessionId);
    for (const [id, _] of sitesToDelete) {
      this.ptmSites.delete(id);
    }
  }

  // Protein operations
  async createProtein(insertProtein: InsertProtein): Promise<Protein> {
    const id = randomUUID();
    const protein: Protein = { 
      ...insertProtein, 
      id,
      proteinName: insertProtein.proteinName ?? null,
      geneName: insertProtein.geneName ?? null,
      organism: insertProtein.organism ?? null,
      sequence: insertProtein.sequence ?? null,
      sequenceLength: insertProtein.sequenceLength ?? null,
      description: insertProtein.description ?? null,
      lastUpdated: insertProtein.lastUpdated ?? null,
    };
    const key = `${protein.sessionId}_${protein.uniprotId}`;
    this.proteins.set(key, protein);
    return protein;
  }

  async getProtein(uniprotId: string, sessionId?: string): Promise<Protein | undefined> {
    if (sessionId) {
      return this.proteins.get(`${sessionId}_${uniprotId}`);
    }
    // If no sessionId specified, find first matching protein across all sessions
    return Array.from(this.proteins.values()).find(p => p.uniprotId === uniprotId);
  }

  async getProteinsBySession(sessionId: string): Promise<Protein[]> {
    return Array.from(this.proteins.values()).filter(
      (protein) => protein.sessionId === sessionId,
    );
  }

  async updateProteinSequence(uniprotId: string, sessionId: string, sequence: string, length: number): Promise<void> {
    const key = `${sessionId}_${uniprotId}`;
    const protein = this.proteins.get(key);
    if (protein) {
      protein.sequence = sequence;
      protein.sequenceLength = length;
      protein.lastUpdated = new Date().toISOString();
      this.proteins.set(key, protein);
    }
  }

  async deleteProteinsBySession(sessionId: string): Promise<void> {
    const proteinsToDelete = Array.from(this.proteins.entries())
      .filter(([_, protein]) => protein.sessionId === sessionId);
    for (const [key, _] of proteinsToDelete) {
      this.proteins.delete(key);
    }
  }

  // Known PTM operations
  async createKnownPTM(insertKnownPtm: InsertKnownPTM): Promise<KnownPTM> {
    const id = randomUUID();
    const knownPtm: KnownPTM = { 
      ...insertKnownPtm, 
      id,
      organism: insertKnownPtm.organism ?? null,
      pubmedIds: insertKnownPtm.pubmedIds ?? null,
      isDirectSite: insertKnownPtm.isDirectSite ?? null,
      notes: insertKnownPtm.notes ?? null,
      source: insertKnownPtm.source ?? null,
    };
    this.knownPtms.set(id, knownPtm);
    return knownPtm;
  }

  async upsertKnownPTM(insertKnownPtm: InsertKnownPTM): Promise<KnownPTM> {
    // Check if this PTM already exists (same protein, site, and modification)
    const existing = Array.from(this.knownPtms.values()).find(
      (ptm) => ptm.uniprotId === insertKnownPtm.uniprotId && 
                ptm.siteLocation === insertKnownPtm.siteLocation &&
                ptm.modificationType === insertKnownPtm.modificationType
    );
    
    if (existing) {
      // Update existing PTM with new information
      existing.organism = insertKnownPtm.organism ?? existing.organism;
      existing.pubmedIds = insertKnownPtm.pubmedIds ?? existing.pubmedIds;
      existing.isDirectSite = insertKnownPtm.isDirectSite ?? existing.isDirectSite;
      existing.notes = insertKnownPtm.notes ?? existing.notes;
      existing.source = insertKnownPtm.source ?? existing.source;
      this.knownPtms.set(existing.id, existing);
      return existing;
    } else {
      return this.createKnownPTM(insertKnownPtm);
    }
  }

  async getKnownPTMsByProtein(uniprotId: string): Promise<KnownPTM[]> {
    return Array.from(this.knownPtms.values()).filter(
      (ptm) => ptm.uniprotId === uniprotId,
    );
  }

  // Analysis session operations
  async createAnalysisSession(insertSession: InsertAnalysisSession): Promise<AnalysisSession> {
    const id = randomUUID();
    const session: AnalysisSession = { 
      ...insertSession, 
      id,
      uploadedAt: new Date().toISOString(),
      fileName: insertSession.fileName ?? null,
      totalProteins: insertSession.totalProteins ?? 0, // Use schema default
      totalPtmSites: insertSession.totalPtmSites ?? 0, // Use schema default
      status: insertSession.status ?? "processing", // Use schema default
    };
    this.analysisSessions.set(id, session);
    return session;
  }

  async getAnalysisSession(id: string): Promise<AnalysisSession | undefined> {
    return this.analysisSessions.get(id);
  }

  async updateAnalysisSessionStats(id: string, totalProteins: number, totalPtmSites: number): Promise<void> {
    const session = this.analysisSessions.get(id);
    if (session) {
      session.totalProteins = totalProteins;
      session.totalPtmSites = totalPtmSites;
      this.analysisSessions.set(id, session);
    }
  }

  async updateAnalysisSessionStatus(id: string, status: string): Promise<void> {
    const session = this.analysisSessions.get(id);
    if (session) {
      session.status = status;
      this.analysisSessions.set(id, session);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Delete the session itself
    this.analysisSessions.delete(sessionId);
    // Delete all associated data
    await this.deletePTMSitesBySession(sessionId);
    await this.deleteProteinsBySession(sessionId);
  }

  // Combined data for visualization
  async getProteinWithPTMs(uniprotId: string, sessionId?: string): Promise<ProteinWithPTMs | undefined> {
    const protein = await this.getProtein(uniprotId, sessionId);
    if (!protein) return undefined;

    const experimentalPtms = await this.getPTMSitesByProtein(uniprotId, sessionId);
    const knownPtms = await this.getKnownPTMsByProtein(uniprotId);

    return {
      protein: {
        uniprotId: protein.uniprotId,
        proteinName: protein.proteinName || undefined,
        geneName: protein.geneName || undefined,
        sequence: protein.sequence || undefined,
        sequenceLength: protein.sequenceLength || undefined,
      },
      experimentalPtms: experimentalPtms.map(ptm => ({
        siteLocation: ptm.siteLocation,
        siteAA: ptm.siteAA,
        modificationType: ptm.modificationType,
        siteProbability: ptm.siteProbability,
        quantity: ptm.quantity || undefined,
        flankingRegion: ptm.flankingRegion || undefined,
      })),
      knownPtms: knownPtms.map(ptm => ({
        siteLocation: ptm.siteLocation,
        modificationType: ptm.modificationType,
        pubmedIds: ptm.pubmedIds || undefined,
        isDirectSite: ptm.isDirectSite || undefined,
      })),
    };
  }

  async getProteinsInSession(sessionId: string): Promise<ProteinWithPTMs[]> {
    const proteins = await this.getProteinsBySession(sessionId);
    const result: ProteinWithPTMs[] = [];
    
    for (const protein of proteins) {
      const proteinWithPtms = await this.getProteinWithPTMs(protein.uniprotId, sessionId);
      if (proteinWithPtms) result.push(proteinWithPtms);
    }
    
    return result;
  }

  // Search and filtering
  async searchProteinsByName(query: string, sessionId?: string): Promise<Protein[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.proteins.values()).filter(protein => {
      const matchesQuery = protein.proteinName?.toLowerCase().includes(lowerQuery) ||
        protein.geneName?.toLowerCase().includes(lowerQuery) ||
        protein.uniprotId.toLowerCase().includes(lowerQuery);
      
      return matchesQuery && (!sessionId || protein.sessionId === sessionId);
    });
  }

  async getPTMTypesSummary(sessionId?: string): Promise<Array<{ modificationType: string; count: number }>> {
    let ptms = Array.from(this.ptmSites.values());
    
    if (sessionId) {
      ptms = ptms.filter(ptm => ptm.sessionId === sessionId);
    }
    
    const typeCounts = new Map<string, number>();
    for (const ptm of ptms) {
      const current = typeCounts.get(ptm.modificationType) || 0;
      typeCounts.set(ptm.modificationType, current + 1);
    }
    
    return Array.from(typeCounts.entries()).map(([modificationType, count]) => ({
      modificationType,
      count,
    }));
  }
}

export const storage = new MemStorage();
