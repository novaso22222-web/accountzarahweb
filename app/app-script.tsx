"use client";

import { useEffect } from "react";

const SCRIPT_ID = "app-main-script";

/**
 * public/script.js-ийг React hydration дууссаны дараа ачаална.
 *
 * script.js-ийн init код нь `document.addEventListener("DOMContentLoaded", ...)`
 * дотор байдаг. Next.js-д энэ event скрипт ачаалагдахаас өмнө аль хэдийн гарчихдаг
 * тул init ажиллахгүй, Нэвтрэх/Бүртгүүлэх товч болон зарууд харагддаггүй байсан.
 * Тиймээс скрипт ачаалагдсаны дараа event-ийг гараар өдөөнө.
 */
export default function AppScript() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const el = document.createElement("script");
    el.id = SCRIPT_ID;
    el.src = "/script.js";
    el.onload = () => {
      document.dispatchEvent(new Event("DOMContentLoaded"));

      // script.js нь Service Worker-ийг window "load" event дээр бүртгэдэг.
      // Тэр event аль хэдийн гарсан тул энд шууд бүртгэнэ.
      if (document.readyState === "complete" && "serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    };
    document.body.appendChild(el);
  }, []);

  return null;
}