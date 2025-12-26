// ==========================================
// ROUTES API AFFILIÉS
// Gestion des affiliés et liens d'affiliation
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { affilies } from "../schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/affiliates
 * 
 * Récupère la liste complète des affiliés de l'agence.
 * Les affiliés sont triés par date de création.
 * 
 * @route GET /api/affiliates
 * @access Private - Tous les utilisateurs authentifiés
 * @returns {Array} Liste des affiliés avec toutes leurs propriétés
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    const affiliatesList = await db
      .select()
      .from(affilies)
      .where(eq(affilies.agenceId, agenceId))
      .orderBy(affilies.dateCreation);

    res.json(affiliatesList);
  } catch (error) {
    console.error("Erreur liste affiliés:", error);
    res.status(500).json({ error: "Erreur lors du chargement des affiliés" });
  }
});

// ====================================================================================================
/**
 * POST /api/affiliates
 * 
 * Crée un nouveau lien d'affilié.
 * 
 * @route POST /api/affiliates
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données de l'affilié (nom, lien, commission)
 * @returns {Object} Affilié créé
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { nom, lien, commission, clics, conversions, revenus } = req.body;

    if (!nom || !lien) {
      return res.status(400).json({ error: "Nom et lien sont requis" });
    }

    const affiliateId = crypto.randomUUID();
    await db.insert(affilies).values({
      id: affiliateId,
      agenceId,
      nom,
      lien,
      commission: commission || 0,
      clics: clics || 0,
      conversions: conversions || 0,
      revenus: revenus || 0,
    });

    const [created] = await db
      .select()
      .from(affilies)
      .where(eq(affilies.id, affiliateId))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création affilié:", error);
    res.status(500).json({ error: "Erreur lors de la création de l'affilié" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/affiliates/:id
 * 
 * Met à jour un affilié existant.
 * Vérifie que l'affilié appartient bien à l'agence de l'utilisateur.
 * 
 * @route PATCH /api/affiliates/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de l'affilié
 * @body {Object} data - Données à mettre à jour
 * @returns {Object} Affilié mis à jour
 * @throws {404} Affilié non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que l'affilié existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(affilies)
      .where(eq(affilies.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Affilié non trouvé" });
    }

    // Mise à jour
    await db
      .update(affilies)
      .set(updates)
      .where(eq(affilies.id, id));

    const [updated] = await db
      .select()
      .from(affilies)
      .where(eq(affilies.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour affilié:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'affilié" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/affiliates/:id
 * 
 * Supprime un affilié.
 * Vérifie que l'affilié appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/affiliates/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de l'affilié
 * @returns {Object} Message de confirmation
 * @throws {404} Affilié non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que l'affilié existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(affilies)
      .where(eq(affilies.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Affilié non trouvé" });
    }

    // Suppression
    await db
      .delete(affilies)
      .where(eq(affilies.id, id));

    res.json({ message: "Affilié supprimé avec succès" });
  } catch (error) {
    console.error("Erreur suppression affilié:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'affilié" });
  }
});

export default router;
