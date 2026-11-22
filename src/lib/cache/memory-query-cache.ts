"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/api-client";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

// In-memory RAM storage only — strictly zero localStorage / sessionStorage
const memoryStore = new Map<string, CacheEntry<unknown>>();
const subscribers = new Map<string, Set<(data: unknown) => void>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 60_000; // 1 minute default freshness window

/**
 * Retrieve an item from the in-memory cache if available and not expired.
 */
export function getMemoryCache<T>(key: string): T | undefined {
  const entry = memoryStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > entry.ttlMs) {
    memoryStore.delete(key);
    return undefined;
  }
  return entry.data;
}

/**
 * Store an item in the RAM cache and notify active subscribers.
 */
export function setMemoryCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  memoryStore.set(key, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });

  const subs = subscribers.get(key);
  if (subs) {
    subs.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.warn("[memory-cache] Subscriber error:", err);
      }
    });
  }
}

/**
 * Invalidate all cache entries matching a key or prefix (e.g. "/api/properties").
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of memoryStore.keys()) {
    if (key === prefix || key.startsWith(`${prefix}/`) || key.startsWith(`${prefix}?`)) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Completely clear the in-memory cache (invoked on Sign Out).
 */
export function clearMemoryCache(): void {
  memoryStore.clear();
  inFlightRequests.clear();
}

export interface CachedAuthQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isRevalidating: boolean;
  refetch: () => Promise<T | null>;
}

/**
 * Stale-While-Revalidate React Hook for authenticated API routes.
 * - Returns cached data in 0 ms if available (preventing jarring full-page loader freezes)
 * - Concurrently revalidates in the background against the server
 * - Deduplicates simultaneous requests in flight
 */
export function useCachedAuthQuery<T>(
  cacheKey: string | null,
  url: string | null,
  options: { enabled?: boolean; ttlMs?: number } = {}
): CachedAuthQueryResult<T> {
  const { enabled = true, ttlMs = DEFAULT_TTL_MS } = options;

  const initialCached = cacheKey ? getMemoryCache<T>(cacheKey) : undefined;
  const [data, setData] = useState<T | null>(initialCached ?? null);
  const [loading, setLoading] = useState<boolean>(!initialCached && Boolean(url && enabled));
  const [isRevalidating, setIsRevalidating] = useState<boolean>(Boolean(initialCached && url && enabled));
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const executeFetch = useCallback(
    async (forceFresh: boolean = false): Promise<T | null> => {
      if (!url || !cacheKey || !enabled) return null;

      // Check existing cached item unless forcing fresh
      if (!forceFresh) {
        const cached = getMemoryCache<T>(cacheKey);
        if (cached !== undefined) {
          if (isMountedRef.current) {
            setData(cached);
            setLoading(false);
          }
        }
      }

      if (isMountedRef.current) {
        if (!data) setLoading(true);
        else setIsRevalidating(true);
        setError(null);
      }

      // Deduplicate in-flight promises
      let promise = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
      if (!promise) {
        promise = (async () => {
          const res = await authFetch(url);
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${res.status}`);
          }
          const json = await res.json();
          setMemoryCache(cacheKey, json, ttlMs);
          return json as T;
        })().finally(() => {
          inFlightRequests.delete(cacheKey);
        });

        inFlightRequests.set(cacheKey, promise);
      }

      try {
        const result = await promise;
        if (isMountedRef.current) {
          setData(result);
          setLoading(false);
          setIsRevalidating(false);
          setError(null);
        }
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Request failed";
        if (isMountedRef.current) {
          setError(msg);
          setLoading(false);
          setIsRevalidating(false);
        }
        return null;
      }
    },
    [url, cacheKey, enabled, ttlMs, data]
  );

  useEffect(() => {
    if (!cacheKey) return;

    // Subscribe to external updates for this cache key
    let subs = subscribers.get(cacheKey);
    if (!subs) {
      subs = new Set();
      subscribers.set(cacheKey, subs);
    }

    const onUpdate = (freshData: unknown) => {
      if (isMountedRef.current) {
        setData(freshData as T);
        setLoading(false);
        setIsRevalidating(false);
      }
    };
    subs.add(onUpdate);

    return () => {
      subs?.delete(onUpdate);
      if (subs?.size === 0) {
        subscribers.delete(cacheKey);
      }
    };
  }, [cacheKey]);

  useEffect(() => {
    if (enabled && url && cacheKey) {
      executeFetch(false);
    }
  }, [enabled, url, cacheKey, executeFetch]);

  return {
    data,
    loading,
    error,
    isRevalidating,
    refetch: () => executeFetch(true),
  };
}
