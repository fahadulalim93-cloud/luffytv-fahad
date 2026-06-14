import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// ============================================================
// TV STREAM — Serves hls.js player page
//
// Flow:
//   1. CSV lookup → get dami-tv.pro stream URL
//   2. Pass URL through /api/live/proxy (handles redirects, CORS, Referer)
//   3. /api/live/proxy rewrites ALL m3u8 URLs to go through proxy
//      including variant playlists like /papi/tv/playlist/BASE64
//   4. hls.js plays with auto-recovery + freeze detection
//
// Error recovery (user's exact spec):
//   NETWORK_ERROR → hls.startLoad()
//   MEDIA_ERROR   → hls.recoverMediaError()
//   default        → hls.destroy() + retry
//
// Freeze detection:
//   readyState < 3 every 10s → hls.startLoad()
// ============================================================

export const dynamic = "force-dynamic";

// ── Parse CSV to find channel by ID ──
function findChannelById(id: number): { name: string; streamUrl: string } | null {
  try {
    const csvPath = join(process.cwd(), "data", "channels.csv");
    const csvText = readFileSync(csvPath, "utf-8");
    const lines = csvText.split("\n").filter(l => l.trim());
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const firstComma = line.indexOf(",");
      if (firstComma === -1) continue;
      const secondComma = line.indexOf(",", firstComma + 1);
      if (secondComma === -1) continue;
      const name = line.substring(0, firstComma).trim().replace(/^"|"$/g, "");
      const idStr = line.substring(firstComma + 1, secondComma).trim();
      const streamUrl = line.substring(secondComma + 1).trim().replace(/^"|"$/g, "");
      if (idStr === String(id)) {
        return { name, streamUrl };
      }
    }
  } catch {}
  return null;
}

// ── Escape string for safe embedding in HTML/JS ──
function jsEscape(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/</g, "\\x3c").replace(/>/g, "\\x3e");
}

