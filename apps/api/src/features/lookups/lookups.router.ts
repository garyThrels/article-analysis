import { Router } from "express";
import type { ApiResponse, Lookups } from "@carma/shared";
import { getLookups } from "./lookups.repository.js";

export const lookupsRouter = Router();

// GET /api/lookups -> reference data (sources + languages) for filter controls.
lookupsRouter.get("/", async (_req, res) => {
  const body: ApiResponse<Lookups> = { data: await getLookups() };
  res.json(body);
});
