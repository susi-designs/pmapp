import { render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Renders with the providers from layout.tsx. */
export function renderWithProviders(ui: React.ReactNode) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>{ui}</TooltipProvider>
      <Toaster />
    </ThemeProvider>,
  );
}