// ── Build the hls.js player HTML page ──
function buildPlayerHtml(
  streamUrl: string,
  channelName: string,
  channelColor: string
): string {
  const safeName = jsEscape(channelName);
  const safeColor = jsEscape(channelColor);

  // The stream URL goes through /api/live/proxy which:
  // 1. Follows the dami-tv.pro redirect chain
  // 2. Adds proper Referer + Origin headers
  // 3. Rewrites ALL m3u8 URLs (including /papi/tv/playlist/ variants) to go through proxy
  // 4. Returns properly proxied content with CORS headers
  const proxiedUrl = `/api/live/proxy?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent("https://dami-tv.pro/")}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${safeName} - LuffyTV</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#000;overflow:hidden}
  video{width:100%!important;height:100%!important;object-fit:contain;background:#000}

  /* Loading overlay */
  #loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.85);z-index:10;transition:opacity .5s}
  #loading.hidden{opacity:0;pointer-events:none}
  .spinner{width:40px;height:40px;border:3px solid rgba(249,115,22,.2);border-top-color:#f97316;border-radius:50%;animation:spin .7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .load-txt{color:rgba(255,255,255,.4);font:700 11px/1 monospace;margin-top:12px;letter-spacing:.5px}

  /* Error overlay */
  #error{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.92);z-index:20}
  #error.visible{display:flex}
  .err-icon{font-size:44px;margin-bottom:10px}
  .err-msg{color:rgba(255,255,255,.5);font:600 12px/1.5 sans-serif;text-align:center;max-width:280px;margin-bottom:16px}
  .retry-btn{background:${safeColor};color:#fff;border:none;border-radius:8px;padding:8px 22px;font:700 11px/1 monospace;cursor:pointer;letter-spacing:.5px}
  .retry-btn:hover{opacity:.85}

  /* Reconnect badge */
  #reconn{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);padding:4px 10px;border-radius:6px;border:1px solid rgba(249,115,22,.25);z-index:30;display:none;align-items:center;gap:6px}
  #reconn.visible{display:flex}
  .mini-spin{width:10px;height:10px;border:2px solid rgba(249,115,22,.3);border-top-color:#f97316;border-radius:50%;animation:spin .7s linear infinite}
  #reconn span{color:rgba(255,255,255,.5);font:700 8px/1 monospace;letter-spacing:.5px}

  /* Channel badge */
  .ch-badge{position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);backdrop-filter:blur(4px);padding:4px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.06);z-index:30;pointer-events:none}
  .ch-badge span{color:rgba(255,255,255,.6);font:700 9px/1 'Space Mono',monospace;letter-spacing:.5px}

  /* Quality badge */
  #quality{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);padding:4px 9px;border-radius:6px;border:1px solid rgba(255,255,255,.06);z-index:30;pointer-events:none;display:none}
  #quality.visible{display:block}
  #quality span{color:rgba(255,255,255,.5);font:700 8px/1 monospace}
</style>
</head>
<body>
<video id="video" autoplay playsinline controls></video>

<div class="ch-badge"><span>${safeName}</span></div>
<div id="reconn"><div class="mini-spin"></div><span>Reconnecting</span></div>
<div id="quality"><span></span></div>

<div id="loading">
  <div class="spinner"></div>
  <div class="load-txt">Loading stream...</div>
</div>

<div id="error">
  <div class="err-icon">&#x1F4FA;</div>
  <div class="err-msg">Stream unavailable. Try switching server or tap retry.</div>
  <button class="retry-btn" onclick="retryStream()">Retry</button>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
(function(){
  var video = document.getElementById('video');
  var loading = document.getElementById('loading');
  var errorEl = document.getElementById('error');
  var reconn = document.getElementById('reconn');
  var qualityEl = document.getElementById('quality');

  // The stream URL proxied through our server
  var STREAM_URL = "${jsEscape(proxiedUrl)}";
  // Direct URL for "Open External"
  var DIRECT_URL = "${jsEscape(streamUrl)}";

  var hls = null;
  var retryCount = 0;
  var MAX_RETRIES = 10;

  function hideLoading(){loading.classList.add('hidden')}
  function showError(){errorEl.classList.add('visible');reconn.classList.remove('visible')}
  function hideError(){errorEl.classList.remove('visible')}
  function showReconn(){reconn.classList.add('visible')}
  function hideReconn(){reconn.classList.remove('visible')}
  function showQuality(text){qualityEl.querySelector('span').textContent=text;qualityEl.classList.add('visible')}

  function startPlayer(){
    // Cleanup old instance
    if(hls){try{hls.destroy()}catch(e){}hls=null}
    hideError();
    loading.classList.remove('hidden');

    if(typeof Hls!=='undefined'&&Hls.isSupported()){
      hls=new Hls({
        // === User's exact hls.js config ===
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDuration: 5,
        liveMaxLatencyDuration: 10,
        enableWorker: true,
        lowLatencyMode: true,

        // Additional live tuning
        liveDurationInfinity: true,
        liveBackBufferLength: 30,
        maxBufferHole: 0.5,
        maxBufferSize: 60*1000*1000,

        // Aggressive retry on loading failures
        fragLoadingMaxRetry: 6,
        fragLoadingMaxRetryTimeout: 64000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingMaxRetryTimeout: 64000,
        levelLoadingMaxRetry: 6,
        levelLoadingMaxRetryTimeout: 64000,

        // Route all XHR requests through our proxy as safety net
        xhrSetup: function(xhr, url){
          if(url && !url.startsWith('/api/')){
            var ref = 'https://dami-tv.pro/';
            try{
              var h = new URL(url).hostname;
              if(h.includes('cdnlivetv')) ref='https://cdnlivetv.tv/';
              else if(h.includes('strmd')) ref='https://embedsports.top/';
              else if(h.includes('streamfree')||h.includes('cdn-lab')) ref='https://streamfree.app/';
              else if(h.includes('cfbu247')) ref='https://dami-tv.pro/';
            }catch(e){}
            var proxyUrl='/api/live/proxy?url='+encodeURIComponent(url)+'&referer='+encodeURIComponent(ref);
            xhr.open('GET',proxyUrl,true);
          }
        }
      });

      hls.loadSource(STREAM_URL);
      hls.attachMedia(video);

      // === Manifest parsed — stream is ready ===
      hls.on(Hls.Events.MANIFEST_PARSED, function(event, data){
        hideLoading(); hideError(); hideReconn();
        retryCount = 0;
        video.play().catch(function(){});

        // Show quality info
        if(data.levels && data.levels.length > 0){
          var best = data.levels[data.levels.length-1];
          if(best.height) showQuality(best.height+'p');
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data){
        var level = hls.levels[data.level];
        if(level && level.height) showQuality(level.height+'p');
      });

      // === Error recovery — user's exact spec ===
      hls.on(Hls.Events.ERROR, function(event, data){
        if(data.fatal){
          switch(data.type){
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Network error — hls.js can usually recover by retrying
              showReconn();
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Media decode error — recover without full restart
              hls.recoverMediaError();
              break;
            default:
              // Unrecoverable — full restart with backoff
              retryCount++;
              if(retryCount <= MAX_RETRIES){
                showReconn();
                setTimeout(function(){ startPlayer(); }, Math.min(2000*retryCount, 15000));
              } else {
                showError();
              }
              break;
          }
        }
        // Non-fatal errors: just keep going
      });

      hls.on(Hls.Events.FRAG_LOADED, function(){
        hideReconn(); hideError();
      });

    } else if(video.canPlayType('application/vnd.apple.mpegurl')){
      // === Safari native HLS ===
      video.src = STREAM_URL;
      video.addEventListener('loadedmetadata', function(){
        hideLoading(); video.play().catch(function(){});
      });
      video.addEventListener('error', function(){
        retryCount++;
        if(retryCount <= MAX_RETRIES){
          setTimeout(function(){ video.load(); }, 3000);
        } else {
          showError();
        }
      });
    } else {
      // No HLS support — try direct
      video.src = STREAM_URL;
      video.addEventListener('loadedmetadata', function(){
        hideLoading(); video.play().catch(function(){});
      });
    }
  }

  // Manual retry
  window.retryStream = function(){
    retryCount = 0; hideError(); hideReconn();
    loading.classList.remove('hidden');
    startPlayer();
  };

  // Start!
  startPlayer();

  // === Freeze detection — user's exact spec ===
  // Check video.readyState < 3 every 10s, call hls.startLoad()
  setInterval(function(){
    if(hls && video.readyState < 3 && !video.paused && !video.ended){
      showReconn();
      hls.startLoad();
      // If still stuck after 10 more seconds, full restart
      setTimeout(function(){
        if(video.readyState < 3 && !video.paused){
          retryCount++;
          if(retryCount <= MAX_RETRIES){
            startPlayer();
          } else {
            showError();
          }
        }
      }, 10000);
    }
  }, 10000);

})();
</script>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get("id");
  const streamUrlParam = url.searchParams.get("url");
  const channelName = url.searchParams.get("name") || "Live TV";
  const channelColor = url.searchParams.get("color") || "#f97316";

  let streamUrl = "";
  let resolvedName = channelName;

  // Method 1: Resolve by channel ID (reads local CSV — instant)
  if (channelId) {
    const idNum = parseInt(channelId, 10);
    if (!isNaN(idNum)) {
      const channel = findChannelById(idNum);
      if (channel) {
        resolvedName = channel.name;
        streamUrl = channel.streamUrl;
      }
    }
  }

  // Method 2: Use provided stream URL
  if (!streamUrl && streamUrlParam) {
    streamUrl = streamUrlParam;
  }

  if (!streamUrl) {
    return NextResponse.json({ error: "No channel ID or stream URL provided" }, { status: 400 });
  }

  // Build the hls.js player HTML — proxy handles the redirect chain
  const html = buildPlayerHtml(streamUrl, resolvedName, channelColor);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
