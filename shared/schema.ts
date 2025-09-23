import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PTM Site data from experimental TSV files
export const ptmSites = pgTable("ptm_sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(), // References analysisSessions.id
  uniprotId: text("uniprot_id").notNull(), // UniProt ID (PTM.ProteinId)
  siteLocation: integer("site_location").notNull(), // Position on protein
  siteAA: text("site_aa").notNull(), // Amino acid (C, M, S, T, Y, etc.)
  modificationType: text("modification_type").notNull(), // Carbamidomethyl (C), Oxidation (M), etc.
  siteProbability: real("site_probability").notNull(), // Confidence score
  quantity: real("quantity"), // Intensity measurement
  flankingRegion: text("flanking_region"), // Peptide sequence around modification
  multiplicity: integer("multiplicity").default(1), // Number of modifications
  experimentName: text("experiment_name"), // Source experiment/file
  condition: text("condition"), // Experimental condition
});

// Protein sequences and metadata from UniProt
export const proteins = pgTable("proteins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(), // References analysisSessions.id
  uniprotId: text("uniprot_id").notNull(), // Primary UniProt accession
  proteinName: text("protein_name"), // Human-readable name
  geneName: text("gene_name"), // Gene symbol
  organism: text("organism").default("Homo sapiens"),
  sequence: text("sequence"), // Full amino acid sequence
  sequenceLength: integer("sequence_length"), // Length of protein
  description: text("description"), // Protein function/description
  lastUpdated: text("last_updated"), // When fetched from UniProt
});

// Known PTM annotations from PhosphoSitePlus
export const knownPtms = pgTable("known_ptms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uniprotId: text("uniprot_id").notNull(), // UniProt ID
  siteLocation: integer("site_location").notNull(), // Position on protein
  modificationType: text("modification_type").notNull(), // Type of PTM
  organism: text("organism").default("human"),
  pubmedIds: text("pubmed_ids"), // Literature references (comma-separated)
  isDirectSite: boolean("is_direct_site").default(false), // Direct vs inferred
  notes: text("notes"), // Additional annotation info
  source: text("source").default("PhosphoSitePlus"), // Data source
});

// Analysis sessions for tracking uploaded experiments
export const analysisSessions = pgTable("analysis_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // User-defined session name
  fileName: text("file_name"), // Original uploaded file name
  uploadedAt: text("uploaded_at").default(sql`CURRENT_TIMESTAMP`),
  totalProteins: integer("total_proteins").default(0),
  totalPtmSites: integer("total_ptm_sites").default(0),
  status: text("status").default("processing"), // processing, completed, failed
});

// Zod schemas for validation
export const insertPtmSiteSchema = createInsertSchema(ptmSites).omit({
  id: true,
});

export const insertProteinSchema = createInsertSchema(proteins).omit({
  id: true,
});

export const insertKnownPtmSchema = createInsertSchema(knownPtms).omit({
  id: true,
});

export const insertAnalysisSessionSchema = createInsertSchema(analysisSessions).omit({
  id: true,
  uploadedAt: true,
});

// TypeScript types
export type PTMSite = typeof ptmSites.$inferSelect;
export type InsertPTMSite = z.infer<typeof insertPtmSiteSchema>;

export type Protein = typeof proteins.$inferSelect;
export type InsertProtein = z.infer<typeof insertProteinSchema>;

export type KnownPTM = typeof knownPtms.$inferSelect;
export type InsertKnownPTM = z.infer<typeof insertKnownPtmSchema>;

export type AnalysisSession = typeof analysisSessions.$inferSelect;
export type InsertAnalysisSession = z.infer<typeof insertAnalysisSessionSchema>;

// Combined data types for visualization
export const ProteinWithPTMs = z.object({
  protein: z.object({
    uniprotId: z.string(),
    proteinName: z.string().optional(),
    geneName: z.string().optional(),
    sequence: z.string().optional(),
    sequenceLength: z.number().optional(),
  }),
  experimentalPtms: z.array(z.object({
    siteLocation: z.number(),
    siteAA: z.string(),
    modificationType: z.string(),
    siteProbability: z.number(),
    quantity: z.number().optional(),
    flankingRegion: z.string().optional(),
  })),
  knownPtms: z.array(z.object({
    siteLocation: z.number(),
    modificationType: z.string(),
    pubmedIds: z.string().optional(),
    isDirectSite: z.boolean().optional(),
  })),
});

export type ProteinWithPTMs = z.infer<typeof ProteinWithPTMs>;

// PTM color mapping for visualization
export const PTM_COLORS = {
  "Carbamidomethyl (C)": "#6366f1", // Indigo
  "Oxidation (M)": "#f59e0b", // Amber
  "Phosphorylation": "#ef4444", // Red
  "Acetylation": "#10b981", // Emerald
  "Methylation": "#8b5cf6", // Violet
  "Ubiquitination": "#06b6d4", // Cyan
  "Deamidation": "#f97316", // Orange
  "Nitrosylation": "#ec4899", // Pink
  "Other": "#6b7280", // Gray
} as const;
