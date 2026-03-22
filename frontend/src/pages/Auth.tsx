import { type FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { queryKeys } from "@/api/query-keys";
import { authService } from "@/api/services/auth";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

const CODE_TTL_FALLBACK_SEC = 600;

const AuthPage = () => {
  const { login, register, requestCode, verifyCode, canUseDevSession, startDevSession } = useAuth();
  const { toast } = useToast();

  const [authMode, setAuthMode] = useState<"credentials" | "email">("credentials");
  const [credentialsMode, setCredentialsMode] = useState<"login" | "register">("login");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationFullName, setRegistrationFullName] = useState("");
  const [registrationDormitoryId, setRegistrationDormitoryId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [expiresInSec, setExpiresInSec] = useState<number>(CODE_TTL_FALLBACK_SEC);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadlineMinutes = useMemo(() => Math.ceil(expiresInSec / 60), [expiresInSec]);
  const normalizedRegistrationEmail = registrationEmail.trim().toLowerCase();
  const registrationDormitoriesQuery = useQuery({
    queryKey: queryKeys.authDormitories(normalizedRegistrationEmail),
    queryFn: () => authService.getRegistrationDormitories(normalizedRegistrationEmail),
    enabled: credentialsMode === "register" && normalizedRegistrationEmail.length >= 3,
    retry: false,
  });

  const sendCode = async (targetEmail: string) => {
    const result = await requestCode(targetEmail);
    setExpiresInSec(result.expiresInSec || CODE_TTL_FALLBACK_SEC);
    setStep("code");
    return result;
  };

  const handleCredentialsSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      setError("Введите логин");
      return;
    }

    if (!password.trim()) {
      setError("Введите пароль");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await login(normalizedUsername, password);

      toast({
        title: "Вход выполнен",
        description: "Сессия создана, продолжаем настройку профиля.",
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Не удалось выполнить вход";
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

  const handleRegisterSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedEmail = registrationEmail.trim();
    const normalizedUsername = username.trim();

    if (!normalizedEmail) {
      setError("Введите email");
      return;
    }

    if (!normalizedUsername) {
      setError("Введите логин");
      return;
    }

    if (password.trim().length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }

    if (!registrationDormitoryId) {
      setError("Выберите общежитие");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await register(normalizedEmail, normalizedUsername, password, registrationDormitoryId, registrationFullName);

      toast({
        title: "Регистрация завершена",
        description: "Аккаунт создан, вы уже вошли в систему и можете пользоваться приложением.",
      });
    } catch (registerError) {
      const message = registerError instanceof Error ? registerError.message : "Не удалось зарегистрироваться";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Введите email");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sendCode(normalizedEmail);

      toast({
        title: "Код отправлен",
        description: "Проверьте почту и введите код подтверждения.",
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Не удалось отправить код";
      setError(message);
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

  const handleResendCode = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Введите email");
      setStep("email");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sendCode(normalizedEmail);
      toast({
        title: "Новый код отправлен",
        description: "Проверьте почту и используйте последнее письмо.",
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Не удалось отправить код";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
      <div className="w-full max-w-md card-surface p-6 md:p-7">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">DX</span>
            </div>
            <span className="font-semibold text-foreground text-[15px]">dormex</span>
          </Link>

          <h1 className="text-xl font-semibold text-foreground mt-4">Авторизация</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {authMode === "credentials"
              ? credentialsMode === "login"
                ? "Войдите по логину и паролю."
                : "Создайте аккаунт по email, логину и паролю."
              : step === "email"
                ? "Введите email, мы отправим код подтверждения."
                : `Код действителен около ${deadlineMinutes} мин.`}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode("credentials");
              setError(null);
            }}
            className={`h-10 rounded-md text-sm transition-colors ${authMode === "credentials" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Логин и пароль
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("email");
              setError(null);
            }}
            className={`h-10 rounded-md text-sm transition-colors ${authMode === "email" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Код по почте
          </button>
        </div>

        {authMode === "credentials" ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1">
              <button
                type="button"
                onClick={() => {
                  setCredentialsMode("login");
                  setError(null);
                }}
                className={`h-10 rounded-md text-sm transition-colors ${credentialsMode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => {
                  setCredentialsMode("register");
                  setError(null);
                }}
                className={`h-10 rounded-md text-sm transition-colors ${credentialsMode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Регистрация
              </button>
            </div>

            <form className="space-y-4" onSubmit={credentialsMode === "login" ? handleCredentialsSubmit : handleRegisterSubmit}>
              {credentialsMode === "register" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={registrationEmail}
                      onChange={(event) => {
                        setRegistrationEmail(event.target.value);
                        setRegistrationDormitoryId(null);
                        if (error) setError(null);
                      }}
                      placeholder="student@university.edu"
                      className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Общежитие</label>
                    <select
                      value={registrationDormitoryId ?? ""}
                      onChange={(event) => {
                        setRegistrationDormitoryId(event.target.value ? Number(event.target.value) : null);
                        if (error) setError(null);
                      }}
                      disabled={!normalizedRegistrationEmail || registrationDormitoriesQuery.isLoading || registrationDormitoriesQuery.isError}
                      className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">
                        {!normalizedRegistrationEmail
                          ? "Сначала введите email"
                          : registrationDormitoriesQuery.isLoading
                            ? "Загружаем общежития..."
                            : "Выберите общежитие"}
                      </option>
                      {(registrationDormitoriesQuery.data ?? []).map((dormitory) => (
                        <option key={dormitory.id} value={dormitory.id}>{dormitory.name}</option>
                      ))}
                    </select>

                    {registrationDormitoriesQuery.isError && (
                      <div className="mt-2 text-xs text-destructive">
                        Не удалось загрузить общежития для этого email.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Имя</label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={registrationFullName}
                      onChange={(event) => {
                        setRegistrationFullName(event.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Иван Иванов"
                      className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Логин</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="your_login"
                  className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Пароль</label>
                <input
                  type="password"
                  autoComplete={credentialsMode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={credentialsMode === "login" ? "Введите пароль" : "Минимум 8 символов"}
                  className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (credentialsMode === "login" ? "Входим..." : "Создаём аккаунт...") : (credentialsMode === "login" ? "Войти" : "Зарегистрироваться")}
              </button>

              {canUseDevSession && credentialsMode === "login" && (
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
          </>
        ) : step === "email" ? (
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
              <p className="mt-1 break-all text-[11px] text-muted-foreground">Код отправлен на {email}</p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              type="button"
              onClick={handleResendCode}
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Отправляем..." : "Отправить код ещё раз"}
            </button>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="h-11 px-4 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors sm:w-auto"
              >
                Изменить email
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed sm:flex-1"
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
