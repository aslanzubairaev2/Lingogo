import React, { useMemo } from "react";
import { useTranslation } from "../src/hooks/useTranslation.ts";
import type { LanguageCode } from "../../types.ts";
import {
  LOCALIZATION_STEPS,
  type LocalizationPhase,
  type LocalizationStep,
} from "../src/i18n/localizationPhases.ts";
import { getLanguageName } from "../src/i18n/languageMeta.ts";

interface LocalizationOverlayProps {
  visible: boolean;
  phase: LocalizationPhase;
  languageCode: LanguageCode;
}

const indicatorStyles: Record<"completed" | "active" | "pending", string> = {
  completed: "bg-emerald-500 text-slate-950 border-emerald-400",
  active: "bg-cyan-500 text-slate-950 border-cyan-300 animate-pulse",
  pending: "bg-transparent text-slate-400 border-slate-600",
};

const LocalizationOverlay: React.FC<LocalizationOverlayProps> = ({
  visible,
  phase,
  languageCode,
}) => {
  const { t } = useTranslation();

  const languageName = getLanguageName(languageCode);

  const steps = useMemo(() => {
    const currentIndex = LOCALIZATION_STEPS.indexOf(phase as LocalizationStep);
    return LOCALIZATION_STEPS.map((step, index) => {
      let status: "completed" | "active" | "pending" = "pending";
      if (phase === "fallback" || phase === "idle") {
        status = "pending";
      } else if (phase === "completed") {
        status = "completed";
      } else if (currentIndex !== -1) {
        if (index < currentIndex) {
          status = "completed";
        } else if (index === currentIndex) {
          status = "active";
        }
      }
      return { step, status };
    });
  }, [phase]);

  if (!visible) {
    return null;
  }

  const isFallback = phase === "fallback";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800/80 bg-slate-900/90 p-6 shadow-2xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            {t("localization.overlay.heading")}
          </p>
          <h2 className="text-xl font-semibold text-slate-100">
            {t("localization.overlay.title", { language: languageName })}
          </h2>
          <p className="text-sm text-slate-400">
            {isFallback
              ? t("localization.overlay.fallbackDescription")
              : t("localization.overlay.subtitle", { language: languageName })}
          </p>
        </div>

        <div className="space-y-4">
          <div className="h-full scroll">
            {steps.map(({ step, status }) => (
              <div key={step} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${indicatorStyles[status]}`}
                  aria-hidden="true"
                >
                  {status === "completed"
                    ? "✓"
                    : status === "active"
                      ? "•"
                      : ""}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {t(`localization.overlay.steps.${step}`)}
                  </p>
                  {status === "active" && (
                    <p className="text-xs text-cyan-300">
                      {t("localization.overlay.currentStepHint")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isFallback && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {t("localization.overlay.fallbackMessage", {
              language: languageName,
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocalizationOverlay;
