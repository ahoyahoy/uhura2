"use client";

import { useEffect } from "react";

export function useScreenBg(variant: "white" | "tinted") {
  useEffect(() => {
    const cls = variant === "tinted" ? "screen-tinted" : "screen-white";
    document.body.classList.remove("screen-white", "screen-tinted");
    document.body.classList.add(cls);
    return () => {
      document.body.classList.remove(cls);
    };
  }, [variant]);
}
