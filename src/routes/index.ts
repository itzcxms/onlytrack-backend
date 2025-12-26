import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./auth";
import equipeRoutes from "./equipe";
import dashboardRoutes from "./dashboard";
import modelsRoutes from "./models";
import todosRoutes from "./todos";
import onboardingRoutes from "./onboarding";
import affiliatesRoutes from "./affiliates";
import analyticsRoutes from "./analytics";
import postsAnalyticsRoutes from "./posts-analytics";
import transactionsRoutes from "./transactions";
import dmCandidatesRoutes from "./dm-candidates";
import dmScriptsRoutes from "./dm-scripts";
import inspirationsRoutes from "./inspirations";
import proceduresRoutes from "./procedures";
import stripeRoutes from "./stripe";
import adminRoutes from "./admin";
import accesTemporairesRoutes from "./acces-temporaires";
import adminAuthRoutes from "./admin-auth";
import demoRoutes from "./demo";



export function registerRoutes(app: Express): Server {
  // Routes d'authentification (publiques)
  app.use("/api/auth", authRoutes);

  // Routes d'authentification admin (séparées)
  app.use("/api/admin/auth", adminAuthRoutes);

  // Routes démo (publiques - liens temporaires)
  app.use("/api/demo", demoRoutes);

  // Routes Stripe (paiements)
  app.use("/api/stripe", stripeRoutes);

  // Routes admin (admin uniquement)
  app.use("/api/admin", adminRoutes);

  // Routes accès temporaires
  app.use("/api/acces-temporaires", accesTemporairesRoutes);

  // Routes de gestion d'équipe (protégées)
  app.use("/api/equipe", equipeRoutes);

  // Routes dashboard
  app.use("/api/dashboard", dashboardRoutes);

  // Routes modèles
  app.use("/api/models", modelsRoutes);

  // Routes tâches
  app.use("/api/todos", todosRoutes);

  // Routes onboarding
  app.use("/api/onboarding-steps", onboardingRoutes);

  // Routes affiliés
  app.use("/api/affiliates", affiliatesRoutes);

  // Routes analytics
  app.use("/api/analytics", analyticsRoutes);

  // Routes posts analytics
  app.use("/api/posts-analytics", postsAnalyticsRoutes);

  // Routes transactions
  app.use("/api/transactions", transactionsRoutes);

  // Routes DM candidats
  app.use("/api/dm-candidates", dmCandidatesRoutes);

  // Routes DM scripts
  app.use("/api/dm-scripts", dmScriptsRoutes);

  // Routes inspirations
  app.use("/api/inspirations", inspirationsRoutes);

  // Routes procédures
  app.use("/api/procedures", proceduresRoutes);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);
  return httpServer;
}
