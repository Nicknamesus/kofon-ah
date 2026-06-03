// Admin shell: live notification bell (SSE) + toasts + delete confirmation.
// Vanilla JS on purpose — no CDN/build step (the host is in China).

(function () {
  "use strict";

  const badge = document.getElementById("notif-badge");
  let unread = 0;

  function setBadge(n) {
    unread = Math.max(0, n);
    if (!badge) return;
    if (unread > 0) {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function toast(ev) {
    const area = document.getElementById("toast-area");
    if (!area) return;
    const el = document.createElement("div");
    el.className = "toast";
    const kind = (ev.kind || "").replace("_", " ");
    el.innerHTML =
      '<div class="t-kind">' + kind + "</div>" +
      "<div>" + (ev.summary || "New notification") + "</div>" +
      '<div class="muted" style="margin-top:6px"><a href="/admin/notifications">View all</a></div>';
    area.appendChild(el);
    setTimeout(function () { el.remove(); }, 8000);
  }

  // Only run the live feed if the bell is present (i.e. user can read notifications).
  if (badge !== null || document.getElementById("bell")) {
    // Initial unread count.
    fetch("/admin/api/notifications/unread_count", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (d) { setBadge(d.count || 0); })
      .catch(function () {});

    try {
      const es = new EventSource("/admin/api/notifications/stream", { withCredentials: true });
      const seen = new Set();
      es.addEventListener("notification", function (e) {
        let data;
        try { data = JSON.parse(e.data); } catch (_) { return; }
        if (data.id && seen.has(data.id)) return;
        if (data.id) seen.add(data.id);
        // Replayed unread items are already counted by unread_count; only
        // toast + increment for genuinely new (non-replay) events.
        if (!data.replay) {
          setBadge(unread + 1);
          toast(data);
        }
      });
      es.onerror = function () { /* browser auto-reconnects */ };
    } catch (_) { /* SSE unsupported */ }
  }

  // Confirm before any form with data-confirm submits.
  document.addEventListener("submit", function (e) {
    const f = e.target;
    if (f && f.dataset && f.dataset.confirm) {
      if (!window.confirm(f.dataset.confirm)) {
        e.preventDefault();
      }
    }
  });
})();
