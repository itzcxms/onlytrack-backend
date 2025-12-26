import { sql, relations } from "drizzle-orm";
import {
  mysqlTable,
  text,
  varchar,
  int,
  timestamp,
  boolean,
  float,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==========================================
// TABLES D'AUTHENTIFICATION ET MULTI-TENANT
// ==========================================

// Agences (Workspaces) - Chaque agence a ses propres données isolées
export const agences = mysqlTable("agences", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  nom: varchar("nom", { length: 255 }).notNull(),
  plan: varchar("plan", { length: 20 })
    .$default(() => "free")
    .notNull(), // "free" ou "premium"
  demo: boolean("demo")
    .$default(() => false)
    .notNull(), // true si agence de démonstration
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
  dateExpirationAbonnement: timestamp("date_expiration_abonnement"),
  statutAbonnement: varchar("statut_abonnement", { length: 20 }).$default(
    () => "actif",
  ), // "actif", "annule", "expire"
  idAbonnementStripe: varchar("id_abonnement_stripe", { length: 255 }),
});

// Utilisateurs - Comptes avec authentification (owners, members, models)
export const utilisateurs = mysqlTable("utilisateurs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  prenom: varchar("prenom", { length: 100 }).notNull(),
  nom: varchar("nom", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  motDePasseHash: varchar("mot_de_passe_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 })
    .$default(() => "member")
    .notNull(), // "owner", "member", "model"
  agenceId: varchar("agence_id", { length: 36 }).notNull(),
  emailVerifie: boolean("email_verifie")
    .$default(() => false)
    .notNull(),
  tokenVerification: varchar("token_verification", { length: 255 }),
  tokenResetPassword: varchar("token_reset_password", { length: 255 }),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
  derniereConnexion: timestamp("derniere_connexion"),
  actif: boolean("actif")
    .$default(() => true)
    .notNull(),
});

// Invitations - Gestion des invitations d'équipe par email
export const invitations = mysqlTable("invitations", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }).notNull(),
  agenceId: varchar("agence_id", { length: 36 }).notNull(),
  role: varchar("role", { length: 20 })
    .$default(() => "member")
    .notNull(), // "member" ou "model"
  token: varchar("token", { length: 255 }).notNull().unique(),
  statut: varchar("statut", { length: 20 })
    .$default(() => "en_attente")
    .notNull(), // "en_attente", "accepte", "expire"
  invitePar: varchar("invite_par", { length: 36 }).notNull(),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
  dateExpiration: timestamp("date_expiration").notNull(),
});

// Sessions - Gestion des sessions JWT
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  utilisateurId: varchar("utilisateur_id", { length: 36 }).notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
  dateExpiration: timestamp("date_expiration").notNull(),
  adresseIp: varchar("adresse_ip", { length: 45 }),
  userAgent: text("user_agent"),
});

// Super-Admins - Comptes d'administration séparés
export const superAdmins = mysqlTable("super_admins", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }).notNull().unique(),
  motDePasse: varchar("mot_de_passe", { length: 255 }).notNull(),
  nom: varchar("nom", { length: 255 }).notNull(),
  prenom: varchar("prenom", { length: 255 }).notNull(),
  actif: boolean("actif")
    .$default(() => true)
    .notNull(),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
  derniereConnexion: timestamp("derniere_connexion"),
});

// Accès Temporaires - Liens d'accès pour clients/influenceurs
export const accesTemporaires = mysqlTable("acces_temporaires", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(),
  nom: varchar("nom", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
  dateExpiration: timestamp("date_expiration"),
  actif: boolean("actif")
    .$default(() => true)
    .notNull(),
  creePar: varchar("cree_par", { length: 36 }).notNull(),
});

// ==========================================
// TABLES PRINCIPALES
// ==========================================

