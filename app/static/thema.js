/* Thema früh setzen (kein Aufblitzen) */
try { var t = localStorage.getItem("huesli-thema"); if (t) document.documentElement.dataset.thema = t; } catch (e) {}
