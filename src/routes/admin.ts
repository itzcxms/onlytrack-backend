// ==========================================
// ROUTES ADMIN
// Gestion des agences, utilisateurs et admins
// ==========================================

import { Router } from "express";
import { db } from "../db";
import { agences, utilisateurs, superAdmins, accesTemporaires } from "../schema";
import { eq, desc, ne } from "drizzle-orm";
import { requireAdmin } from "./admin-auth";
import bcrypt from "bcrypt";

const router = Router();

// Toutes les routes admin nécessitent auth admin
router.use(requireAdmin);

// ==========================================
// GET /api/admin/check
// Vérifier si l'utilisateur est admin
// ==========================================
router.get("/check", (req, res) => {
  res.json({ isAdmin: true });
});

// ==========================================
// GET /api/admin/agences
// Lister toutes les agences
// ==========================================
router.get("/agences", async (req, res) => {
  try {
    const agencesList = await db
      .select({
        id: agences.id,
        nom: agences.nom,
        plan: agences.plan,
        demo: agences.demo,
        statutAbonnement: agences.statutAbonnement,
        dateCreation: agences.dateCreation,
        idAbonnementStripe: agences.idAbonnementStripe,
      })
      .from(agences)
      .orderBy(desc(agences.dateCreation));

    res.json(agencesList);
  } catch (error) {
    console.error("Erreur liste agences:", error);
    res.status(500).json({ error: "Erreur lors du chargement des agences" });
  }
});

// ==========================================
// PATCH /api/admin/agences/:id
// Modifier une agence
// ==========================================
router.patch("/agences/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, statutAbonnement, demo } = req.body;

    const updates: any = {};
    if (plan !== undefined) updates.plan = plan;
    if (statutAbonnement !== undefined) updates.statutAbonnement = statutAbonnement;
    if (demo !== undefined) updates.demo = demo;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Aucune modification fournie" });
    }

    await db.update(agences).set(updates).where(eq(agences.id, id));

    const [updated] = await db
      .select()
      .from(agences)
      .where(eq(agences.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur modification agence:", error);
    res.status(500).json({ error: "Erreur lors de la modification" });
  }
});

// ==========================================
// GET /api/admin/utilisateurs
// Lister tous les utilisateurs
// ==========================================
router.get("/utilisateurs", async (req, res) => {
  try {
    const usersList = await db
      .select({
        id: utilisateurs.id,
        prenom: utilisateurs.prenom,
        nom: utilisateurs.nom,
        email: utilisateurs.email,
        role: utilisateurs.role,
        agenceId: utilisateurs.agenceId,
        emailVerifie: utilisateurs.emailVerifie,
        actif: utilisateurs.actif,
        dateCreation: utilisateurs.dateCreation,
        derniereConnexion: utilisateurs.derniereConnexion,
      })
      .from(utilisateurs)
      .orderBy(desc(utilisateurs.dateCreation));

    res.json(usersList);
  } catch (error) {
    console.error("Erreur liste utilisateurs:", error);
    res.status(500).json({ error: "Erreur lors du chargement des utilisateurs" });
  }
});

// ==========================================
// PATCH /api/admin/utilisateurs/:id
// Modifier un utilisateur
// ==========================================
router.patch("/utilisateurs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, actif, emailVerifie } = req.body;

    const updates: any = {};
    if (role !== undefined) updates.role = role;
    if (actif !== undefined) updates.actif = actif;
    if (emailVerifie !== undefined) updates.emailVerifie = emailVerifie;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Aucune modification fournie" });
    }

    await db.update(utilisateurs).set(updates).where(eq(utilisateurs.id, id));

    const [updated] = await db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    console.error("Erreur modification utilisateur:", error);
    res.status(500).json({ error: "Erreur lors de la modification" });
  }
});