// Modèles / Créateurs de contenu
export const modeles = mysqlTable("modeles", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  nom: text("nom").notNull(),
  plateforme: text("plateforme").notNull(), // "tiktok", "instagram"
  nomUtilisateur: text("nom_utilisateur"),
  email: text("email"),
  urlInstagram: text("url_instagram"),
  urlTiktok: text("url_tiktok"),
  autresUrlsSociales: text("autres_urls_sociales"),
  notes: text("notes"),
  dateOnboarding: timestamp("date_onboarding"),
  abonnes: int("abonnes").$default(() => 0),
  engagement: float("engagement").$default(() => 0),
  porteeMoyenne: int("portee_moyenne").$default(() => 0),
  revenus: float("revenus").$default(() => 0),
  urlPhoto: text("url_photo"),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Étapes d'onboarding pour les modèles
export const etapesOnboarding = mysqlTable("etapes_onboarding", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  modeleId: varchar("modele_id", { length: 36 }).notNull(),
  nomEtape: text("nom_etape").notNull(),
  description: text("description"),
  terminee: boolean("terminee")
    .$default(() => false)
    .notNull(),
  dateEcheance: timestamp("date_echeance"),
  ordre: int("ordre")
    .notNull()
    .$default(() => 0),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Affiliés / Liens d'affiliation
export const affilies = mysqlTable("affilies", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  nom: text("nom").notNull(),
  lien: text("lien").notNull(),
  commission: float("commission")
    .$default(() => 0)
    .notNull(),
  clics: int("clics")
    .$default(() => 0)
    .notNull(),
  conversions: int("conversions")
    .$default(() => 0)
    .notNull(),
  revenus: float("revenus")
    .$default(() => 0)
    .notNull(),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Analytics - Données analytiques
export const analytics = mysqlTable("analytics", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  modeleId: varchar("modele_id", { length: 36 }),
  plateforme: text("plateforme").notNull(),
  metrique: text("metrique").notNull(),
  valeur: float("valeur").notNull(),
  date: timestamp("date").notNull(),
});

// Posts Analytics - Statistiques des posts
export const postsAnalytics = mysqlTable("posts_analytics", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  modeleId: varchar("modele_id", { length: 36 }).notNull(),
  urlPost: text("url_post").notNull(),
  urlMiniature: text("url_miniature"),
  likes: int("likes").$default(() => 0),
  commentaires: int("commentaires").$default(() => 0),
  vues: int("vues").$default(() => 0),
  engagement: float("engagement").$default(() => 0),
  datePublication: timestamp("date_publication").notNull(),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Transactions financières
export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  modeleId: varchar("modele_id", { length: 36 }),
  montant: float("montant").notNull(),
  abonnements: int("abonnements").$default(() => 0),
  payee: boolean("payee")
    .$default(() => false)
    .notNull(),
  date: timestamp("date")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Candidats DM - Recrutement
export const candidatsDm = mysqlTable("candidats_dm", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  nom: text("nom").notNull(),
  plateforme: text("plateforme").notNull(),
  abonnes: text("abonnes"),
  statut: text("statut")
    .notNull()
    .$default(() => "envoye"), // "envoye", "repondu", "accepte", "refuse"
  script: text("script"),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Scripts DM - Templates de messages
export const scriptsDm = mysqlTable("scripts_dm", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  nom: text("nom").notNull(),
  contenu: text("contenu").notNull(),
  tauxConversion: float("taux_conversion"),
  nombreUtilisations: int("nombre_utilisations")
    .$default(() => 0)
    .notNull(),
});

// Inspirations - Contenu sauvegardé
export const inspirations = mysqlTable("inspirations", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  modeleId: varchar("modele_id", { length: 36 }),
  plateforme: text("plateforme").notNull(),
  url: text("url").notNull(),
  notes: text("notes"),
  vues: int("vues").$default(() => 0),
  likes: int("likes").$default(() => 0),
  commentaires: int("commentaires").$default(() => 0),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
});

// SOPs - Procédures opérationnelles
export const procedures = mysqlTable("procedures", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  titre: text("titre").notNull(),
  categorie: text("categorie").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Tâches / Todos
export const taches = mysqlTable("taches", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  texte: text("texte").notNull(),
  terminee: boolean("terminee")
    .$default(() => false)
    .notNull(),
  assigneA: text("assigne_a"),
  modeleId: varchar("modele_id", { length: 36 }),
  dateCreation: timestamp("date_creation")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Équipe / Team Members
export const equipe = mysqlTable("equipe", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agenceId: varchar("agence_id", { length: 36 }).notNull(), // Séparation multi-tenant
  nom: text("nom").notNull(),
  role: text("role").notNull(),
  initiales: text("initiales").notNull(),
  urlPhoto: text("url_photo"),
  managerId: varchar("manager_id", { length: 36 }),
  revenus: float("revenus"),
  pourcentage: float("pourcentage").$default(() => 0),
  taches: int("taches")
    .$default(() => 0)
    .notNull(),
});

// ==========================================
// RELATIONS
// ==========================================

// Relations des agences
export const agencesRelations = relations(agences, ({ many }) => ({
  utilisateurs: many(utilisateurs),
  modeles: many(modeles),
  invitations: many(invitations),
}));

// Relations des utilisateurs
export const utilisateursRelations = relations(
  utilisateurs,
  ({ one, many }) => ({
    agence: one(agences, {
      fields: [utilisateurs.agenceId],
      references: [agences.id],
    }),
    sessions: many(sessions),
    invitationsEnvoyees: many(invitations),
  }),
);

// Relations des invitations
export const invitationsRelations = relations(invitations, ({ one }) => ({
  agence: one(agences, {
    fields: [invitations.agenceId],
    references: [agences.id],
  }),
  inviteur: one(utilisateurs, {
    fields: [invitations.invitePar],
    references: [utilisateurs.id],
  }),
}));

// Relations des sessions
export const sessionsRelations = relations(sessions, ({ one }) => ({
  utilisateur: one(utilisateurs, {
    fields: [sessions.utilisateurId],
    references: [utilisateurs.id],
  }),
}));

// Relations des modèles
export const modelesRelations = relations(modeles, ({ one, many }) => ({
  agence: one(agences, {
    fields: [modeles.agenceId],
    references: [agences.id],
  }),
  inspirations: many(inspirations),
  taches: many(taches),
  etapesOnboarding: many(etapesOnboarding),
  postsAnalytics: many(postsAnalytics),
  analytics: many(analytics),
}));

export const etapesOnboardingRelations = relations(
  etapesOnboarding,
  ({ one }) => ({
    agence: one(agences, {
      fields: [etapesOnboarding.agenceId],
      references: [agences.id],
    }),
    modele: one(modeles, {
      fields: [etapesOnboarding.modeleId],
      references: [modeles.id],
    }),
  }),
);

// ==========================================
// SCHÉMAS DE VALIDATION
// ==========================================

// Schémas d'authentification
export const insererAgenceSchema = createInsertSchema(agences).omit({
  id: true,
  dateCreation: true,
});
export const insererUtilisateurSchema = createInsertSchema(utilisateurs).omit({
  id: true,
  dateCreation: true,
  derniereConnexion: true,
});
export const insererInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  dateCreation: true,
});
export const insererSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  dateCreation: true,
});

