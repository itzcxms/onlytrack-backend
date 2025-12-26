// ==========================================
// ROUTES API INSPIRATIONS
// Contenu sauvegardé pour inspiration
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { inspirations } from "../schema";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/inspirations
 * 
 * Récupère la liste des inspirations avec filtres optionnels.
 * Supporte les filtres: modelId, plateforme
 * 
 * @route GET /api/inspirations
 * @access Private - Tous les utilisateurs authentifiés
 * @query {string} modelId - Filtre par modèle (optionnel)
 * @query {string} plateforme - Filtre par plateforme (optionnel)
 * @returns {Array} Liste des inspirations
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modelId, plateforme } = req.query;

    let query = db
      .select()
      .from(inspirations)
      .where(eq(inspirations.agenceId, agenceId))
      .$dynamic();

    // Filtres optionnels
    if (modelId && typeof modelId === "string") {
      query = query.where(eq(inspirations.modeleId, modelId));
    }
    if (plateforme && typeof plateforme === "string") {
      query = query.where(eq(inspirations.plateforme, plateforme));
    }

    const inspirationsList = await query.orderBy(inspirations.dateCreation);

    res.json(inspirationsList);
  } catch (error) {
    console.error("Erreur liste inspirations:", error);
    res.status(500).json({ error: "Erreur lors du chargement des inspirations" });
  }
});

// ====================================================================================================
/**
 * POST /api/inspirations
 * 
 * Sauvegarde une nouvelle inspiration.
 * 
 * @route POST /api/inspirations
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données de l'inspiration (plateforme, url, notes, vues, likes, commentaires, modeleId)
 * @returns {Object} Inspiration créée
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modeleId, plateforme, url, notes, vues, likes, commentaires } = req.body;

    if (!plateforme || !url) {
      return res.status(400).json({ error: "Plateforme et URL sont requis" });
    }

    const inspirationId = crypto.randomUUID();
    await db.insert(inspirations).values({
      id: inspirationId,
      agenceId,
      modeleId: modeleId || null,
      plateforme,
      url,
      notes: notes || null,
      vues: vues || 0,
      likes: likes || 0,
      commentaires: commentaires || 0,
    });

    const [created] = await db
      .select()
      .from(inspirations)
      .where(eq(inspirations.id, inspirationId))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création inspiration:", error);
    res.status(500).json({ error: "Erreur lors de la sauvegarde de l'inspiration" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/inspirations/:id
 * 
 * Met à jour une inspiration existante.
 * Vérifie que l'inspiration appartient bien à l'agence de l'utilisateur.
 * 
 * @route PATCH /api/inspirations/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de l'inspiration
 * @body {Object} data - Données à mettre à jour
 * @returns {Object} Inspiration mise à jour
 * @throws {404} Inspiration non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que l'inspiration existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(inspirations)
      .where(eq(inspirations.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Inspiration non trouvée" });
    }

    // Mise à jour
    await db
      .update(inspirations)
      .set(updates)
      .where(eq(inspirations.id, id));

    const [updated] = await db
      .select()
      .from(inspirations)
      .where(eq(inspirations.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour inspiration:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'inspiration" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/inspirations/:id
 * 
 * Supprime une inspiration.
 * Vérifie que l'inspiration appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/inspirations/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de l'inspiration
 * @returns {Object} Message de confirmation
 * @throws {404} Inspiration non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que l'inspiration existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(inspirations)
      .where(eq(inspirations.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Inspiration non trouvée" });
    }

    // Suppression
    await db
      .delete(inspirations)
      .where(eq(inspirations.id, id));

    res.json({ message: "Inspiration supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression inspiration:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'inspiration" });
  }
});

export default router;
