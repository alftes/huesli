/* Thema früh setzen (kein Aufblitzen) – Kladde: data-theme="light" | "dark" */
try { var t = localStorage.getItem("huesli-thema"); if (t === "hell" || t === "dunkel") document.documentElement.dataset.theme = t === "hell" ? "light" : "dark"; } catch (e) {}
