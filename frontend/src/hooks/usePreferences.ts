import { useContext } from "react";
import { PreferencesContext } from "../preferences/PreferencesContext";

export function usePreferences() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error("Preferences provider missing");

  return preferences;
}
