// ==========================================
// ROUTES API CANDIDATS DM
// Gestion des candidats pour le recrutement par DM
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { candidatsDm } from "../schema";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/dm-candidates
 * 
 * Récupère la liste des candidats DM avec filtres optionnels.
 * Supporte les filtres: statut, plateforme
 * 
 * @route GET /api/dm-candidates
 * @access Private - Tous les utilisateurs authentifiés
 * @query {string} statut - Filtre par statut (optionnel)
 * @query {string} plateforme - Filtre par plateforme (optionnel)
 * @returns {Array} Liste des candidats DM
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { statut, plateforme } = req.query;

    let query = db
      .select()
      .from(candidatsDm)
      .where(eq(candidatsDm.agenceId, agenceId))
      .$dynamic();

    // Filtres optionnels
    if (statut && typeof statut === "string") {
      query = query.where(eq(candidatsDm.statut, statut));
    }
    if (plateforme && typeof plateforme === "string") {
      query = query.where(eq(candidatsDm.plateforme, plateforme));
    }

    const candidatesList = await query.orderBy(candidatsDm.dateCreation);

    res.json(candidatesList);
  } catch (error) {
    console.error("Erreur liste candidats DM:", error);
    res.status(500).json({ error: "Erreur lors du chargement des candidats DM" });
  }
});

// ====================================================================================================
/**
 * POST /api/dm-candidates
 * 
 * Ajoute un nouveau candidat DM.
 * 
 * @route POST /api/dm-candidates
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données du candidat (nom, plateforme, abonnes, statut, script)
 * @returns {Object} Candidat créé
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { nom, plateforme, abonnes, statut, script } = req.body;

    if (!nom || !plateforme) {
      return res.status(400).json({ error: "Nom et plateforme sont requis" });
    }

    const candidateId = crypto.randomUUID();
    await db.insert(candidatsDm).values({
      id: candidateId,
      agenceId,
      nom,
      plateforme,
      abonnes: abonnes || null,
      statut: statut || "envoye",
      script: script || null,
    });

    const [created] = await db
      .select()
      .from(candidatsDm)
      .where(eq(candidatsDm.id, candidateId))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création candidat DM:", error);
    res.status(500).json({ error: "Erreur lors de la création du candidat DM" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/dm-candidates/:id
 * 
 * Met à jour un candidat DM existant (notamment le statut).
 * Vérifie que le candidat appartient bien à l'agence de l'utilisateur.
 * 
 * @route PATCH /api/dm-candidates/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID du candidat
 * @body {Object} data - Données à mettre à jour
 * @returns {Object} Candidat mis à jour
 * @throws {404} Candidat non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que le candidat existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(candidatsDm)
      .where(eq(candidatsDm.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Candidat DM non trouvé" });
    }

    // Mise à jour
    await db
      .update(candidatsDm)
      .set(updates)
      .where(eq(candidatsDm.id, id));

    const [updated] = await db
      .select()
      .from(candidatsDm)
      .where(eq(candidatsDm.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour candidat DM:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du candidat DM" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/dm-candidates/:id
 * 
 * Supprime un candidat DM.
 * Vérifie que le candidat appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/dm-candidates/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID du candidat
 * @returns {Object} Message de confirmation
 * @throws {404} Candidat non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que le candidat existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(candidatsDm)
      .where(eq(candidatsDm.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Candidat DM non trouvé" });
    }

    // Suppression
    await db
      .delete(candidatsDm)
      .where(eq(candidatsDm.id, id));

    res.json({ message: "Candidat DM supprimé avec succès" });
  } catch (error) {
    console.error("Erreur suppression candidat DM:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du candidat DM" });
  }
});

export default router;