// Schémas existants
export const insererModeleSchema = createInsertSchema(modeles).omit({
  id: true,
  dateCreation: true,
});
export const insererEtapeOnboardingSchema = createInsertSchema(
  etapesOnboarding,
).omit({ id: true, dateCreation: true });
export const insererAffilieSchema = createInsertSchema(affilies).omit({
  id: true,
  dateCreation: true,
});
export const insererTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  date: true,
});
export const insererCandidatDmSchema = createInsertSchema(candidatsDm).omit({
  id: true,
  dateCreation: true,
});
export const insererScriptDmSchema = createInsertSchema(scriptsDm).omit({
  id: true,
});
export const insererInspirationSchema = createInsertSchema(inspirations).omit({
  id: true,
  dateCreation: true,
});
export const insererProcedureSchema = createInsertSchema(procedures).omit({
  id: true,
  dateCreation: true,
});
export const insererTacheSchema = createInsertSchema(taches).omit({
  id: true,
  dateCreation: true,
});
export const insererMembreEquipeSchema = createInsertSchema(equipe).omit({
  id: true,
});
export const insererAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
});
export const insererPostAnalyticsSchema = createInsertSchema(
  postsAnalytics,
).omit({ id: true, dateCreation: true });

// ==========================================
// TYPES TYPESCRIPT
// ==========================================

// Types d'authentification
export type Agence = typeof agences.$inferSelect;
export type Utilisateur = typeof utilisateurs.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SuperAdmin = typeof superAdmins.$inferSelect;
export type AccesTemporaire = typeof accesTemporaires.$inferSelect;

// Types existants
export type Modele = typeof modeles.$inferSelect;
export type EtapeOnboarding = typeof etapesOnboarding.$inferSelect;
export type Affilie = typeof affilies.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type CandidatDm = typeof candidatsDm.$inferSelect;
export type ScriptDm = typeof scriptsDm.$inferSelect;
export type Inspiration = typeof inspirations.$inferSelect;
export type Procedure = typeof procedures.$inferSelect;
export type Tache = typeof taches.$inferSelect;
export type MembreEquipe = typeof equipe.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;
export type PostAnalytics = typeof postsAnalytics.$inferSelect;

// Types d'insertion pour l'authentification
export type InsererAgence = z.infer<typeof insererAgenceSchema>;
export type InsererUtilisateur = z.infer<typeof insererUtilisateurSchema>;
export type InsererInvitation = z.infer<typeof insererInvitationSchema>;
export type InsererSession = z.infer<typeof insererSessionSchema>;

// Types d'insertion existants
export type InsererModele = z.infer<typeof insererModeleSchema>;
export type InsererEtapeOnboarding = z.infer<
  typeof insererEtapeOnboardingSchema
>;
export type InsererAffilie = z.infer<typeof insererAffilieSchema>;
export type InsererTransaction = z.infer<typeof insererTransactionSchema>;
export type InsererCandidatDm = z.infer<typeof insererCandidatDmSchema>;
export type InsererScriptDm = z.infer<typeof insererScriptDmSchema>;
export type InsererInspiration = z.infer<typeof insererInspirationSchema>;
export type InsererProcedure = z.infer<typeof insererProcedureSchema>;
export type InsererTache = z.infer<typeof insererTacheSchema>;
export type InsererMembreEquipe = z.infer<typeof insererMembreEquipeSchema>;
export type InsererAnalytics = z.infer<typeof insererAnalyticsSchema>;
export type InsererPostAnalytics = z.infer<typeof insererPostAnalyticsSchema>;
