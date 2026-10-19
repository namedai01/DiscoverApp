"use client";

import { useEffect } from "react";
import { applyAccent, loadAccent } from "@/lib/accent";

export function AccentInit() {
  useEffect(() => {
    applyAccent(loadAccent());
  }, []);
  return null;
}
