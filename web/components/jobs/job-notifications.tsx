"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";

interface JobNotification {
  id: string;
  type: "image" | "video" | "audio";
  status: "pending" | "processing" | "complete" | "failed";
  feature?: string;
  created_at: string;
}

interface JobNotificationsContextValue {
  jobs: JobNotification[];
  unseenCount: number;
  markAllSeen: () => void;
  isLoading: boolean;
}

const JobNotificationsContext = createContext<JobNotificationsContextValue | null>(null);

const STORAGE_KEY = "renderstudio_seen_jobs";

function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

export function JobNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<JobNotification[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const previousJobsRef = useRef<JobNotification[]>([]);
  const initialLoadDone = useRef(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { jobs: JobNotification[] };
      const previous = initialLoadDone.current ? previousJobsRef.current : [];
      const previousById = new Map(previous.map((j) => [j.id, j]));

      previousJobsRef.current = data.jobs;
      setJobs(data.jobs);
      setIsLoading(false);
      initialLoadDone.current = true;

      // Toasts uniquement pour les jobs qui viennent de passer à complete.
      for (const job of data.jobs) {
        if (job.status !== "complete") continue;
        const prev = previousById.get(job.id);
        if (!prev || prev.status !== "complete") {
          const label = job.type === "video" ? "Video generation" : "Render";
          toast.success(`${label} complete`, {
            description: "Your result is ready in Projects.",
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/app/projects";
              },
            },
          });
        }
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    setSeenIds(readSeenIds());
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const completedIds = useMemo(
    () => new Set(jobs.filter((j) => j.status === "complete").map((j) => j.id)),
    [jobs]
  );
  const unseenCount = Array.from(completedIds).filter((id) => !seenIds.has(id)).length;

  const markAllSeen = useCallback(() => {
    const next = new Set(seenIds);
    Array.from(completedIds).forEach((id) => next.add(id));
    setSeenIds(next);
    writeSeenIds(next);
  }, [completedIds, seenIds]);

  return (
    <JobNotificationsContext.Provider value={{ jobs, unseenCount, markAllSeen, isLoading }}>
      {children}
    </JobNotificationsContext.Provider>
  );
}

export function useJobNotifications() {
  const ctx = useContext(JobNotificationsContext);
  if (!ctx) {
    throw new Error("useJobNotifications must be used within JobNotificationsProvider");
  }
  return ctx;
}
