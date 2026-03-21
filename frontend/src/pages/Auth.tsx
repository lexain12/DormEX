import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

const CODE_TTL_FALLBACK_SEC = 600;

const AuthPage = () => {
  const { requestCode, verifyCode, canUseDevSession, startDevSession } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [expiresInSec, setExpiresInSec] = useState<number>(CODE_TTL_FALLBACK_SEC);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadlineMinutes = useMemo(() => Math.ceil(expiresInSec / 60), [expiresInSec]);

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Введите университетский email");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await requestCode(normalizedEmail);
      setExpiresInSec(result.expiresInSec || CODE_TTL_FALLBACK_SEC);
      setStep("code");

      toast({
        title: "Код отправлен",
        description: "Проверьте почту и введите код подтверждения.",
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Не удалось отправить код";
      setError(message);

      if (canUseDevSession) {
        toast({
          title: "Auth endpoint пока недоступен",
          description: "Можно войти через dev-режим и проверить остальной функционал.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedCode = code.trim();

    if (!normalizedCode) {
      setError("Введите код подтверждения");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await verifyCode(email.trim(), normalizedCode);

      toast({
        title: "Вход выполнен",
        description: "Сессия создана, продолжаем настройку профиля.",
      });
    } catch (verifyError) {
      const message = verifyError instanceof Error ? verifyError.message : "Не удалось подтвердить код";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-md card-surface p-6 md:p-7">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">DH</span>
            </div>
            <span className="font-semibold text-foreground text-[15px]">DormHub</span>
          </Link>

          <h1 className="text-xl font-semibold text-foreground mt-4">Вход по университетской почте</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "email"
              ? "Введите email, мы отправим код подтверждения."
              : `Код действителен около ${deadlineMinutes} мин.`}
          </p>
        </div>

        {step === "email" ? (
          <form className="space-y-4" onSubmit={handleEmailSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="student@university.edu"
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Отправляем..." : "Получить код"}
            </button>

            {canUseDevSession && (
              <button
                type="button"
                onClick={() => {
                  startDevSession();
                  toast({
                    title: "Dev-сессия активирована",
                    description: "Вход выполнен для локальной проверки UI и API-интеграции.",
                  });
                }}
                className="w-full h-11 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
              >
                Войти для локальной проверки
              </button>
            )}
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleCodeSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Код подтверждения</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="123456"
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Код отправлен на {email}</p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="h-11 px-4 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
              >
                Изменить email
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Проверяем..." : "Подтвердить"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
