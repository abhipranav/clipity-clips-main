import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "clipity-theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return null;
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage not available
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = "system" }: ThemeProviderProps): ReactElement {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    const stored = getStoredTheme();
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return getSystemTheme();
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (theme === "system") {
      root.removeAttribute("data-theme");
      const systemTheme = getSystemTheme();
      setResolvedTheme(systemTheme);
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", systemTheme === "dark" ? "#0A0A09" : "#F8F7F4");
      }
    } else {
      root.setAttribute("data-theme", theme);
      setResolvedTheme(theme);
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", theme === "dark" ? "#0A0A09" : "#F8F7F4");
      }
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e: MediaQueryListEvent): void => {
      setResolvedTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme): void => {
    setThemeState(newTheme);
    storeTheme(newTheme);
  }, []);

  const toggleTheme = useCallback((): void => {
    const current = resolvedTheme;
    const next = current === "light" ? "dark" : "light";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
