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
    invalid: "Esta chamada não está mais disponível.",
    endedTitle: "Essa ligação foi encerrada",
    endedSub: "Você pode fechar esta aba com segurança.",
    inCall: "Em chamada…",
    connecting: "Conectando..."
  },
  "en-US": {
    ringing: (name: string) => `${name} is calling you...`,
    decline: "Decline",
    accept: "Accept",
    ended: "Call ended",
    invalid: "This call is no longer available.",
    endedTitle: "This call has ended",
    endedSub: "You can safely close this tab.",
    inCall: "In call…",
    connecting: "Connecting..."
  }
} as const;

function t(locale: string) {
  return COPY[locale === "en-US" ? "en-US" : "pt-BR"];
}

function endedOnlyPage(loc: string, copy: (typeof COPY)["pt-BR"] | (typeof COPY)["en-US"]) {
  return `<!doctype html>
<html lang="${loc}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#000000" />
  <title>${escapeHtml(copy.ended)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden}
    .wrap{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
    h1{font-size:1.15rem;font-weight:700;margin-bottom:8px}
    p{opacity:.7;font-size:.9rem;line-height:1.4}
  </style>
</head>
<body>
  <div class="wrap"><div><h1>${escapeHtml(copy.endedTitle)}</h1><p>${escapeHtml(copy.endedSub)}</p></div></div>
  <script>
  (function(){
    try { history.pushState(null, "", location.href); } catch(_){}
    window.addEventListener("popstate", function(){ try { history.pushState(null, "", location.href); } catch(_){} });
    window.addEventListener("beforeunload", function(e){ e.preventDefault(); e.returnValue = ""; });
  })();
  </script>
</body>
</html>`;
}

