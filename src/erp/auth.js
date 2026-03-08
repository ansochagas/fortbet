// Autenticação mock baseada nos seeds. Futura integração pode substituir
// por backend/token, mantendo a mesma API local.
import { seedUsuarios } from "./seed";

const STORAGE_KEY = "fortbet_user_role";

let currentUser = (() => {
  if (typeof window !== "undefined") {
    try {
      const savedRole = localStorage.getItem(STORAGE_KEY);
      if (savedRole) {
        const found = seedUsuarios.find((u) => u.papel === savedRole);
        if (found) return found;
      }
    } catch {
      /* ignore */
    }
  }
  return seedUsuarios.find((u) => u.papel === "admin") || null;
})();

export const getCurrentUser = () => currentUser;

export const signInAs = (papel) => {
  const found = seedUsuarios.find((u) => u.papel === papel);
  currentUser = found || currentUser;
  if (typeof window !== "undefined") {
    try {
      if (currentUser?.papel) {
        localStorage.setItem(STORAGE_KEY, currentUser.papel);
      }
    } catch {
      /* ignore */
    }
  }
  return currentUser;
};

export const signOut = () => {
  currentUser = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
};

export const hasRole = (papel) => currentUser?.papel === papel;
