// Tracking script — add to your site's <head> or before </body>
// Replace TRACKER_URL with your deployed backend URL

(function () {
  var ua = navigator.userAgent;
  var screen = screen.width + "x" + screen.height;
  var lang = navigator.language || navigator.userLanguage || "";
  var referrer = document.referrer || "";
  var href = window.location.href;

  var payload = JSON.stringify({ ua: ua, screen: screen, lang: lang, referrer: referrer, href: href });

  // Use sendBeacon if available (doesn't block page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon("TRACKER_URL/api/track", payload);
  } else {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "TRACKER_URL/api/track", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(payload);
  }
})();
