// ==========================================
// ROUTES API TRANSACTIONS
// Gestion des transactions financières
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { transactions } from "../schema";
import { eq, gte, lte } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/transactions
 * 
 * Récupère la liste des transactions avec filtres optionnels.
 * Supporte les filtres: modelId, payee, dateDebut, dateFin
 * 
 * @route GET /api/transactions
 * @access Private - Tous les utilisateurs authentifiés
 * @query {string} modelId - Filtre par modèle (optionnel)
 * @query {string} payee - Filtre par statut payé true/false (optionnel)
 * @query {string} dateDebut - Date de début (optionnel)
 * @query {string} dateFin - Date de fin (optionnel)
 * @returns {Array} Liste des transactions
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modelId, payee, dateDebut, dateFin } = req.query;

    let query = db
      .select()
      .from(transactions)
      .where(eq(transactions.agenceId, agenceId))
      .$dynamic();

    // Filtres optionnels
    if (modelId && typeof modelId === "string") {
      query = query.where(eq(transactions.modeleId, modelId));
    }
    if (payee !== undefined) {
      query = query.where(eq(transactions.payee, payee === "true"));
    }
    if (dateDebut && typeof dateDebut === "string") {
      query = query.where(gte(transactions.date, new Date(dateDebut)));
    }
    if (dateFin && typeof dateFin === "string") {
      query = query.where(lte(transactions.date, new Date(dateFin)));
    }

    const transactionsList = await query.orderBy(transactions.date);

    res.json(transactionsList);
  } catch (error) {
    console.error("Erreur liste transactions:", error);
    res.status(500).json({ error: "Erreur lors du chargement des transactions" });
  }
});

// ====================================================================================================
/**
 * POST /api/transactions
 * 
 * Crée une nouvelle transaction.
 * 
 * @route POST /api/transactions
 * @access Private - Tous les utilisateurs authentifiés
 * @body {Object} data - Données de la transaction (montant, modeleId, abonnements, payee)
 * @returns {Object} Transaction créée
 * @throws {400} Données invalides
 * @throws {500} Erreur serveur
 */
router.post("/", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { modeleId, montant, abonnements, payee } = req.body;

    if (montant === undefined) {
      return res.status(400).json({ error: "Montant est requis" });
    }

    const transactionId = crypto.randomUUID();
    await db.insert(transactions).values({
      id: transactionId,
      agenceId,
      modeleId: modeleId || null,
      montant,
      abonnements: abonnements || 0,
      payee: payee || false,
    });

    const [created] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création transaction:", error);
    res.status(500).json({ error: "Erreur lors de la création de la transaction" });
  }
});

// ====================================================================================================
/**
 * PATCH /api/transactions/:id
 * 
 * Met à jour une transaction existante.
 * Vérifie que la transaction appartient bien à l'agence de l'utilisateur.
 * 
 * @route PATCH /api/transactions/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de la transaction
 * @body {Object} data - Données à mettre à jour
 * @returns {Object} Transaction mise à jour
 * @throws {404} Transaction non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.patch("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que la transaction existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Transaction non trouvée" });
    }

    // Mise à jour
    await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, id));

    const [updated] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour transaction:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la transaction" });
  }
});

// ====================================================================================================
/**
 * DELETE /api/transactions/:id
 * 
 * Supprime une transaction.
 * Vérifie que la transaction appartient bien à l'agence de l'utilisateur.
 * 
 * @route DELETE /api/transactions/:id
 * @access Private - Tous les utilisateurs authentifiés
 * @param {string} id - ID de la transaction
 * @returns {Object} Message de confirmation
 * @throws {404} Transaction non trouvée ou n'appartient pas à l'agence
 * @throws {500} Erreur serveur
 */
router.delete("/:id", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que la transaction existe et appartient à l'agence
    const [existing] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    if (!existing || existing.agenceId !== agenceId) {
      return res.status(404).json({ error: "Transaction non trouvée" });
    }

    // Suppression
    await db
      .delete(transactions)
      .where(eq(transactions.id, id));

    res.json({ message: "Transaction supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression transaction:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de la transaction" });
  }
});

export default router;
