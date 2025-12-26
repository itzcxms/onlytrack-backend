// ==========================================
// ROUTES DE GESTION D'ÉQUIPE
// Invitation, création, suppression de membres (Owner uniquement)
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { utilisateurs, invitations, agences } from "../schema";
import {
  hashPassword,
  generateToken,
  generateSecurePassword,
} from "../lib/auth";
import { authenticate, requireRole } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Toutes les routes requièrent authentification
router.use(authenticate);

// ==========================================
// SCHÉMAS DE VALIDATION
// ==========================================

/**
 * Schéma de validation pour l'invitation d'un membre
 * @property {string} prenom - Prénom du membre (min 2 caractères)
 * @property {string} nom - Nom du membre (min 2 caractères)
 * @property {string} email - Email valide du membre
 * @property {"member" | "model"} role - Rôle du membre dans l'agence
 */
const inviterMembreSchema = z.object({
  prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  role: z.enum(["member", "model"], {
    errorMap: () => ({ message: 'Le rôle doit être "member" ou "model"' }),
  }),
});

// ====================================================================================================
/**
 * GET /api/equipe
 * 
 * Récupère la liste complète des membres de l'équipe de l'agence connectée.
 * Nécessite une authentification.
 * 
 * @route GET /api/equipe
 * @access Private - Tous les utilisateurs authentifiés
 * @returns {Array} Liste des membres avec leurs informations (sans mot de passe)
 * @throws {500} Erreur serveur
 */
