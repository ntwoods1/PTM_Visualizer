import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Papa from "papaparse";
import axios from "axios";
import { storage } from "./storage";
import { 
  insertPtmSiteSchema, 
  insertProteinSchema, 
  insertKnownPtmSchema,
  insertAnalysisSessionSchema,
  type ProteinWithPTMs 
} from "@shared/schema";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// UniProt API base URL
const UNIPROT_BASE_URL = "https://rest.uniprot.org";

// PhosphoSitePlus API configuration (note: requires registration and API key)
const PHOSPHOSITEPLUS_BASE_URL = "https://www.phosphosite.org/api";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ====== SESSION MANAGEMENT ======
  
  // Create new analysis session
  app.post("/api/sessions", async (req, res) => {
    try {
      const sessionData = insertAnalysisSessionSchema.parse(req.body);
      const session = await storage.createAnalysisSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(400).json({ error: "Invalid session data" });
    }
  });

  // Get session details
  app.get("/api/sessions/:sessionId", async (req, res) => {
    try {
      const session = await storage.getAnalysisSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete session and all associated data
  app.delete("/api/sessions/:sessionId", async (req, res) => {
    try {
      await storage.deleteSession(req.params.sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ====== FILE UPLOAD AND PROCESSING ======
  
  // Upload and process PTM TSV file
  app.post("/api/sessions/:sessionId/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const sessionId = req.params.sessionId;
      const fileContent = req.file.buffer.toString('utf-8');
      
      // Update session with file info
      const session = await storage.getAnalysisSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      await storage.updateAnalysisSessionStatus(sessionId, "processing");

      // Parse TSV file with tab delimiter
      const parseResult = Papa.parse(fileContent, {
        header: true,
        delimiter: "\t",
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim()
      });

      // Check for required columns
      const requiredColumns = ["PTM.ProteinId", "PTM.SiteLocation", "PTM.SiteAA", "PTM.ModificationTitle"];
      const headers = parseResult.meta?.fields || [];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        await storage.updateAnalysisSessionStatus(sessionId, "failed");
        return res.status(400).json({ 
          error: "Missing required columns in TSV file", 
          missingColumns 
        });
      }

      if (parseResult.errors.length > 0) {
        console.error("CSV parsing errors:", parseResult.errors);
        await storage.updateAnalysisSessionStatus(sessionId, "failed");
        return res.status(400).json({ error: "Failed to parse TSV file", details: parseResult.errors });
      }

      const ptmData = parseResult.data as any[];
      const proteinIds = new Set<string>();
      let processedSites = 0;
      const validationErrors: Array<{ row: number; error: string }> = [];

      // Process each PTM site
      for (let i = 0; i < ptmData.length; i++) {
        const row = ptmData[i];
        try {
          const uniprotId = row["PTM.ProteinId"]?.trim();
          if (!uniprotId) {
            validationErrors.push({ row: i + 1, error: "Missing PTM.ProteinId" });
            continue;
          }

          proteinIds.add(uniprotId);

          // Create PTM site record
          const ptmSite = {
            sessionId,
            uniprotId,
            siteLocation: parseInt(row["PTM.SiteLocation"]),
            siteAA: row["PTM.SiteAA"]?.trim() || "",
            modificationType: row["PTM.ModificationTitle"]?.trim() || "",
            siteProbability: parseFloat(row["PTM.SiteProbability"]) || 0,
            quantity: row["PTM.Quantity"] ? parseFloat(row["PTM.Quantity"]) : null,
            flankingRegion: row["PTM.FlankingRegion"]?.trim() || null,
            multiplicity: row["PTM.Multiplicity"] ? parseInt(row["PTM.Multiplicity"]) : 1,
            experimentName: row["R.FileName"]?.trim() || null,
            condition: row["R.Condition"]?.trim() || null,
          };

          const validatedPtm = insertPtmSiteSchema.parse(ptmSite);
          await storage.createPTMSite(validatedPtm);
          processedSites++;

          // Create or update protein record if not exists
          const existingProtein = await storage.getProtein(uniprotId, sessionId);
          if (!existingProtein) {
            const proteinData = {
              sessionId,
              uniprotId,
              proteinName: row["PG.ProteinNames"]?.split(";")[0]?.trim() || null,
              geneName: row["PG.Genes"]?.split(";")[0]?.trim() || null,
              organism: row["PG.Organisms"]?.trim() || "Homo sapiens",
              sequence: null,
              sequenceLength: null,
              description: null,
              lastUpdated: null,
            };

            const validatedProtein = insertProteinSchema.parse(proteinData);
            await storage.createProtein(validatedProtein);
          }
        } catch (error) {
          console.error("Error processing PTM site:", error, row);
          validationErrors.push({ row: i + 1, error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Update session statistics
      await storage.updateAnalysisSessionStats(sessionId, proteinIds.size, processedSites);
      await storage.updateAnalysisSessionStatus(sessionId, "completed");

      res.json({
        success: true,
        processed: {
          proteins: proteinIds.size,
          ptmSites: processedSites
        },
        validationErrors: validationErrors.length > 0 ? validationErrors.slice(0, 10) : undefined // Limit to first 10 errors
      });

    } catch (error) {
      console.error("Error processing file upload:", error);
      await storage.updateAnalysisSessionStatus(req.params.sessionId, "failed");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ====== UNIPROT INTEGRATION ======
  
  // Fetch protein sequence from UniProt
  app.post("/api/proteins/:uniprotId/fetch-sequence", async (req, res) => {
    try {
      const { uniprotId } = req.params;
      
      // Validate request body
      const bodySchema = z.object({ sessionId: z.string().min(1) });
      const { sessionId } = bodySchema.parse(req.body);

      // Check if protein exists in session
      const existingProtein = await storage.getProtein(uniprotId, sessionId);
      if (!existingProtein) {
        return res.status(404).json({ error: "Protein not found in session" });
      }

      // Fetch from UniProt
      const uniprotUrl = `${UNIPROT_BASE_URL}/uniprotkb/${uniprotId}.fasta`;
      const response = await axios.get(uniprotUrl, {
        timeout: 10000,
        headers: { 'Accept': 'text/plain' }
      });

      // Parse FASTA format
      const fastaLines = response.data.split('\n');
      const sequenceLines = fastaLines.slice(1).filter((line: string) => !line.startsWith('>'));
      const sequence = sequenceLines.join('').replace(/\s/g, '');

      if (sequence) {
        await storage.updateProteinSequence(uniprotId, sessionId, sequence, sequence.length);
        
        // Also fetch additional metadata
        try {
          const metadataUrl = `${UNIPROT_BASE_URL}/uniprotkb/${uniprotId}.json`;
          const metadataResponse = await axios.get(metadataUrl, { timeout: 10000 });
          const metadata = metadataResponse.data;
          
          // Extract additional info (this would need to be implemented based on UniProt JSON structure)
          // For now, just return the sequence
        } catch (metaError) {
          console.warn("Failed to fetch metadata for", uniprotId, metaError);
        }
      }

      res.json({
        success: true,
        uniprotId,
        sequence,
        length: sequence.length
      });

    } catch (error) {
      console.error("Error fetching UniProt sequence:", error);
      res.status(500).json({ error: "Failed to fetch protein sequence from UniProt" });
    }
  });

  // ====== PHOSPHOSITEPLUS INTEGRATION ======
  
  // Fetch known PTMs from PhosphoSitePlus
  app.post("/api/proteins/:uniprotId/fetch-known-ptms", async (req, res) => {
    try {
      const { uniprotId } = req.params;
      
      // Check if PhosphoSitePlus API key is configured
      const apiKey = process.env.PHOSPHOSITEPLUS_API_KEY;
      if (!apiKey) {
        return res.status(501).json({ 
          error: "PhosphoSitePlus integration not configured",
          details: "PHOSPHOSITEPLUS_API_KEY environment variable is required"
        });
      }
      
      // TODO: Implement actual PhosphoSitePlus API integration
      // This would require:
      // 1. Proper API authentication
      // 2. Rate limiting
      // 3. Error handling for API responses
      // 4. Data transformation from PhosphoSitePlus format to our schema
      
      console.log(`Would fetch known PTMs for ${uniprotId} from PhosphoSitePlus with API key`);
      
      // Return not implemented for now
      res.status(501).json({ 
        error: "PhosphoSitePlus integration not yet implemented",
        details: "Feature is planned but not available in this version"
      });

    } catch (error) {
      console.error("Error with PhosphoSitePlus integration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ====== DATA RETRIEVAL FOR VISUALIZATION ======
  
  // Get all proteins in a session
  app.get("/api/sessions/:sessionId/proteins", async (req, res) => {
    try {
      const proteins = await storage.getProteinsInSession(req.params.sessionId);
      res.json(proteins);
    } catch (error) {
      console.error("Error fetching session proteins:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get protein with all PTMs (experimental + known)
  app.get("/api/sessions/:sessionId/proteins/:uniprotId", async (req, res) => {
    try {
      const proteinData = await storage.getProteinWithPTMs(
        req.params.uniprotId, 
        req.params.sessionId
      );
      
      if (!proteinData) {
        return res.status(404).json({ error: "Protein not found in session" });
      }
      
      res.json(proteinData);
    } catch (error) {
      console.error("Error fetching protein data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get PTM types summary for a session
  app.get("/api/sessions/:sessionId/ptm-summary", async (req, res) => {
    try {
      const summary = await storage.getPTMTypesSummary(req.params.sessionId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching PTM summary:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Search proteins by name/gene within a session
  app.get("/api/sessions/:sessionId/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const results = await storage.searchProteinsByName(query, req.params.sessionId);
      res.json(results);
    } catch (error) {
      console.error("Error searching proteins:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
