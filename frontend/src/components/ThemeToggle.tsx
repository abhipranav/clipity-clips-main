import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { useTheme } from "./ThemeProvider";

// Sun icon for light mode
function SunIcon({ size = 20 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

// Moon icon for dark mode
function MoonIcon({ size = 20 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

// Monitor icon for system preference
function SystemIcon({ size = 20 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

interface ThemeToggleProps {
  variant?: "icon" | "segmented" | "dropdown";
  size?: "sm" | "md" | "lg";
}

export function ThemeToggle({ variant = "icon", size = "md" }: ThemeToggleProps): ReactElement {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  const sizeClasses = {
    sm: { button: "32px", icon: 16 },
    md: { button: "40px", icon: 20 },
    lg: { button: "48px", icon: 24 },
  };

  const { button: buttonSize, icon: iconSize } = sizeClasses[size];

  // Simple icon button that toggles between light/dark
  if (variant === "icon") {
    return (
      <motion.button
        onClick={toggleTheme}
        className="theme-toggle"
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        title={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: "var(--radius-md)",
          background: "var(--color-surface-solid)",
          border: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <motion.div
          initial={false}
          animate={{ rotate: resolvedTheme === "dark" ? 360 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {resolvedTheme === "light" ? (
            <SunIcon size={iconSize} />
          ) : (
            <MoonIcon size={iconSize} />
          )}
        </motion.div>
      </motion.button>
    );
  }

  // Segmented control with all three options
  if (variant === "segmented") {
    const options: { value: "light" | "dark" | "system"; icon: typeof SunIcon; label: string }[] = [
      { value: "light", icon: SunIcon, label: "Light" },
      { value: "dark", icon: MoonIcon, label: "Dark" },
      { value: "system", icon: SystemIcon, label: "Auto" },
    ];

    return (
      <div
        className="theme-segmented"
        style={{
          display: "flex",
          gap: "2px",
          padding: "4px",
          background: "var(--color-bg-tertiary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = theme === option.value;

          return (
            <motion.button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`theme-option ${isActive ? "active" : ""}`}
              whileTap={{ scale: 0.95 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: size === "sm" ? "4px 8px" : size === "md" ? "6px 12px" : "8px 16px",
                borderRadius: "calc(var(--radius-md) - 2px)",
                background: isActive ? "var(--color-surface-solid)" : "transparent",
                border: "none",
                color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)",
                fontSize: size === "sm" ? "12px" : size === "md" ? "13px" : "14px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
              }}
            >
              <Icon size={size === "sm" ? 14 : size === "md" ? 16 : 18} />
              {option.label}
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Dropdown variant (simplified)
  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
      className="theme-dropdown"
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-solid)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        fontSize: "14px",
        cursor: "pointer",
      }}
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
