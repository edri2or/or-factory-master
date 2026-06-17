## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — ניקוי: הסרת קבצי-הספייק של ה-walking-skeleton

לאחר שהטיפוס נבנה והוכח (שלבים 0–5), קבצי-הניסוי (spike) של ה-walking-skeleton אינם נחוצים
עוד — הם הוחלפו ע"י התבניות + ה-provisioner (`templates/agent-repo/` + `provision-agent-repo.yml`).

- **נמחקו:** `spikes/agent-skeleton/agent-main.yml`, `spikes/agent-skeleton/cred-probe.yml`,
  `.github/workflows/agent-skeleton-seed.yml` (ה-seed הזמני שיצר+זרע את ריפויי-ה-`zz-`).
- **`monitoring/registry-exempt.txt`** — רשומת ה-`agent-skeleton-seed.yml` הפכה ל-tombstone
  (השורה נשמרת בכוונה כדי ששער ה-watchdog-registry יישאר מרוצה למחיקה; אין קובץ חי בשם הזה).

לא נגעתי ב-3 ריפויי ה-`zz-` הזמניים (`zz-agentskel-worker`/`-requester`, `zz-agentrepo-prov1`) —
לבקשת Or הם נשארים בינתיים (מחיקתם דרך אישור-טלגרם מתי שיבחר). הקבצים ההיסטוריים (changelog
fragments, capability-card, devplan) שמזכירים את הספייק נשמרים כתיעוד-אמת של ההוכחה. אין נגיעה
ב-`templates/system/**` ולא בקבצי-התנהגות-בוט-n8n.
