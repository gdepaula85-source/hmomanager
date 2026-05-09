/* ─────────────────────────────────────────────────────────────────────────────
 * Meta (Facebook) Pixel — shared loader.
 *
 * Pixel ID lives in ONE place (the constant below). Update here and the change
 * propagates to every marketing page that includes /js/meta-pixel.js.
 *
 * Each marketing page also embeds a <noscript> 1×1 fallback img inline (Meta
 * requires it to live in HTML, not JS). If you rotate the pixel ID, also
 * update the URL in the <noscript> tag in each public/*.html.
 *
 * NOT included on: login.html, superadmin.html, onboard.html,
 * tenant-portal.html, sign.html, set-password.html, landlordapp_emails.html
 * — these collect/display tenant PII or are signed-in surfaces; we don't
 * want marketing pixels firing there.
 * ───────────────────────────────────────────────────────────────────────── */
(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = !0;
  n.version = '2.0';
  n.queue = [];
  t = b.createElement(e);
  t.async = !0;
  t.src = v;
  s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

var FB_PIXEL_ID = '803171412588697';
fbq('init', FB_PIXEL_ID);
fbq('track', 'PageView');
