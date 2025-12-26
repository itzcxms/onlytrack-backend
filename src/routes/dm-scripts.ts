// ==========================================
// ROUTES API SCRIPTS DM
// Templates de messages DM pour le recrutement
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { scriptsDm } from "../schema";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/dm-scripts
 * 
 * Récupère la liste complète des scripts DM de l'agence.
 * 
 * @route GET /api/dm-scripts
 * @access Private - Tous les utilisateurs authentifiés
 * @returns {Array} Liste des scripts DM
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    const scriptsList = await db
      .select()
      .from(scriptsDm)
      .where(eq(scriptsDm.agenceId, agenceId));

    res.json(scriptsList);
  } catch (error) {
    console.error("Erreur liste scripts DM:", error);
    res.status(500).json({ error: "Erreur lors du chargement des scripts DM" });
  }
});

// ====================================================================================================
/**
 * POST /api/dm-scripts
 * 
 * Crée un nouveau script DM.
 * 
 * @route POST /api/dm-scripts
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données du script (nom, contenu, tauxConversion, nombreUtilisations)
 * @returns {Object} Script créé
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { nom, contenu, tauxConversion, nombreUtilisations } = req.body;

    if (!nom || !contenu) {
      return res.status(400).json({ error: "Nom et contenu sont requis" });
    }

    const scriptId = crypto.randomUUID();
    await db.insert(scriptsDm).values({
      id: scriptId,
      agenceId,
      nom,
      contenu,
      tauxConversion: tauxConversion || null,
      nombreUtilisations: nombreUtilisations || 0,
    });

    const [created] = await db
      .select()
      .from(scriptsDm)
      .where(eq(scriptsDm.id, scriptId))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création script DM:", error);
    res.status(500).json({ error: "Erreur lors de la création du script DM" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/dm-scripts/:id
 * 
 * Met à jour un script DM existant.
 * Vérifie que le script appartient bien à l'agence de l'utilisateur.
 * 
 * @route PATCH /api/dm-scripts/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID du script
 * @body {Object} data - Données à mettre à jour
 * @returns {Object} Script mis à jour
 * @throws {404} Script non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que le script existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(scriptsDm)
      .where(eq(scriptsDm.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Script DM non trouvé" });
    }

    // Mise à jour
    await db
      .update(scriptsDm)
      .set(updates)
      .where(eq(scriptsDm.id, id));

    const [updated] = await db
      .select()
      .from(scriptsDm)
      .where(eq(scriptsDm.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour script DM:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du script DM" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/dm-scripts/:id
 * 
 * Supprime un script DM.
 * Vérifie que le script appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/dm-scripts/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID du script
 * @returns {Object} Message de confirmation
 * @throws {404} Script non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que le script existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(scriptsDm)
      .where(eq(scriptsDm.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Script DM non trouvé" });
    }

    // Suppression
    await db
      .delete(scriptsDm)
      .where(eq(scriptsDm.id, id));

    res.json({ message: "Script DM supprimé avec succès" });
  } catch (error) {
    console.error("Erreur suppression script DM:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du script DM" });
  }
});

export default router;
