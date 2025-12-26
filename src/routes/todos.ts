// ==========================================
// ROUTES API TÂCHES (TO-DO LIST)
// Gestion des tâches de l'agence
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { taches } from "../schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/todos
 * 
 * Récupère toutes les tâches de l'agence.
 * Les tâches sont triées par date de création.
 * 
 * @route GET /api/todos
 * @access Private - Tous les utilisateurs authentifiés
 * @returns {Array} Liste des tâches de l'agence
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    const tachesList = await db
      .select()
      .from(taches)
      .where(eq(taches.agenceId, agenceId))
      .orderBy(taches.dateCreation);

    res.json(tachesList);
  } catch (error) {
    console.error("Erreur récupération tâches:", error);
    res.status(500).json({ error: "Erreur lors du chargement des tâches" });
  }
});

// ====================================================================================================
/**
 * POST /api/todos
 * 
 * Créé une nouvelle tâche pour l'agence.
 * Peut être assignée à un membre ou liée à un modèle.
 * 
 * @route POST /api/todos
 * @access Private - Tous les utilisateurs authentifiés
 * @body {string} texte - Texte de la tâche (requis)
 * @body {boolean} [terminee=false] - Statut de la tâche
 * @body {string} [assigneA] - Nom de la personne assignée
 * @body {string} [modeleId] - ID du modèle lié
 * @returns {201} Tâche créée
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    const schema = z.object({
      texte: z.string().min(1, "Le texte de la tâche est requis"),
      terminee: z.boolean().optional().default(false),
      assigneA: z.string().optional(),
      modeleId: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const tacheId = crypto.randomUUID();
    await db.insert(taches).values({
      id: tacheId,
      agenceId,
      texte: data.texte,
      terminee: data.terminee,
      assigneA: data.assigneA || null,
      modeleId: data.modeleId || null,
      dateCreation: new Date(),
    });

    const [newTache] = await db
      .select()
      .from(taches)
      .where(eq(taches.id, tacheId))
      .limit(1);

    res.status(201).json(newTache);
  } catch (error: any) {
    console.error("Erreur création tâche:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Données invalides",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Erreur lors de la création de la tâche" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/todos/:id
 * 
 * Modifie le statut d'une tâche (terminée/non terminée).
 * Vérifie que la tâche appartient à l'agence.
 * 
 * @route PATCH /api/todos/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de la tâche
 * @body {boolean} terminee - Nouveau statut
 * @returns {Object} Tâche mise à jour
 * @throws {404} Tâche non trouvée
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const agenceId = req.agenceId!;

    const schema = z.object({
      terminee: z.boolean(),
    });

    const data = schema.parse(req.body);

    // Vérifier que la tâche appartient à l'agence
    const [tache] = await db
      .select()
      .from(taches)
      .where(and(eq(taches.id, id), eq(taches.agenceId, agenceId)))
      .limit(1);

    if (!tache) {
      return res.status(404).json({ error: "Tâche non trouvée" });
    }

    await db
      .update(taches)
      .set({ terminee: data.terminee })
      .where(eq(taches.id, id));

    const [updatedTache] = await db
      .select()
      .from(taches)
      .where(eq(taches.id, id))
      .limit(1);

    res.json(updatedTache);
  } catch (error: any) {
    console.error("Erreur modification tâche:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Données invalides",
        details: error.errors,
      });
    }

    res
      .status(500)
      .json({ error: "Erreur lors de la modification de la tâche" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/todos/:id
 * 
 * Supprime définitivement une tâche.
 * Vérifie que la tâche appartient à l'agence.
 * 
 * @route DELETE /api/todos/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de la tâche à supprimer
 * @returns {Object} Message de confirmation
 * @throws {404} Tâche non trouvée
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const agenceId = req.agenceId!;

    // Vérifier que la tâche appartient à l'agence
    const [tache] = await db
      .select()
      .from(taches)
      .where(and(eq(taches.id, id), eq(taches.agenceId, agenceId)))
      .limit(1);

    if (!tache) {
      return res.status(404).json({ error: "Tâche non trouvée" });
    }

    await db.delete(taches).where(eq(taches.id, id));

    res.json({ message: "Tâche supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression tâche:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la suppression de la tâche" });
  }
});

export default router;
