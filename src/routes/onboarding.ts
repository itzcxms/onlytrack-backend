// ==========================================
// ROUTES API ONBOARDING
// Gestion des étapes d'onboarding
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { etapesOnboarding } from "../schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/onboarding-steps
 * 
 * Récupère la liste des étapes d'onboarding pour un modèle spécifique.
 * Les étapes sont triées par ordre.
 * 
 * @route GET /api/onboarding-steps?modelId=xxx
 * @access Private - Tous les utilisateurs authentifiés
 * @query {string} modelId - ID du modèle
 * @returns {Array} Liste des étapes d'onboarding avec toutes leurs propriétés
 * @throws {400} ModelId manquant
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modelId } = req.query;

    if (!modelId || typeof modelId !== "string") {
      return res.status(400).json({ error: "ModelId est requis" });
    }

    const steps = await db
      .select()
      .from(etapesOnboarding)
      .where(
        and(
          eq(etapesOnboarding.agenceId, agenceId),
          eq(etapesOnboarding.modeleId, modelId)
        )
      )
      .orderBy(etapesOnboarding.ordre);

    res.json(steps);
  } catch (error) {
    console.error("Erreur liste étapes onboarding:", error);
    res.status(500).json({ error: "Erreur lors du chargement des étapes d'onboarding" });
  }
});

// ====================================================================================================
/**
 * POST /api/onboarding-steps
 * 
 * Crée une nouvelle étape d'onboarding pour un modèle.
 * 
 * @route POST /api/onboarding-steps
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données de l'étape
 * @returns {Object} Étape créée
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modeleId, nomEtape, description, dateEcheance, ordre, terminee } = req.body;

    if (!modeleId || !nomEtape) {
      return res.status(400).json({ error: "ModeleId et nomEtape sont requis" });
    }

    const [newStep] = await db
      .insert(etapesOnboarding)
      .values({
        agenceId,
        modeleId,
        nomEtape,
        description: description || null,
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        ordre: ordre || 0,
        terminee: terminee || false,
      })
      .$returningId();

    const [created] = await db
      .select()
      .from(etapesOnboarding)
      .where(eq(etapesOnboarding.id, newStep.id))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création étape onboarding:", error);
    res.status(500).json({ error: "Erreur lors de la création de l'étape d'onboarding" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/onboarding-steps/:id
 * 
 * Met à jour une étape d'onboarding existante.
 * Vérifie que l'étape appartient bien à l'agence de l'utilisateur.
 * 
 * @route PATCH /api/onboarding-steps/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de l'étape
 * @body {Object} data - Données à mettre à jour
 * @returns {Object} Étape mise à jour
 * @throws {404} Étape non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que l'étape existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(etapesOnboarding)
      .where(eq(etapesOnboarding.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Étape d'onboarding non trouvée" });
    }

    // Mise à jour
    await db
      .update(etapesOnboarding)
      .set({
        ...updates,
        dateEcheance: updates.dateEcheance ? new Date(updates.dateEcheance) : existing.dateEcheance,
      })
      .where(eq(etapesOnboarding.id, id));

    const [updated] = await db
      .select()
      .from(etapesOnboarding)
      .where(eq(etapesOnboarding.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour étape onboarding:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'étape d'onboarding" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/onboarding-steps/:id
 * 
 * Supprime une étape d'onboarding.
 * Vérifie que l'étape appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/onboarding-steps/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de l'étape
 * @returns {Object} Message de confirmation
 * @throws {404} Étape non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que l'étape existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(etapesOnboarding)
      .where(eq(etapesOnboarding.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Étape d'onboarding non trouvée" });
    }

    // Suppression
    await db
      .delete(etapesOnboarding)
      .where(eq(etapesOnboarding.id, id));

    res.json({ message: "Étape d'onboarding supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression étape onboarding:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'étape d'onboarding" });
  }
});

export default router;
