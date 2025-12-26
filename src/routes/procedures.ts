// ==========================================
// ROUTES API PROCEDURES
// SOPs (Standard Operating Procedures)
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { procedures } from "../schema";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/procedures
 * 
 * Récupère la liste des procédures avec filtres optionnels.
 * Supporte les filtres: categorie, type
 * 
 * @route GET /api/procedures
 * @access Private - Tous les utilisateurs authentifiés
 * @query {string} categorie - Filtre par catégorie (optionnel)
 * @query {string} type - Filtre par type (optionnel)
 * @returns {Array} Liste des procédures
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { categorie, type } = req.query;

    let query = db
      .select()
      .from(procedures)
      .where(eq(procedures.agenceId, agenceId))
      .$dynamic();

    // Filtres optionnels
    if (categorie && typeof categorie === "string") {
      query = query.where(eq(procedures.categorie, categorie));
    }
    if (type && typeof type === "string") {
      query = query.where(eq(procedures.type, type));
    }

    const proceduresList = await query.orderBy(procedures.dateCreation);

    res.json(proceduresList);
  } catch (error) {
    console.error("Erreur liste procédures:", error);
    res.status(500).json({ error: "Erreur lors du chargement des procédures" });
  }
});

// ====================================================================================================
/**
 * POST /api/procedures
 * 
 * Crée une nouvelle procédure.
 * 
 * @route POST /api/procedures
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données de la procédure (titre, categorie, type, url)
 * @returns {Object} Procédure créée
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { titre, categorie, type, url } = req.body;

    if (!titre || !categorie || !type) {
      return res.status(400).json({ error: "Titre, catégorie et type sont requis" });
    }

    const procedureId = crypto.randomUUID();
    await db.insert(procedures).values({
      id: procedureId,
      agenceId,
      titre,
      categorie,
      type,
      url: url || null,
    });

    const [created] = await db
      .select()
      .from(procedures)
      .where(eq(procedures.id, procedureId))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création procédure:", error);
    res.status(500).json({ error: "Erreur lors de la création de la procédure" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/procedures/:id
 * 
 * Met à jour une procédure existante.
 * Vérifie que la procédure appartient bien à l'agence de l'utilisateur.
 * 
 * @route PATCH /api/procedures/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de la procédure
 * @body {Object} data - Données à mettre à jour
 * @returns {Object} Procédure mise à jour
 * @throws {404} Procédure non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que la procédure existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(procedures)
      .where(eq(procedures.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Procédure non trouvée" });
    }

    // Mise à jour
    await db
      .update(procedures)
      .set(updates)
      .where(eq(procedures.id, id));

    const [updated] = await db
      .select()
      .from(procedures)
      .where(eq(procedures.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour procédure:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la procédure" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/procedures/:id
 * 
 * Supprime une procédure.
 * Vérifie que la procédure appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/procedures/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de la procédure
 * @returns {Object} Message de confirmation
 * @throws {404} Procédure non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que la procédure existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(procedures)
      .where(eq(procedures.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Procédure non trouvée" });
    }

    // Suppression
    await db
      .delete(procedures)
      .where(eq(procedures.id, id));

    res.json({ message: "Procédure supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression procédure:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de la procédure" });
  }
});

export default router;
