import type { RequestHandler } from "express";
import { importBackup } from "../../services/import/import.service.js";

export const run: RequestHandler = async (req, res) => { res.json(await importBackup(req.auth!.userId, req.body)); };
