import React, { createContext, useContext, useMemo, useState } from "react";
import { darkColors, lightColors, type ThemeColors } from "./colors";

type ThemeContextValue = {
  colors: ThemeColors;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);
  const value = useMemo(
    () => ({
      colors: darkMode ? darkColors : lightColors,
      darkMode,
      setDarkMode,
    }),
    [darkMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
