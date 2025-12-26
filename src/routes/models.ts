// ==========================================
// ROUTES API MODÈLES
// Gestion des modèles/influenceurs
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { modeles } from "../schema";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/models
 * 
 * Récupère la liste complète des modèles/influenceurs de l'agence.
 * Les modèles sont triés par date de création.
 * 
 * @route GET /api/models
 * @access Private - Tous les utilisateurs authentifiés
 * @returns {Array} Liste des modèles avec toutes leurs propriétés
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    const modelsList = await db
      .select()
      .from(modeles)
      .where(eq(modeles.agenceId, agenceId))
      .orderBy(modeles.dateCreation);

    res.json(modelsList);
  } catch (error) {
    console.error("Erreur liste modèles:", error);
    res.status(500).json({ error: "Erreur lors du chargement des modèles" });
  }
});

// ====================================================================================================
/**
 * GET /api/models/:id
 * 
 * Récupère les détails complets d'un modèle spécifique.
 * Vérifie que le modèle appartient bien à l'agence de l'utilisateur.
 * 
 * @route GET /api/models/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID du modèle
 * @returns {Object} Détails complets du modèle
 * @throws {404} Modèle non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.get("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    const [model] = await db
      .select()
      .from(modeles)
      .where(eq(modeles.id, id))
      .limit(1);

    if (!model || model.agenceId !== agenceId) {
      return res.status(404).json({ error: "Modèle non trouvé" });
    }

    res.json(model);
  } catch (error) {
    console.error("Erreur détails modèle:", error);
    res.status(500).json({ error: "Erreur lors du chargement du modèle" });
  }
});

export default router;