// ==========================================
// GET /api/admin/admins
// Lister tous les admins
// ==========================================
router.get("/admins", async (req, res) => {
  try {
    const adminsList = await db
      .select({
        id: superAdmins.id,
        email: superAdmins.email,
        nom: superAdmins.nom,
        prenom: superAdmins.prenom,
        actif: superAdmins.actif,
        dateCreation: superAdmins.dateCreation,
        derniereConnexion: superAdmins.derniereConnexion,
      })
      .from(superAdmins)
      .orderBy(desc(superAdmins.dateCreation));

    res.json(adminsList);
  } catch (error) {
    console.error("Erreur liste admins:", error);
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

// ==========================================
// POST /api/admin/admins
// Créer un nouvel admin
// ==========================================
router.post("/admins", async (req, res) => {
  try {
    const { email, motDePasse, nom, prenom } = req.body;

    if (!email || !motDePasse || !nom || !prenom) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    // Vérifier si l'email existe déjà
    const [existing] = await db
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }

    // Hasher le mot de passe
    const motDePasseHash = await bcrypt.hash(motDePasse, 10);

    const id = crypto.randomUUID();
    await db.insert(superAdmins).values({
      id,
      email: email.toLowerCase(),
      motDePasse: motDePasseHash,
      nom,
      prenom,
      actif: true,
    });

    const [created] = await db
      .select({
        id: superAdmins.id,
        email: superAdmins.email,
        nom: superAdmins.nom,
        prenom: superAdmins.prenom,
        actif: superAdmins.actif,
        dateCreation: superAdmins.dateCreation,
      })
      .from(superAdmins)
      .where(eq(superAdmins.id, id))
      .limit(1);

    res.status(201).json(created);
  } catch (error) {
    console.error("Erreur création admin:", error);
    res.status(500).json({ error: "Erreur lors de la création" });
  }
});

// ==========================================
// PATCH /api/admin/admins/:id
// Modifier un admin
// ==========================================
router.patch("/admins/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { actif, motDePasse } = req.body;

    const updates: any = {};
    if (actif !== undefined) updates.actif = actif;
    if (motDePasse) {
      updates.motDePasse = await bcrypt.hash(motDePasse, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Aucune modification fournie" });
    }

    await db.update(superAdmins).set(updates).where(eq(superAdmins.id, id));

    res.json({ message: "Admin mis à jour" });
  } catch (error) {
    console.error("Erreur modification admin:", error);
    res.status(500).json({ error: "Erreur lors de la modification" });
  }
});

// ==========================================
// GET /api/admin/stats
// Statistiques globales (exclut les agences de démo)
// ==========================================
router.get("/stats", async (req, res) => {
  try {
    // Filtrer par le champ demo de la base de données
    const allAgences = await db.select().from(agences);
    const realAgences = allAgences.filter(a => !a.demo);
    const demoAgences = allAgences.filter(a => a.demo);
    
    const allUsers = await db.select().from(utilisateurs);
    const allAdmins = await db.select().from(superAdmins);

    const stats = {
      // Stats principales (sans démo)
      totalAgences: realAgences.length,
      agencesPremium: realAgences.filter(a => a.plan === "premium").length,
      agencesFree: realAgences.filter(a => a.plan === "free").length,
      totalUtilisateurs: allUsers.length,
      utilisateursActifs: allUsers.filter(u => u.actif).length,
      totalAdmins: allAdmins.length,
      // Revenus estimés
      revenuMensuel: realAgences.filter(a => a.plan === "premium").length * 49,
      // Stats avec démo (pour info)
      agencesDemo: demoAgences.length,
    };

    res.json(stats);
  } catch (error) {
    console.error("Erreur stats admin:", error);
    res.status(500).json({ error: "Erreur lors du chargement des stats" });
  }
});

// ==========================================
// GET /api/admin/acces-temporaires
// Lister tous les accès temporaires
// ==========================================
router.get("/acces-temporaires", async (req, res) => {
  try {
    const acces = await db
      .select()
      .from(accesTemporaires)
      .orderBy(desc(accesTemporaires.dateCreation));
    
    res.json(acces);
  } catch (error) {
    console.error("Erreur liste accès temporaires:", error);
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

// ==========================================
// POST /api/admin/acces-temporaires
// Créer un accès temporaire
// ==========================================
router.post("/acces-temporaires", async (req, res) => {
  try {
    const { agenceId, nom, email, dureeJours } = req.body;

    if (!agenceId || !nom) {
      return res.status(400).json({ error: "Agence et nom requis" });
    }

    const token = crypto.randomUUID();
    const dateExpiration = dureeJours 
      ? new Date(Date.now() + dureeJours * 24 * 60 * 60 * 1000)
      : null;
    
    const id = crypto.randomUUID();
    const adminId = (req as any).admin?.id || "admin";

    await db.insert(accesTemporaires).values({
      id,
      agenceId,
      nom,
      email: email || null,
      token,
      dateExpiration,
      actif: true,
      creePar: adminId,
    });

    res.status(201).json({ 
      id, 
      token,
      message: "Accès créé" 
    });
  } catch (error) {
    console.error("Erreur création accès temporaire:", error);
    res.status(500).json({ error: "Erreur lors de la création" });
  }
});

// ==========================================
// DELETE /api/admin/acces-temporaires/:id
// Révoquer un accès temporaire
// ==========================================
router.delete("/acces-temporaires/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(accesTemporaires)
      .set({ actif: false })
      .where(eq(accesTemporaires.id, id));

    res.json({ message: "Accès révoqué" });
  } catch (error) {
    console.error("Erreur révocation accès:", error);
    res.status(500).json({ error: "Erreur lors de la révocation" });
  }
});

export default router;
