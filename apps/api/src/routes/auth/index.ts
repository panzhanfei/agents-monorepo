import { Router } from "express";
import { authController } from "@/controllers/auth";
import { requireUser } from "@/middleware";

export const authRouter = Router();

authRouter.post("/register", authController.postRegister);
authRouter.post("/login", authController.postLogin);
authRouter.get("/me", requireUser, authController.getMe);
authRouter.patch("/me", requireUser, authController.patchMe);
authRouter.post("/me/inference/test", requireUser, authController.postInferenceTest);
authRouter.post("/refresh", authController.postRefresh);
