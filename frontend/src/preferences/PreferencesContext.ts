import { createContext, type Dispatch, type SetStateAction } from "react";
import type { Language, Theme } from "../types/preferences";

type Preferences = {
  lang: Language;
  setLang: Dispatch<SetStateAction<Language>>;
  theme: Theme;
  toggleTheme: () => void;
};

export const PreferencesContext = createContext<Preferences | null>(null);
