"use client";
import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * Shows its children only on the website, not inside the iPhone/Android apps.
 * Used for payment buttons: App Store and Google Play rules limit links to
 * outside payments inside apps (see docs/PAYMENTS.md).
 */
export function WebOnly({ children, allowNative = false, fallback = null }: { children: React.ReactNode; allowNative?: boolean; fallback?: React.ReactNode }) {
  const [native, setNative] = useState<boolean | null>(null);
  useEffect(() => setNative(isNativeApp()), []);
  if (native === null) return null;
  return <>{native && !allowNative ? fallback : children}</>;
}
