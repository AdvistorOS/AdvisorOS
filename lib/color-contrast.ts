// Given a hex background color, returns whether text on top of it should be
// light or dark, based on the color's actual perceived brightness (luminance).
export function getContrastText(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Standard relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#16241F" : "#FFFFFF";
}

// A slightly muted version of the contrast color, for secondary text
export function getContrastMuted(hexColor: string): string {
  const isDark = getContrastText(hexColor) === "#FFFFFF";
  return isDark ? "rgba(255,255,255,0.65)" : "rgba(22,36,31,0.65)";
}