router.get("/", async (req, res) => {
  try {
    const membres = await db
      .select({
        id: utilisateurs.id,
        prenom: utilisateurs.prenom,
        nom: utilisateurs.nom,
        email: utilisateurs.email,
        role: utilisateurs.role,
        emailVerifie: utilisateurs.emailVerifie,
        dateCreation: utilisateurs.dateCreation,
        derniereConnexion: utilisateurs.derniereConnexion,
        actif: utilisateurs.actif,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.agenceId, req.agenceId!))
      .orderBy(utilisateurs.dateCreation);

    res.json(membres);
  } catch (error) {
    console.error("Erreur récupération équipe:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ==========================================
// POST /api/equipe/inviter
// Inviter un nouveau membre (Owner uniquement)
// Génère un mot de passe et envoie par email
// ==========================================
router.post("/inviter", requireRole("owner"), async (req, res) => {
  try {
    // Validation
    const data = inviterMembreSchema.parse(req.body);

    // Vérifier si l'email existe déjà dans cette agence
    const [existing] = await db
      .select()
      .from(utilisateurs)
      .where(
        and(
          eq(utilisateurs.email, data.email),
          eq(utilisateurs.agenceId, req.agenceId!),
        ),
      )
      .limit(1);

    if (existing) {
      return res.status(400).json({
        error: "Un membre avec cet email existe déjà dans votre agence",
      });
    }

    // TODO: Vérifier les limites de plan (free = max 3 membres, premium = max 10)
    // const membres = await db.select().from(utilisateurs).where(eq(utilisateurs.agenceId, req.agenceId!));
    // if (plan === 'free' && membres.length >= 3) { ... }

    // Générer un mot de passe sécurisé
    const motDePasse = generateSecurePassword();
    const motDePasseHash = await hashPassword(motDePasse);

    // Créer le compte
    const membreId = crypto.randomUUID();
    await db.insert(utilisateurs).values({
      id: membreId,
      prenom: data.prenom,
      nom: data.nom,
      email: data.email,
      motDePasseHash,
      role: data.role,
      agenceId: req.agenceId!,
      emailVerifie: true, // Compte créé par l'owner = email vérifié
      dateCreation: new Date(),
      actif: true,
    });

    // Créer l'invitation pour traçabilité
    const token = generateToken();
    const dateExpiration = new Date();
    dateExpiration.setDate(dateExpiration.getDate() + 2); // 48h

    await db.insert(invitations).values({
      id: crypto.randomUUID(),
      email: data.email,
      agenceId: req.agenceId!,
      role: data.role,
      token,
      statut: "accepte", // Déjà acceptée car compte créé
      invitePar: req.user!.id,
      dateCreation: new Date(),
      dateExpiration,
    });

    // Récupérer le nom de l'agence pour l'email
    const [agence] = await db
      .select({ nom: agences.nom })
      .from(agences)
      .where(eq(agences.id, req.agenceId!))
      .limit(1);

    // TODO: Envoyer l'email avec les credentials
    // await sendInvitationEmail(data.email, motDePasse, agence.nom);

    console.log(`✉️  Invitation envoyée (DEV):`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Mot de passe: ${motDePasse}`);
    console.log(`   Agence: ${agence?.nom || "Unknown"}`);

    res.status(201).json({
      message: "Membre invité avec succès",
      membre: {
        id: membreId,
        prenom: data.prenom,
        nom: data.nom,
        email: data.email,
        role: data.role,
      },
      // En dev, on retourne le mot de passe
      dev: {
        password: motDePasse,
      },
    });
  } catch (error: any) {
    console.error("Erreur invitation membre:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Données invalides",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Erreur lors de l'invitation" });
  }
});

// ====================================================================================================
/**
 * POST /api/equipe/creer
 * 
 * Créé un nouveau membre avec un mot de passe personnalisé défini par l'owner.
 * Le compte est immédiatement actif et le membre peut se connecter.
 * 
 * @route POST /api/equipe/creer
 * @access Private - Owner uniquement
 * @body {string} prenom - Prénom du nouveau membre
 * @body {string} nom - Nom du nouveau membre
 * @body {string} email - Email unique du membre
 * @body {string} motDePasse - Mot de passe (min 6 caractères)
 * @body {"member" | "model"} role - Rôle du membre
 * @returns {201} Informations du membre créé
 * @throws {400} Données invalides ou email déjà utilisé
 * @throws {500} Erreur serveur
 */
router.post("/creer", requireRole("owner"), async (req, res) => {
  try {
    // Validation avec mot de passe
    const schema = z.object({
      prenom: z
        .string()
        .min(2, "Le prénom doit contenir au moins 2 caractères"),
      nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
      email: z.string().email("Email invalide"),
      motDePasse: z
        .string()
        .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
      role: z.enum(["member", "model"], {
        errorMap: () => ({ message: 'Le rôle doit être "member" ou "model"' }),
      }),
    });

    const data = schema.parse(req.body);

    // Vérifier si l'email existe déjà
    const [existing] = await db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, data.email))
      .limit(1);

    if (existing) {
      return res.status(400).json({
        error: "Un utilisateur avec cet email existe déjà",
      });
    }

    // Hasher le mot de passe
    const motDePasseHash = await hashPassword(data.motDePasse);

    // Créer le compte
    const membreId = crypto.randomUUID();
    await db.insert(utilisateurs).values({
      id: membreId,
      prenom: data.prenom,
      nom: data.nom,
      email: data.email,
      motDePasseHash,
      role: data.role,
      agenceId: req.agenceId!,
      emailVerifie: true, // Compte créé par l'owner = email vérifié
      dateCreation: new Date(),
      actif: true,
    });

    console.log(`✅ Membre créé: ${data.prenom} ${data.nom} (${data.email})`);

    res.status(201).json({
      message: "Membre créé avec succès",
      membre: {
        id: membreId,
        prenom: data.prenom,
        nom: data.nom,
        email: data.email,
        role: data.role,
      },
    });
  } catch (error: any) {
    console.error("Erreur création membre:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Données invalides",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Erreur lors de la création du membre" });
  }
});

// ==========================================
// DELETE /api/equipe/:id
// Supprimer un membre de l'équipe (Owner uniquement)
// ==========================================
router.delete("/:id", requireRole("owner"), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur appartient à l'agence
    const [membre] = await db
      .select()
      .from(utilisateurs)
      .where(
        and(eq(utilisateurs.id, id), eq(utilisateurs.agenceId, req.agenceId!)),
      )
      .limit(1);

    if (!membre) {
      return res.status(404).json({ error: "Membre non trouvé" });
    }

    // Empêcher de supprimer le dernier owner
    if (membre.role === "owner") {
      const [owners] = await db
        .select({ count: utilisateurs.id })
        .from(utilisateurs)
        .where(
          and(
            eq(utilisateurs.agenceId, req.agenceId!),
            eq(utilisateurs.role, "owner"),
          ),
        );

      // Note: Drizzle retourne un array même pour count, vérifier la structure
      return res.status(400).json({
        error: "Impossible de supprimer le dernier propriétaire de l'agence",
      });
    }

    // Empêcher de se supprimer soi-même
    if (id === req.user!.id) {
      return res.status(400).json({
        error: "Vous ne pouvez pas supprimer votre propre compte",
      });
    }

    // Supprimer le membre (CASCADE supprimera aussi ses sessions)
    await db.delete(utilisateurs).where(eq(utilisateurs.id, id));

    res.json({ message: "Membre supprimé avec succès" });
  } catch (error) {
    console.error("Erreur suppression membre:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ==========================================
// PATCH /api/equipe/:id/role
// Modifier le rôle d'un membre (Owner uniquement)
// ==========================================
router.patch("/:id/role", requireRole("owner"), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = z
      .object({
        role: z.enum(["owner", "member", "model"]),
      })
      .parse(req.body);

    // Vérifier que l'utilisateur appartient à l'agence
    const [membre] = await db
      .select()
      .from(utilisateurs)
      .where(
        and(eq(utilisateurs.id, id), eq(utilisateurs.agenceId, req.agenceId!)),
      )
      .limit(1);

    if (!membre) {
      return res.status(404).json({ error: "Membre non trouvé" });
    }

    // Empêcher de modifier son propre rôle
    if (id === req.user!.id) {
      return res.status(400).json({
        error: "Vous ne pouvez pas modifier votre propre rôle",
      });
    }

    // Mettre à jour le rôle
    await db.update(utilisateurs).set({ role }).where(eq(utilisateurs.id, id));

    res.json({ message: "Rôle mis à jour avec succès" });
  } catch (error: any) {
    console.error("Erreur modification rôle:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Données invalides",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Erreur lors de la modification du rôle" });
  }
});

// ==========================================
// GET /api/equipe/invitations
// Récupérer les invitations en attente (Owner uniquement)
// ==========================================
router.get("/invitations", requireRole("owner"), async (req, res) => {
  try {
    const invitationsList = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.agenceId, req.agenceId!),
          eq(invitations.statut, "en_attente"),
        ),
      )
      .orderBy(invitations.dateCreation);

    res.json(invitationsList);
  } catch (error) {
    console.error("Erreur récupération invitations:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
