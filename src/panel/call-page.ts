import { escapeHtml } from "./layout.js";

export type CallPageSession = {
  token: string;
  callerName: string;
  avatarUrl: string;
  videoUrl: string;
  locale: string;
  status: string;
};

const COPY = {
  "pt-BR": {
    ringing: (name: string) => `${name} está te ligando...`,
    decline: "Recusar",
    accept: "Atender",
    ended: "Chamada encerrada",
    invalid: "Este link de chamada não está mais disponível.",
    videoEnded: "Chamada finalizada",
    videoError: "Não foi possível carregar o vídeo. Tente de novo.",
    loading: "Conectando..."
  },
  "en-US": {
    ringing: (name: string) => `${name} is calling you...`,
    decline: "Decline",
    accept: "Accept",
    ended: "Call ended",
    invalid: "This call link is no longer available.",
    videoEnded: "Call finished",
    videoError: "Could not load the video. Please try again.",
    loading: "Connecting..."
  }
} as const;

function t(locale: string) {
  return COPY[locale === "en-US" ? "en-US" : "pt-BR"];
}

export function renderCallPage(session: CallPageSession) {
  const loc = session.locale === "en-US" ? "en-US" : "pt-BR";
  const copy = t(loc);
  const invalid =
    session.status === "expired" ||
    session.status === "declined" ||
    (!session.videoUrl && session.status !== "accepted");
  const name = escapeHtml(session.callerName || "OnlyChat");
  const avatar = session.avatarUrl?.trim() ? escapeHtml(session.avatarUrl) : "/brand/pwa-192.png";
  const videoUrl = escapeHtml(session.videoUrl || "");
  const token = escapeHtml(session.token);
  const ringingText = escapeHtml(copy.ringing(session.callerName || "OnlyChat"));

  if (invalid && session.status !== "accepted") {
    return `<!doctype html>
<html lang="${loc}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#050505" />
  <title>${escapeHtml(copy.ended)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100dvh;background:#050505;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
    p{opacity:.85;line-height:1.5}
  </style>
</head>
<body><p>${escapeHtml(copy.invalid)}</p></body>
</html>`;
  }

  return `<!doctype html>
<html lang="${loc}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#050505" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <title>${name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;background:#000;color:#fff;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}
    .screen{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:max(24px,env(safe-area-inset-top)) 24px max(32px,env(safe-area-inset-bottom))}
    .screen--hidden{display:none !important}
    .avatar{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.15);box-shadow:0 0 40px rgba(10,92,255,.35)}
    .name{margin-top:20px;font-size:1.35rem;font-weight:600}
    .status{margin-top:8px;font-size:1rem;opacity:.75}
    .actions{margin-top:auto;display:flex;gap:48px;align-items:center;padding-bottom:12px}
    .btn{width:72px;height:72px;border-radius:50%;border:none;color:#fff;font-size:.75rem;font-weight:600;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
    .btn span{font-size:.7rem;opacity:.9}
    .btn--decline{background:#ff3b30;box-shadow:0 8px 24px rgba(255,59,48,.35)}
    .btn--accept{background:#34c759;box-shadow:0 8px 24px rgba(52,199,89,.35)}
    .pulse{animation:pulse 1.2s ease-in-out infinite}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
    #video-screen{background:#000;padding:0}
    #call-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000}
    .video-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);font-size:1.1rem;text-align:center;padding:24px;z-index:2}
    .video-overlay.hidden{display:none !important}
  </style>
</head>
<body>
  <div id="ringing-screen" class="screen">
    <img class="avatar pulse" src="${avatar}" alt="" />
    <div class="name">${name}</div>
    <div class="status" id="ringing-label">${ringingText}</div>
    <div class="actions">
      <button type="button" class="btn btn--decline" id="btn-decline"><span>${escapeHtml(copy.decline)}</span></button>
      <button type="button" class="btn btn--accept" id="btn-accept"><span>${escapeHtml(copy.accept)}</span></button>
    </div>
  </div>
  <div id="video-screen" class="screen screen--hidden">
    <video id="call-video" playsinline webkit-playsinline preload="auto" controlsList="nodownload"></video>
    <div id="video-loading" class="video-overlay">${escapeHtml(copy.loading)}</div>
    <div id="video-ended" class="video-overlay hidden">${escapeHtml(copy.videoEnded)}</div>
    <div id="video-error" class="video-overlay hidden">${escapeHtml(copy.videoError)}</div>
  </div>
  <audio id="ringtone" loop preload="auto">
    <source src="/call-assets/ringtone.mp3" type="audio/mpeg" />
  </audio>
  <script>
  (function(){
    var token = ${JSON.stringify(token)};
    var videoSrc = ${JSON.stringify(session.videoUrl || "")};
    var ringing = document.getElementById("ringing-screen");
    var videoScreen = document.getElementById("video-screen");
    var video = document.getElementById("call-video");
    var ringtone = document.getElementById("ringtone");
    var ended = document.getElementById("video-ended");
    var loading = document.getElementById("video-loading");
    var errEl = document.getElementById("video-error");
    var started = false;

    function vibrate(){ try{ if(navigator.vibrate) navigator.vibrate([400,200,400,200,400]); }catch(_){} }
    function playRing(){
      vibrate();
      if(ringtone){ ringtone.volume = 0.85; ringtone.play().catch(function(){}); }
    }
    function stopRing(){ if(ringtone){ ringtone.pause(); ringtone.currentTime = 0; } }
    function hide(el){ if(el) el.classList.add("hidden"); }
    function show(el){ if(el) el.classList.remove("hidden"); }

    playRing();

    document.getElementById("btn-decline").addEventListener("click", function(){
      stopRing();
      fetch("/call/" + encodeURIComponent(token) + "/decline", { method: "POST" }).catch(function(){});
      ringing.innerHTML = "<p style=\\"opacity:.8;padding:24px\\">${escapeHtml(copy.ended)}</p>";
    });

    document.getElementById("btn-accept").addEventListener("click", function(){
      stopRing();
      fetch("/call/" + encodeURIComponent(token) + "/accept", { method: "POST" }).catch(function(){});
      ringing.classList.add("screen--hidden");
      videoScreen.classList.remove("screen--hidden");
      hide(ended);
      hide(errEl);
      show(loading);
      if(!videoSrc){
        hide(loading);
        show(errEl);
        return;
      }
      video.src = videoSrc;
      video.load();
      var tryPlay = function(){
        video.muted = false;
        var p = video.play();
        if(p && p.then){
          p.then(function(){ hide(loading); started = true; }).catch(function(){
            video.muted = true;
            video.play().then(function(){ hide(loading); started = true; }).catch(function(){
              hide(loading);
              show(errEl);
            });
          });
        }
      };
      if(video.readyState >= 2) tryPlay();
      else video.addEventListener("loadeddata", tryPlay, { once: true });
    });

    if(video){
      video.addEventListener("playing", function(){ hide(loading); started = true; });
      video.addEventListener("ended", function(){
        if(!started) return;
        show(ended);
      });
      video.addEventListener("error", function(){
        hide(loading);
        show(errEl);
      });
    }
  })();
  </script>
</body>
</html>`;
}
