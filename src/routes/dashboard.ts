// ==========================================
// ROUTES API DASHBOARD
// Fournir les statistiques et données du dashboard
// ==========================================

import { Router } from "express";
import { db } from "../db";
import {
  modeles,
  analytics,
  transactions,
  postsAnalytics,
} from "../schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

// Toutes les routes requièrent l'authentification
router.use(authenticate);

// ====================================================================================================
/**
 * GET /api/dashboard/stats
 * 
 * Retourne les statistiques globales agrégées pour le dashboard de l'agence.
 * Calcule les totaux de vues, likes, revenus et conversions depuis les tables analytics et transactions.
 * 
 * @route GET /api/dashboard/stats
 * @access Private - Tous les utilisateurs authentifiés
 * @returns {Object} Stats avec vues, likes, revenus, conversions
 * @throws {500} Erreur serveur
 */
router.get("/stats", async (req, res) => {
  try {
    const agenceId = req.agenceId!;

    // Calculer les totaux depuis analytics
    const [analyticsData] = await db
      .select({
        totalVues: sql<number>`SUM(CASE WHEN ${analytics.metrique} = 'vues' THEN ${analytics.valeur} ELSE 0 END)`,
        totalLikes: sql<number>`SUM(CASE WHEN ${analytics.metrique} = 'likes' THEN ${analytics.valeur} ELSE 0 END)`,
      })
      .from(analytics)
      .where(eq(analytics.agenceId, agenceId));

    // Calculer les revenus totaux
    const [revenusData] = await db
      .select({
        totalRevenus: sql<number>`SUM(${transactions.montant})`,
        conversions: sql<number>`COUNT(DISTINCT ${transactions.id})`,
      })
      .from(transactions)
      .where(
        and(eq(transactions.agenceId, agenceId), eq(transactions.payee, true)),
      );

    res.json({
      vues: Number(analyticsData?.totalVues || 0),
      likes: Number(analyticsData?.totalLikes || 0),
      revenus: Number(revenusData?.totalRevenus || 0),
      conversions: Number(revenusData?.conversions || 0),
    });
  } catch (error) {
    console.error("Erreur stats dashboard:", error);
    res.status(500).json({ error: "Erreur lors du chargement des stats" });
  }
});

// ====================================================================================================
/**
 * GET /api/dashboard/revenue
 * 
 * Retourne les données de revenus jour par jour pour le graphique du dashboard.
 * Agrège toutes les transactions payées par date.
 * 
 * @route GET /api/dashboard/revenue
 * @access Private - Tous les utilisateurs authentifiés
 * @returns {Array<{date: string, revenus: number}>} Revenus quotidiens
 * @throws {500} Erreur serveur
 */
router.get("/revenue", async (req, res) => {
  try {
    const agenceId = req.agenceId!;
    const { days, startDate, endDate } = req.query;

    // Calculer la date de début selon le paramètre
    let dateDebut: Date;
    let dateFin: Date = new Date();

    if (startDate && endDate && typeof startDate === "string" && typeof endDate === "string") {
      // Période personnalisée
      dateDebut = new Date(startDate);
      dateFin = new Date(endDate);
    } else {
      // Période par défaut (en jours)
      const daysNumber = days && typeof days === "string" ? parseInt(days, 10) : 30;
      dateDebut = new Date();
      dateDebut.setDate(dateDebut.getDate() - daysNumber);
    }

    // Récupérer les revenus pour la période spécifiée
    const revenueData = await db
      .select({
        date: transactions.date,
        montant: transactions.montant,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.agenceId, agenceId),
          eq(transactions.payee, true),
          sql`${transactions.date} >= ${dateDebut}`,
          sql`${transactions.date} <= ${dateFin}`
        ),
      )
      .orderBy(transactions.date);

    // Grouper par jour
    const revenueByDay = revenueData.reduce((acc: any, curr) => {
      const dateKey = curr.date.toISOString().split("T")[0];
      if (!acc[dateKey]) {
        acc[dateKey] = 0;
      }
      acc[dateKey] += Number(curr.montant);
      return acc;
    }, {});

    // Formater pour le graphique
    const chartData = Object.entries(revenueByDay).map(([date, montant]) => ({
      date,
      revenus: Math.round((montant as number) * 100) / 100,
    }));

    res.json(chartData);
  } catch (error) {
    console.error("Erreur revenue chart:", error);
    res.status(500).json({ error: "Erreur lors du chargement des revenus" });
  }
});

export default router;
