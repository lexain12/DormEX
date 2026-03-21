import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { authService } from "@/api/services/auth";
import { queryKeys } from "@/api/query-keys";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user, completeProfile, logout } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [dormitoryId, setDormitoryId] = useState<number | null>(user?.dormitory?.id ?? null);
  const [roomLabel, setRoomLabel] = useState(user?.room_label ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dormitoriesQuery = useQuery({
    queryKey: queryKeys.dormitories,
    queryFn: authService.getDormitories,
  });

  const canSubmit = useMemo(() => {
    return Boolean(fullName.trim() && dormitoryId && !isSubmitting);
  }, [fullName, dormitoryId, isSubmitting]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!fullName.trim()) {
      setError("Введите имя и фамилию");
      return;
    }

    if (!dormitoryId) {
      setError("Выберите общежитие");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await completeProfile({
        full_name: fullName.trim(),
        dormitory_id: dormitoryId,
        room_label: roomLabel.trim() || undefined,
        bio: bio.trim() || undefined,
      });

      toast({
        title: "Профиль сохранён",
        description: "Теперь можно пользоваться биржей задач.",
      });

      navigate("/", { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Не удалось сохранить профиль";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
      <div className="w-full max-w-2xl card-surface p-6 md:p-7">
        <h1 className="text-xl font-semibold text-foreground">Завершите профиль</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Это нужно, чтобы публиковать заявки и общаться внутри вашего университета.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">ФИО</label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Иван Петров"
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Общежитие</label>
            <select
              value={dormitoryId ?? ""}
              onChange={(event) => {
                setDormitoryId(event.target.value ? Number(event.target.value) : null);
                if (error) setError(null);
              }}
              disabled={dormitoriesQuery.isLoading}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Выберите общежитие</option>
              {(dormitoriesQuery.data ?? []).map((dormitory) => (
                <option key={dormitory.id} value={dormitory.id}>{dormitory.name}</option>
              ))}
            </select>

            {dormitoriesQuery.isError && (
              <div className="mt-2 text-xs text-destructive">
                Не удалось загрузить список общежитий.
                <button
                  type="button"
                  onClick={() => void dormitoriesQuery.refetch()}
                  className="ml-2 text-primary hover:text-primary/80"
                >
                  Повторить
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Комната</label>
              <input
                type="text"
                value={roomLabel}
                onChange={(event) => setRoomLabel(event.target.value)}
                placeholder="512"
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">О себе</label>
              <input
                type="text"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Помогаю с доставкой и мелким ремонтом"
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void logout()}
              className="h-11 rounded-lg border border-border px-4 text-sm text-foreground transition-colors hover:bg-accent sm:w-auto"
            >
              Выйти
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? "Сохраняем..." : "Сохранить профиль"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
