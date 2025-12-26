// ==========================================
// ROUTES API ANALYTICS
// Gestion des données analytiques générales
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { analytics } from "../schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/analytics
 * 
 * Récupère les données analytiques avec filtres optionnels.
 * Supporte les filtres: modelId, plateforme, dateDebut, dateFin
 * 
 * @route GET /api/analytics
 * @access Private - Tous les utilisateurs authentifiés
 * @query {string} modelId - Filtre par modèle (optionnel)
 * @query {string} plateforme - Filtre par plateforme (optionnel)
 * @query {string} dateDebut - Date de début (optionnel)
 * @query {string} dateFin - Date de fin (optionnel)
 * @returns {Array} Liste des données analytiques
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modelId, plateforme, dateDebut, dateFin } = req.query;

    let query = db
      .select()
      .from(analytics)
      .where(eq(analytics.agenceId, agenceId))
      .$dynamic();

    // Filtres optionnels
    if (modelId && typeof modelId === "string") {
      query = query.where(eq(analytics.modeleId, modelId));
    }
    if (plateforme && typeof plateforme === "string") {
      query = query.where(eq(analytics.plateforme, plateforme));
    }
    if (dateDebut && typeof dateDebut === "string") {
      query = query.where(gte(analytics.date, new Date(dateDebut)));
    }
    if (dateFin && typeof dateFin === "string") {
      query = query.where(lte(analytics.date, new Date(dateFin)));
    }

    const analyticsList = await query.orderBy(analytics.date);

    res.json(analyticsList);
  } catch (error) {
    console.error("Erreur liste analytics:", error);
    res.status(500).json({ error: "Erreur lors du chargement des analytics" });
  }
});

// ====================================================================================================
/**
 * POST /api/analytics
 * 
 * Ajoute une nouvelle entrée analytique.
 * 
 * @route POST /api/analytics
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données analytiques (modeleId, plateforme, metrique, valeur, date)
 * @returns {Object} Entrée créée
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modeleId, plateforme, metrique, valeur, date } = req.body;

    if (!plateforme || !metrique || valeur === undefined || !date) {
      return res.status(400).json({ 
        error: "Plateforme, metrique, valeur et date sont requis" 
      });
    }

    const analyticId = crypto.randomUUID();
    await db.insert(analytics).values({
      id: analyticId,
      agenceId,
      modeleId: modeleId || null,
      plateforme,
      metrique,
      valeur,
      date: new Date(date),
    });

    const [created] = await db
      .select()
      .from(analytics)
      .where(eq(analytics.id, analyticId))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création analytics:", error);
    res.status(500).json({ error: "Erreur lors de la création de l'entrée analytique" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/analytics/:id
 * 
 * Supprime une entrée analytique.
 * Vérifie que l'entrée appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/analytics/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de l'entrée analytique
 * @returns {Object} Message de confirmation
 * @throws {404} Entrée non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que l'entrée existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(analytics)
      .where(eq(analytics.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Entrée analytique non trouvée" });
    }

    // Suppression
    await db
      .delete(analytics)
      .where(eq(analytics.id, id));

    res.json({ message: "Entrée analytique supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression analytics:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'entrée analytique" });
  }
});

export default router;
