import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface LogStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "primary" | "accent" | "success" | "warning" | "destructive";
}

const variantStyles = {
  default: "bg-card border border-border",
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-white",
  destructive: "bg-destructive text-destructive-foreground",
};

const iconBgStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary-foreground/20 text-primary-foreground",
  accent: "bg-accent-foreground/15 text-accent-foreground",
  success: "bg-white/20 text-white",
  warning: "bg-white/15 text-white",
  destructive: "bg-destructive-foreground/20 text-destructive-foreground",
};

export function LogStatCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: LogStatCardProps) {
  return (
    <div className={cn("rounded-xl p-3 sm:p-5 shadow-sm animate-fade-in", variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
          <p className={cn("text-[10px] sm:text-xs font-medium uppercase tracking-wider truncate", variant === "default" ? "text-muted-foreground" : "opacity-80")}>
            {title}
          </p>
          <p className="text-lg sm:text-2xl font-bold">{value}</p>
          {subtitle && (
            <p className={cn("text-[10px] sm:text-xs truncate", variant === "default" ? "text-muted-foreground" : "opacity-70")}>{subtitle}</p>
          )}
          {trend && (
            <p className={cn("text-xs font-medium", trend.positive ? "text-emerald-500" : "text-destructive")}>
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0", iconBgStyles[variant])}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
}