export function renderCallPage(session: CallPageSession) {
  const loc = session.locale === "en-US" ? "en-US" : "pt-BR";
  const copy = t(loc);
  const dead =
    session.status === "expired" ||
    session.status === "declined" ||
    session.status === "ended" ||
    session.status === "accepted" ||
    !session.videoUrl;

  if (dead) {
    return endedOnlyPage(loc, copy);
  }

  const name = escapeHtml(session.callerName || "OnlyChat");
  const rawAvatar = session.avatarUrl?.trim() || "";
  const avatarJs = JSON.stringify(rawAvatar || "/brand/pwa-192.png");
  const videoUrl = JSON.stringify(session.videoUrl || "");
  const token = JSON.stringify(session.token);
  const callerNameJs = JSON.stringify(session.callerName || "OnlyChat");
  const ringingText = escapeHtml(copy.ringing(session.callerName || "OnlyChat"));
  const initial = escapeHtml((session.callerName || "O").trim().charAt(0).toUpperCase() || "O");

  return `<!doctype html>
<html lang="${loc}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
  <meta name="theme-color" content="#000000" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <title>${name}</title>
  ${session.videoUrl ? `<link rel="preload" as="video" href="${escapeHtml(session.videoUrl)}" />` : ""}
  ${rawAvatar && !rawAvatar.startsWith("data:") ? `<link rel="preload" as="image" href="${escapeHtml(rawAvatar)}" />` : ""}
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;-webkit-user-select:none;user-select:none}
    .screen{position:fixed;inset:0}
    .screen--hidden{display:none !important}
    #ringing-screen{
      display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
      padding:max(48px,env(safe-area-inset-top)) 24px max(40px,env(safe-area-inset-bottom));
      background:radial-gradient(ellipse 120% 80% at 50% 20%, #1a3a6e 0%, #0a1528 45%, #000 100%);
    }
    .ring-wrap{position:relative;width:148px;height:148px;margin-top:12vh}
    .ring-pulse,.ring-pulse2{
      position:absolute;inset:0;border-radius:50%;border:2px solid rgba(52,199,89,.35);
      animation:ringPulse 2.2s ease-out infinite;pointer-events:none;
    }
    .ring-pulse2{animation-delay:.7s;border-color:rgba(10,92,255,.3)}
    @keyframes ringPulse{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.55);opacity:0}}
    .avatar-fallback{
      position:absolute;inset:0;z-index:0;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      background:linear-gradient(145deg,#1e4d9c,#0a92ff);font-size:3rem;font-weight:700;color:#fff;
      border:3px solid rgba(255,255,255,.2);
    }
    .avatar{
      position:relative;z-index:1;width:148px;height:148px;border-radius:50%;object-fit:cover;
      border:3px solid rgba(255,255,255,.25);box-shadow:0 12px 40px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.08);
      background:#111;
    }
    .r-name{margin-top:28px;font-size:1.6rem;font-weight:700;letter-spacing:-.02em}
    .r-status{margin-top:8px;font-size:1rem;opacity:.78}
    .r-actions{margin-top:auto;display:flex;gap:56px;align-items:center;padding-bottom:8px}
    .r-btn{
      width:76px;height:76px;border-radius:50%;border:none;color:#fff;cursor:pointer;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
      font-size:.72rem;font-weight:600;
    }
    .r-btn svg{width:28px;height:28px;fill:currentColor}
    .r-btn--decline{background:#ff3b30;box-shadow:0 10px 28px rgba(255,59,48,.4)}
    .r-btn--accept{background:#34c759;box-shadow:0 10px 28px rgba(52,199,89,.4)}
    .stage{position:relative;width:100%;height:100%;display:grid;place-items:center;background:#000}
    video#mainVideo{width:100%;height:100%;object-fit:cover;background:#000}
    video::-webkit-media-controls,video::-webkit-media-controls-enclosure{display:none !important}
    .topbar{position:absolute;top:25px;left:0;right:0;display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:10}
    .pill{pointer-events:auto;background:rgba(0,0,0,.35);padding:6px 14px 6px 6px;border-radius:999px;display:flex;align-items:center;gap:10px;backdrop-filter:blur(8px)}
    .pill-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#222;flex-shrink:0}
    .pill-text{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
    #callerText{font-size:14px;font-weight:600}
    #timerText{font-size:12px;color:#2bffae}
    .controls{
      position:absolute;bottom:30px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:20;
      background:rgba(60,60,60,.8);padding:10px 16px;border-radius:40px;backdrop-filter:blur(20px);
    }
    .btn{
      border:0;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;
      cursor:pointer;background:rgba(255,255,255,.15);color:#fff;transition:all .2s;
    }
    .btn:active{transform:scale(.9)}
    .btn svg{width:16px;height:16px;fill:currentColor}
    .btn-danger{background:#ff3b30}
    .btn-active{background:#fff;color:#000}
    .btn-chat{background:rgba(139,92,246,.8)}
    .btn-chat.active{background:rgba(139,92,246,1)}
    .small{
      position:absolute;right:16px;bottom:90px;width:110px;height:160px;border-radius:14px;overflow:hidden;
      border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);display:none;z-index:25;
    }
    .small video{width:100%;height:100%;object-fit:cover}
    .chat-container{
      position:fixed;bottom:100px;right:20px;left:20px;width:auto;max-width:420px;max-height:calc(100vh - 200px);min-height:280px;
      background:rgba(30,30,30,.95);border-radius:16px;backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);
      display:none;flex-direction:column;z-index:100;box-shadow:0 8px 32px rgba(0,0,0,.4);
    }
    .chat-container.open{display:flex}
    .chat-header{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;align-items:center}
    .chat-title{font-size:16px;font-weight:600}
    .chat-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px}
    .chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:160px}
    .chat-message{padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;max-width:85%;word-wrap:break-word}
    .chat-message.user{background:rgba(139,92,246,.3);border:1px solid rgba(139,92,246,.5);align-self:flex-end}
    .chat-message.other{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);align-self:flex-start}
    .chat-empty{text-align:center;color:rgba(255,255,255,.5);font-size:14px;padding:40px 20px}
    .chat-input-container{padding:14px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;gap:10px}
    .chat-input{flex:1;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:10px 16px;color:#fff;font-size:14px;outline:none}
    .chat-send{background:rgba(139,92,246,.8);border:none;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .chat-send svg{width:20px;height:20px;fill:#fff}
    .overlay{position:absolute;inset:0;display:grid;place-items:center;background:#000;z-index:40}
    .overlay.hidden{display:none !important}
    .overlay-card{text-align:center;padding:24px}
    .overlay-title{font-size:18px;font-weight:800;margin-bottom:8px}
    .overlay-sub{font-size:13px;color:rgba(255,255,255,.75);line-height:1.35}
  </style>
</head>
<body>
  <div id="ringing-screen" class="screen">
    <div class="ring-wrap">
      <div class="ring-pulse" aria-hidden="true"></div>
      <div class="ring-pulse2" aria-hidden="true"></div>
      <div class="avatar-fallback" aria-hidden="true">${initial}</div>
      <img class="avatar" id="ringAvatar" src="/brand/pwa-192.png" alt="" />
    </div>
    <div class="r-name">${name}</div>
    <div class="r-status">${ringingText}</div>
    <div class="r-actions">
      <button type="button" class="r-btn r-btn--decline" id="btn-decline" aria-label="${escapeHtml(copy.decline)}">
        <svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
        <span>${escapeHtml(copy.decline)}</span>
      </button>
      <button type="button" class="r-btn r-btn--accept" id="btn-accept" aria-label="${escapeHtml(copy.accept)}">
        <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
        <span>${escapeHtml(copy.accept)}</span>
      </button>
    </div>
  </div>

  <div id="video-screen" class="screen screen--hidden">
    <div class="stage">
      <div class="topbar">
        <div class="pill">
          <img class="pill-avatar" id="pillAvatar" src="/brand/pwa-192.png" alt="" />
          <div class="pill-text">
            <span id="callerText">${escapeHtml(copy.inCall)}</span>
            <span id="timerText">00:00</span>
          </div>
        </div>
      </div>
      <video id="mainVideo" playsinline webkit-playsinline preload="auto" oncontextmenu="return false;"></video>
      <div class="small" id="selfPreviewWrap">
        <video id="selfPreview" playsinline autoplay muted></video>
      </div>
      <div class="controls">
        <button class="btn" id="micBtn" type="button" title="Microfone">
          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
        </button>
        <button class="btn" id="cameraBtn" type="button" title="Câmera">
          <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
        </button>
        <button class="btn btn-chat" id="chatBtn" type="button" title="Chat">
          <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
        </button>
        <button class="btn btn-danger" id="hangupBtn" type="button" title="Encerrar">
          <svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
        </button>
      </div>
      <div class="chat-container" id="chatContainer">
        <div class="chat-header">
          <div class="chat-title">Chat</div>
          <button class="chat-close" id="chatCloseBtn" type="button">×</button>
        </div>
        <div class="chat-messages" id="chatMessages"><div class="chat-empty">Nenhuma mensagem ainda</div></div>
        <div class="chat-input-container">
          <input type="text" class="chat-input" id="chatInput" placeholder="Diga algo..." autocomplete="off" />
          <button class="chat-send" id="chatSendBtn" type="button">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
      <div class="overlay hidden" id="endedOverlay">
        <div class="overlay-card">
          <div class="overlay-title">${escapeHtml(copy.endedTitle)}</div>
          <div class="overlay-sub">${escapeHtml(copy.endedSub)}</div>
        </div>
      </div>
    </div>
  </div>

  <audio id="ringtone" loop preload="auto">
    <source src="/call-assets/ringtone.mp3" type="audio/mpeg" />
  </audio>

  <script>
  (function(){
    var token = ${token};
    var videoSrc = ${videoUrl};
    var avatarSrc = ${avatarJs};
    var callerName = ${callerNameJs};
    function applyAvatar(){
      var ring = document.getElementById("ringAvatar");
      var pill = document.getElementById("pillAvatar");
      var fb = document.querySelector(".avatar-fallback");
      if(!avatarSrc || avatarSrc === "/brand/pwa-192.png") return;
      if(ring){
        ring.onload = function(){ if(fb) fb.style.display = "none"; };
        ring.onerror = function(){ this.onerror = null; this.src = "/brand/pwa-192.png"; };
        ring.src = avatarSrc;
      }
      if(pill) pill.src = avatarSrc;
    }
    applyAvatar();
    var ringing = document.getElementById("ringing-screen");
    var videoScreen = document.getElementById("video-screen");
    var video = document.getElementById("mainVideo");
    var ringtone = document.getElementById("ringtone");
    var endedOverlay = document.getElementById("endedOverlay");
    var timerText = document.getElementById("timerText");
    var callerText = document.getElementById("callerText");
    var callEnded = false;
    var timerSec = 0;
    var timerId = null;
    var micOn = true;
    var camOn = false;
    var selfStream = null;
    var inCall = false;

    function vibrate(){ try{ if(navigator.vibrate) navigator.vibrate([400,200,400,200,400]); }catch(_){} }
    function playRing(){ vibrate(); if(ringtone){ ringtone.volume=0.85; ringtone.play().catch(function(){}); } }
    function stopRing(){ if(ringtone){ ringtone.pause(); ringtone.currentTime=0; } }
    function pad(n){ return (n<10?"0":"")+n; }
    function tick(){ timerSec++; if(timerText) timerText.textContent = pad(Math.floor(timerSec/60))+":"+pad(timerSec%60); }
    function lockNavigation(){
      try { history.pushState(null, "", location.href); } catch(_){}
      window.addEventListener("popstate", function(){ try { history.pushState(null, "", location.href); } catch(_){} });
    }
    function markEndedOnServer(){
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/call/"+encodeURIComponent(token)+"/end");
          return;
        }
      } catch(_){}
      fetch("/call/"+encodeURIComponent(token)+"/end", { method:"POST", keepalive:true }).catch(function(){});
    }
    function endCall(notifyServer){
      if(callEnded) return;
      callEnded = true;
      stopRing();
      if(timerId) clearInterval(timerId);
      try { if(video){ video.pause(); video.removeAttribute("src"); video.load(); } } catch(_){}
      try { if(selfStream){ selfStream.getTracks().forEach(function(t){ t.stop(); }); } } catch(_){}
      ringing.classList.add("screen--hidden");
      videoScreen.classList.remove("screen--hidden");
      if(endedOverlay) endedOverlay.classList.remove("hidden");
      document.body.style.background = "#000";
      if(notifyServer) markEndedOnServer();
      lockNavigation();
    }

    playRing();
    lockNavigation();

    // Pré-carrega o vídeo em elemento separado — NÃO dispara ended no vídeo principal
    if (videoSrc) {
      var preloadVideo = document.createElement("video");
      preloadVideo.muted = true;
      preloadVideo.preload = "auto";
      preloadVideo.setAttribute("playsinline", "");
      preloadVideo.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
      preloadVideo.src = videoSrc;
      document.body.appendChild(preloadVideo);
      preloadVideo.load();
    }

    window.addEventListener("pagehide", function(){ if(!callEnded && inCall) markEndedOnServer(); });
    window.addEventListener("beforeunload", function(e){
      if(inCall && !callEnded){
        markEndedOnServer();
        e.preventDefault();
        e.returnValue = "";
      }
    });

    document.getElementById("btn-decline").addEventListener("click", function(){
      stopRing();
      fetch("/call/"+encodeURIComponent(token)+"/decline", { method:"POST" }).catch(function(){});
      endCall(false);
    });

    document.getElementById("btn-accept").addEventListener("click", function(){
      stopRing();
      inCall = true;
      fetch("/call/"+encodeURIComponent(token)+"/accept", { method:"POST" }).catch(function(){});
      ringing.classList.add("screen--hidden");
      videoScreen.classList.remove("screen--hidden");
      if(callerText) callerText.textContent = callerName;
      timerSec = 0;
      timerId = setInterval(tick, 1000);
      if(!videoSrc){ endCall(true); return; }
      if(!video.src){ video.src = videoSrc; video.load(); }
      try { video.currentTime = 0; } catch(_){}
      var tryPlay = function(){
        video.muted = false;
        var p = video.play();
        if(p && p.then){
          p.catch(function(){
            video.muted = true;
            video.play().catch(function(){ endCall(true); });
          });
        }
      };
      if(video.readyState >= 2) tryPlay();
      else {
        video.addEventListener("loadeddata", tryPlay, { once:true });
        video.addEventListener("canplay", tryPlay, { once:true });
        setTimeout(tryPlay, 80);
      }
    });

    video.addEventListener("ended", function(){ if(inCall) endCall(true); });
    video.addEventListener("error", function(){ if(inCall) endCall(true); });

    document.getElementById("hangupBtn").addEventListener("click", function(){ endCall(true); });

    document.getElementById("micBtn").addEventListener("click", function(){
      micOn = !micOn;
      this.classList.toggle("btn-active", !micOn);
    });

    document.getElementById("cameraBtn").addEventListener("click", function(){
      var wrap = document.getElementById("selfPreviewWrap");
      var selfV = document.getElementById("selfPreview");
      if(!camOn){
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia({ video:true, audio:false }).then(function(stream){
          selfStream = stream;
          selfV.srcObject = stream;
          wrap.style.display = "block";
          camOn = true;
          document.getElementById("cameraBtn").classList.add("btn-active");
        }).catch(function(){});
      } else {
        try { if(selfStream) selfStream.getTracks().forEach(function(t){ t.stop(); }); } catch(_){}
        selfStream = null;
        wrap.style.display = "none";
        camOn = false;
        this.classList.remove("btn-active");
      }
    });

    var chat = document.getElementById("chatContainer");
    var chatBtn = document.getElementById("chatBtn");
    var chatMsgs = document.getElementById("chatMessages");
    function toggleChat(open){
      if(open === undefined) open = !chat.classList.contains("open");
      chat.classList.toggle("open", open);
      chatBtn.classList.toggle("active", open);
    }
    chatBtn.addEventListener("click", function(){ toggleChat(); });
    document.getElementById("chatCloseBtn").addEventListener("click", function(){ toggleChat(false); });
    function sendChat(){
      var input = document.getElementById("chatInput");
      var text = (input.value || "").trim();
      if(!text) return;
      var empty = chatMsgs.querySelector(".chat-empty");
      if(empty) empty.remove();
      var bubble = document.createElement("div");
      bubble.className = "chat-message user";
      bubble.textContent = text;
      chatMsgs.appendChild(bubble);
      input.value = "";
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }
    document.getElementById("chatSendBtn").addEventListener("click", sendChat);
    document.getElementById("chatInput").addEventListener("keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); sendChat(); }
    });
  })();
  </script>
</body>
</html>`;
}
