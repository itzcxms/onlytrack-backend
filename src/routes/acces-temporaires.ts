// ==========================================
// ROUTES ACCÈS TEMPORAIRES
// Gestion des accès pour clients/influenceurs
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { accesTemporaires, agences } from "../schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";
import crypto from "crypto";

const router = Router();

// ==========================================
// GET /api/acces-temporaires
// Lister les accès temporaires de l'agence
// ==========================================
router.get("/", authenticate, async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    const accesList = await db
      .select()
      .from(accesTemporaires)
      .where(eq(accesTemporaires.agenceId, agenceId));

    res.json(accesList);
  } catch (error) {
    console.error("Erreur liste accès temporaires:", error);
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

// ==========================================
// POST /api/acces-temporaires
// Créer un nouvel accès temporaire
// ==========================================
router.post("/", authenticate, async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const userId = req.user!.id;
    const { nom, email, joursValidite } = req.body;

    if (!nom) {
      return res.status(400).json({ error: "Le nom est requis" });
    }

    // Générer un token unique
    const token = crypto.randomBytes(32).toString("hex");

    // Calculer la date d'expiration (optionnelle)
    let dateExpiration = null;
    if (joursValidite && joursValidite > 0) {
      dateExpiration = new Date();
      dateExpiration.setDate(dateExpiration.getDate() + joursValidite);
    }

    const id = crypto.randomUUID();

    await db.insert(accesTemporaires).values({
      id,
      agenceId,
      nom,
      email: email || null,
      token,
      dateExpiration,
      actif: true,
      creePar: userId,
    });

    const [created] = await db
      .select()
      .from(accesTemporaires)
      .where(eq(accesTemporaires.id, id))
      .limit(1);

    // Retourner l'accès avec le lien complet
    res.status(201).json({
      ...created,
      lien: `/acces/${token}`,
    });
  } catch (error) {
    console.error("Erreur création accès temporaire:", error);
    res.status(500).json({ error: "Erreur lors de la création" });
  }
});

// ==========================================
// DELETE /api/acces-temporaires/:id
// Révoquer un accès temporaire
// ==========================================
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { id } = req.params;

    // Vérifier que l'accès appartient à l'agence
    const [existing] = await db
      .select()
      .from(accesTemporaires)
      .where(
        and(
          eq(accesTemporaires.id, id),
          eq(accesTemporaires.agenceId, agenceId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Accès non trouvé" });
    }

    // Désactiver plutôt que supprimer (pour garder l'historique)
    await db
      .update(accesTemporaires)
      .set({ actif: false })
      .where(eq(accesTemporaires.id, id));

    res.json({ message: "Accès révoqué avec succès" });
  } catch (error) {
    console.error("Erreur révocation accès:", error);
    res.status(500).json({ error: "Erreur lors de la révocation" });
  }
});

// ==========================================
// GET /api/acces-temporaires/valider/:token
// Valider un token d'accès (public)
// ==========================================
router.get("/valider/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [acces] = await db
      .select()
      .from(accesTemporaires)
      .where(eq(accesTemporaires.token, token))
      .limit(1);

    if (!acces) {
      return res.status(404).json({ 
        valid: false, 
        error: "Lien d'accès invalide" 
      });
    }

    if (!acces.actif) {
      return res.status(403).json({ 
        valid: false, 
        error: "Cet accès a été révoqué" 
      });
    }

    // Vérifier l'expiration
    if (acces.dateExpiration && new Date() > new Date(acces.dateExpiration)) {
      return res.status(403).json({ 
        valid: false, 
        error: "Cet accès a expiré" 
      });
    }

    // Récupérer les infos de l'agence
    const [agence] = await db
      .select({ nom: agences.nom })
      .from(agences)
      .where(eq(agences.id, acces.agenceId))
      .limit(1);

    res.json({
      valid: true,
      agenceId: acces.agenceId,
      agenceNom: agence?.nom,
      nom: acces.nom,
    });
  } catch (error) {
    console.error("Erreur validation token:", error);
    res.status(500).json({ valid: false, error: "Erreur serveur" });
  }
});

export default router;
