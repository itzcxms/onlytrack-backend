// ==========================================
// ROUTES API POSTS ANALYTICS
// Statistiques des posts individuels
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { postsAnalytics } from "../schema";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/posts-analytics
 * 
 * Récupère la liste des posts analytics avec filtre optionnel par modèle.
 * Les posts sont triés par date de publication décroissante.
 * 
 * @route GET /api/posts-analytics
 * @access Private - Tous les utilisateurs authentifiés
 * @query {string} modelId - Filtre par modèle (optionnel)
 * @returns {Array} Liste des posts analytics
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modelId } = req.query;

    let query = db
      .select()
      .from(postsAnalytics)
      .where(eq(postsAnalytics.agenceId, agenceId))
      .$dynamic();

    if (modelId && typeof modelId === "string") {
      query = query.where(eq(postsAnalytics.modeleId, modelId));
    }

    const postsList = await query.orderBy(postsAnalytics.datePublication);

    res.json(postsList);
  } catch (error) {
    console.error("Erreur liste posts analytics:", error);
    res.status(500).json({ error: "Erreur lors du chargement des analytics de posts" });
  }
});

// ====================================================================================================
/**
 * GET /api/posts-analytics/:id
 * 
 * Récupère les détails d'un post analytics spécifique.
 * Vérifie que le post appartient bien à l'agence de l'utilisateur.
 * 
 * @route GET /api/posts-analytics/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID du post analytics
 * @returns {Object} Détails du post analytics
 * @throws {404} Post non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.get("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    const [post] = await db
      .select()
      .from(postsAnalytics)
      .where(eq(postsAnalytics.id, id))
      .limit(1);

    if (!post || post.agenceId !== agenceId) {
      return res.status(404).json({ error: "Post analytics non trouvé" });
    }

    res.json(post);
  } catch (error) {
    console.error("Erreur détails post analytics:", error);
    res.status(500).json({ error: "Erreur lors du chargement du post analytics" });
  }
});

// ====================================================================================================
/**
 * POST /api/posts-analytics
 * 
 * Crée une nouvelle entrée de post analytics.
 * 
 * @route POST /api/posts-analytics
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données du post (modeleId, urlPost, likes, commentaires, etc.)
 * @returns {Object} Post analytics créé
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { 
      modeleId, 
      urlPost, 
      urlMiniature, 
      likes, 
      commentaires, 
      vues, 
      engagement, 
      datePublication 
    } = req.body;

    if (!modeleId || !urlPost || !datePublication) {
      return res.status(400).json({ 
        error: "ModeleId, urlPost et datePublication sont requis" 
      });
    }

    const postId = crypto.randomUUID();
    await db.insert(postsAnalytics).values({
      id: postId,
      agenceId,
      modeleId,
      urlPost,
      urlMiniature: urlMiniature || null,
      likes: likes || 0,
      commentaires: commentaires || 0,
      vues: vues || 0,
      engagement: engagement || 0,
      datePublication: new Date(datePublication),
    });

    const [created] = await db
      .select()
      .from(postsAnalytics)
      .where(eq(postsAnalytics.id, postId))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création post analytics:", error);
    res.status(500).json({ error: "Erreur lors de la création du post analytics" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/posts-analytics/:id
 * 
 * Met à jour les statistiques d'un post.
 * Vérifie que le post appartient bien à l'agence de l'utilisateur.
 * 
 * @route PATCH /api/posts-analytics/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID du post analytics
 * @body {Object} data - Données à mettre à jour
 * @returns {Object} Post analytics mis à jour
 * @throws {404} Post non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que le post existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(postsAnalytics)
      .where(eq(postsAnalytics.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Post analytics non trouvé" });
    }

    // Mise à jour
    await db
      .update(postsAnalytics)
      .set({
        ...updates,
        datePublication: updates.datePublication 
          ? new Date(updates.datePublication) 
          : existing.datePublication,
      })
      .where(eq(postsAnalytics.id, id));

    const [updated] = await db
      .select()
      .from(postsAnalytics)
      .where(eq(postsAnalytics.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour post analytics:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du post analytics" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/posts-analytics/:id
 * 
 * Supprime un post analytics.
 * Vérifie que le post appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/posts-analytics/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID du post analytics
 * @returns {Object} Message de confirmation
 * @throws {404} Post non trouvé ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que le post existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(postsAnalytics)
      .where(eq(postsAnalytics.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Post analytics non trouvé" });
    }

    // Suppression
    await db
      .delete(postsAnalytics)
      .where(eq(postsAnalytics.id, id));

    res.json({ message: "Post analytics supprimé avec succès" });
  } catch (error) {
    console.error("Erreur suppression post analytics:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du post analytics" });
  }
});

export default router;
