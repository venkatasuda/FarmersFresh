"use server";
import * as backend from "@/server/auth/staff-access";
export async function setStaffAccess(...args: Parameters<typeof backend.setStaffAccess>) { return backend.setStaffAccess(...args); }
