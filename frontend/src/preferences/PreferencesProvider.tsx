import { useEffect, useState, type ReactNode } from "react";
import type { Language, Theme } from "../types/preferences";
import { PreferencesContext } from "./PreferencesContext";

const LANGUAGE_STORAGE_KEY = "haus-sampaio-language";
const THEME_STORAGE_KEY = "haus-sampaio-theme";
const THEME_COLORS: Record<Theme, string> = {
  dark: "#181817",
  light: "#f5efe3",
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "PT" ? "PT" : "EN";
    } catch {
      return "EN";
    }
  });
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.lang = lang.toLowerCase();
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      /* Language switching remains available without storage. */
    }
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Private mode */
    }
  }

  return (
    <PreferencesContext.Provider value={{ lang, setLang, theme, toggleTheme }}>
      {children}
    </PreferencesContext.Provider>
  );
}
