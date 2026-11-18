"use client";

import { useEffect, useState } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

type Theme = "system" | "light" | "dark";
const KEY = "rp-theme";

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "system", label: "Match system", icon: Desktop },
  { value: "light", label: "Paper", icon: Sun },
  { value: "dark", label: "Ink", icon: Moon },
];

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/**
 * Follows the system by default; the override is remembered per browser.
 * A small inline script in the root layout applies it before first paint,
 * so there is no flash of the wrong theme.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // Storage can be unavailable in private windows; system theme still works.
    }
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    apply(t);
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      // Not persisted, but applied for this visit.
    }
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-0.5 rounded-md bg-sunken p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            "press flex h-7 items-center justify-center rounded-[5px] text-ink-3",
            theme === value ? "bg-raised text-ink shadow-raised" : "hover:text-ink-2",
          )}
        >
          <Icon size={14} weight={theme === value ? "fill" : "regular"} aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Runs before hydration to apply a saved theme. Kept tiny and dependency-free. */
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
