import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import clothesRoutes from "./routes/clothes.js";
import outfitRoutes from "./routes/outfits.js";
import collectionRoutes from "./routes/collections.js";
import dashboardRoutes from "./routes/dashboard.js";
import uploadRoutes, { uploadsDir } from "./routes/uploads.js";
import weatherRoutes from "./routes/weather.js";
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }));
app.use(morgan("dev"));
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/clothes", clothesRoutes);
app.use("/api/outfits", outfitRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/weather", weatherRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
