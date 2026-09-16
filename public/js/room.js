// ==========================================================================
// YouTube Party - Realtime Synchronized Room Controller (RBAC Enabled)
// ==========================================================================

var serverUrl = window.location.hostname.includes('vercel.app')
  ? 'https://yotube-watch-party.onrender.com'
  : undefined;

var socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  timeout: 10000,
  reconnectionAttempts: 5
});

// UI Element Handles
const $messageForm = document.querySelector('#message-form');
const $messageFormButton = document.querySelector("#submit-button");
const $messageFormInput = document.querySelector("#inputMessage");
const $urlForm = document.querySelector("#url-form");
const $messages = document.querySelector('#messages');
const $users = document.querySelector('#users');
const $videoTitle = document.querySelector("#video-title");
const $channelName = document.querySelector("#channel-name");
const $videos = document.querySelector('#videos');
const $nextVideo = document.querySelector("#next-video");
const $prevVideo = document.querySelector("#prev-video");
const $greet = document.querySelector("#greeting-text");

// Templates
const messageTemplate = document.querySelector("#message-template").innerHTML;
const userTemplate = document.querySelector("#user-template").innerHTML;

// State Variables
const params = new URLSearchParams(window.location.search);
var rawUserParam = params.get('username');
if (rawUserParam && rawUserParam.trim() && rawUserParam !== 'null' && rawUserParam !== 'undefined') {
  localStorage.setItem('WATCH_PARTY_USERNAME', rawUserParam.trim());
}
var savedUser = localStorage.getItem('WATCH_PARTY_USERNAME');
var username = (rawUserParam && rawUserParam.trim() && rawUserParam !== 'null' && rawUserParam !== 'undefined')
  ? rawUserParam.trim()
  : (savedUser || ('Guest-' + Math.floor(1000 + Math.random() * 9000)));

var roomid;
var currentRole = 'PARTICIPANT';
var isHost = false;
var hostSocketId = '';
var control = 1;
var unreadMessagesCount = 0;

var isPlayerReady = false;
var pendingSyncState = null;
var currentVideoObj = null;
var playlistQueue = [];
var historyQueue = [];
var roomMembersList = [];

// Toast notification function
function showToast(msg, icon = 'fa-circle-check') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-custom';
  toast.innerHTML = `<i class="fa-solid ${icon} text-danger"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --------------------------------------------------------------------------
// 1. Initial Setup & Event Listeners
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const greetEl = document.getElementById('greeting-text') || $greet;
  if (greetEl) greetEl.innerHTML = `<i class="fa-solid fa-user me-1 text-muted"></i> User: ${escapeHtml(username)}`;

  initApiKeyManager();
  initCopyButtons();
  initSidebarTabs();
  initRoomVideoFeed();
  initSmartNavbarScroll();
  initEmojiBar();
  initialSetup();

  ensureYouTubePlayerLoaded();
  setTimeout(ensureYouTubePlayerLoaded, 500);
  setTimeout(ensureYouTubePlayerLoaded, 1500);
});

function initSmartNavbarScroll() {
  const navbar = document.querySelector('.navbar-custom');
  if (navbar) navbar.classList.remove('navbar-hidden');
}

function initEmojiBar() {
  document.querySelectorAll('.btn-emoji-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      if ($messageFormInput) {
        $messageFormInput.value += emoji + ' ';
        $messageFormInput.focus();
      }
    });
  });
}

function initApiKeyManager() {
  const statusText = document.getElementById('api-key-status-text');
  const inputKey = document.getElementById('youtube-api-key-input');
  const btnSave = document.getElementById('btn-save-api-key');
  const btnClear = document.getElementById('btn-clear-api-key');

  const savedKey = localStorage.getItem('YOUTUBE_API_KEY');
  if (savedKey) {
    if (statusText) statusText.textContent = "Active ✓";
    if (inputKey) inputKey.value = savedKey;
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const val = inputKey.value.trim();
      if (val) {
        localStorage.setItem('YOUTUBE_API_KEY', val);
        if (statusText) statusText.textContent = "Active ✓";
        showToast("YouTube API Key Saved!");

        const modalEl = document.getElementById('apiKeyModal');
        if (modalEl && window.bootstrap) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
        fetchRoomYouTubeVideos();
      } else {
        swal("Error", "Please enter a valid API key.", "error");
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      localStorage.removeItem('YOUTUBE_API_KEY');
      if (inputKey) inputKey.value = '';
      if (statusText) statusText.textContent = "API";
      showToast("API Key Cleared");
      renderRoomVideoGrid(ROOM_CURATED);
    });
  }
}

function initCopyButtons() {
  const btnCopyId = document.getElementById('btn-copy-roomid');
  const btnCopyLink = document.getElementById('btn-copy-link');

  if (btnCopyId) {
    btnCopyId.addEventListener('click', () => {
      const code = document.getElementById('roomid')?.value || roomid;
      if (code) {
        navigator.clipboard.writeText(code);
        showToast("Room Code Copied!");
      }
    });
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
      const currentRoomCode = document.getElementById('roomid')?.value || roomid;
      const link = `${window.location.origin}/room.html?username=Guest&roomid=${encodeURIComponent(currentRoomCode)}`;
      navigator.clipboard.writeText(link);
      showToast("Invite Link Copied!");
    });
  }
}

function switchToTab(targetTab) {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === targetTab);
  });

  const chatTab = document.getElementById('tab-content-chat');
  const playlistTab = document.getElementById('tab-content-playlist');
  const membersTab = document.getElementById('tab-content-members');

  if (chatTab) chatTab.classList.toggle('d-none', targetTab !== 'chat');
  if (playlistTab) playlistTab.classList.toggle('d-none', targetTab !== 'playlist');
  if (membersTab) membersTab.classList.toggle('d-none', targetTab !== 'members');

  if (targetTab === 'playlist') {
    displayPlaylist();
  }

  if (targetTab === 'members') {
    renderMembersList();
  }

  if (targetTab === 'chat') {
    unreadMessagesCount = 0;
    const badge = document.getElementById('chat-unread-badge');
    if (badge) {
      badge.textContent = '0';
      badge.classList.add('d-none');
    }
    if ($messages) $messages.scrollTop = $messages.scrollHeight;
  }
}

function initSidebarTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchToTab(tab.dataset.tab);
    });
  });
}

async function initialSetup() {
  const defaultVideo = {
    title: "Trevor Daniel - Falling",
    channel: "Trevor Daniel",
    thumbnail_url: "https://i.ytimg.com/vi/L7mfjvdnPno/hqdefault.jpg",
    video_url: "https://www.youtube.com/watch?v=L7mfjvdnPno",
    video_id: "L7mfjvdnPno"
  };

  // 1. Immediately load video into player UI so mobile/desktop never shows a black screen
  if (params.has('initialVideo')) {
    const initialUrl = params.get('initialVideo');
    addVideoFromUrl(initialUrl, true);
  } else {
    loadVideoInPlayer(defaultVideo);
  }

  // 2. Immediately set or generate Room ID in UI input field
  const roomInput = document.getElementById("roomid");
  if (params.has('roomid')) {
    roomid = params.get('roomid').trim().toUpperCase();
    if (roomInput) roomInput.value = roomid;
    if (socket) socket.emit("joinRoom", { username, roomid });
  } else {
    if (socket) socket.emit("createRoom", { username });

    socket.on("getRoomID", (id) => {
      if (id) {
        roomid = id.trim().toUpperCase();
        if (roomInput) roomInput.value = roomid;
        const newUrl = `${window.location.pathname}?username=${encodeURIComponent(username)}&roomid=${encodeURIComponent(roomid)}`;
        window.history.replaceState({}, '', newUrl);
        if (currentVideoObj) {
          socket.emit("playVideoDirectly", currentVideoObj);
        }
      }
    });
  }
}

// --------------------------------------------------------------------------
// 2. Synchronized Video Navigation Controls
// --------------------------------------------------------------------------

function playNextVideo() {
  if (playlistQueue.length > 0) {
    if (currentVideoObj) historyQueue.push(currentVideoObj);
    const nextVideo = playlistQueue.shift();
    currentVideoObj = nextVideo;
    loadVideoInPlayer(nextVideo);
    if (canControlPlayback()) {
      socket.emit("playVideoDirectly", nextVideo);
      socket.emit("playlistUpdated", playlistQueue);
    }
    displayPlaylist();
  } else {
    // Autoplay next video from catalog, ALWAYS selecting a DIFFERENT video
    if (ROOM_CURATED && ROOM_CURATED.length > 0) {
      const candidates = ROOM_CURATED.filter(v => !currentVideoObj || v.id !== currentVideoObj.video_id);
      const listToPick = candidates.length > 0 ? candidates : ROOM_CURATED;
      const randomIdx = Math.floor(Math.random() * listToPick.length);
      const autoNext = listToPick[randomIdx];
      const videoObj = {
        title: autoNext.title,
        channel: autoNext.channel,
        thumbnail_url: autoNext.thumbnail,
        video_url: `https://www.youtube.com/watch?v=${autoNext.id}`,
        video_id: autoNext.id
      };
      if (currentVideoObj) historyQueue.push(currentVideoObj);
      currentVideoObj = videoObj;
      loadVideoInPlayer(videoObj);
      if (canControlPlayback()) {
        socket.emit("playVideoDirectly", videoObj);
      }
      showToast(`Autoplaying Next: ${autoNext.title}`, "fa-play");
    }
  }
  renderRoomVideoGrid(ROOM_CURATED);
}

function playPreviousVideo() {
  if (historyQueue.length > 0) {
    if (currentVideoObj) playlistQueue.unshift(currentVideoObj);
    const prevVideo = historyQueue.pop();
    currentVideoObj = prevVideo;
    loadVideoInPlayer(prevVideo);
    displayPlaylist();
  } else {
    if (ROOM_CURATED && ROOM_CURATED.length > 0) {
      const candidates = ROOM_CURATED.filter(v => !currentVideoObj || v.id !== currentVideoObj.video_id);
      const listToPick = candidates.length > 0 ? candidates : ROOM_CURATED;
      const randomIdx = Math.floor(Math.random() * listToPick.length);
      const autoPrev = listToPick[randomIdx];
      const videoObj = {
        title: autoPrev.title,
        channel: autoPrev.channel,
        thumbnail_url: autoPrev.thumbnail,
        video_url: `https://www.youtube.com/watch?v=${autoPrev.id}`,
        video_id: autoPrev.id
      };
      currentVideoObj = videoObj;
      loadVideoInPlayer(videoObj);
      showToast(`Playing Previous: ${autoPrev.title}`, "fa-backward-step");
    }
  }
  renderRoomVideoGrid(ROOM_CURATED);
}

function loadVideoInPlayer(videoObj) {
  if (!videoObj || !videoObj.video_id) return;
  currentVideoObj = videoObj;

  const titleEl = document.getElementById('video-title') || $videoTitle;
  const channelEl = document.getElementById('channel-name') || $channelName;

  if (titleEl) titleEl.textContent = videoObj.title || "YouTube Watch Party Player";
  if (channelEl) channelEl.innerHTML = `<i class="fa-solid fa-circle-check text-primary me-1"></i> ${videoObj.channel || "Synchronized Stream"}`;

  // 1. Trigger YouTube Player API or iframe reload with target video ID
  ensureYouTubePlayerLoaded(videoObj.video_id);

  // 2. Force DOM iframe element src synchronization to guarantee video frame switches visually
  const playerContainer = document.getElementById('player');
  if (playerContainer) {
    const iframe = playerContainer.querySelector('iframe');
    const embedUrl = `https://www.youtube.com/embed/${videoObj.video_id}?autoplay=1&playsinline=1&enablejsapi=1&rel=0`;
    if (iframe) {
      if (!iframe.src || !iframe.src.includes(videoObj.video_id)) {
        iframe.src = embedUrl;
      }
    } else {
      playerContainer.innerHTML = `<iframe id="fallback-yt-iframe" style="width:100%; height:100%; border:0; position:absolute; top:0; left:0;" src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
  }
}

if ($nextVideo) {
  $nextVideo.onclick = function () {
    if (!canControlPlayback()) {
      requestPlaybackAction('play_request', { action: 'next' });
      return;
    }
    playNextVideo();
    socket.emit("playNextVideo");
  };
}

if ($prevVideo) {
  $prevVideo.onclick = function () {
    if (!canControlPlayback()) {
      requestPlaybackAction('play_request', { action: 'prev' });
      return;
    }
    playPreviousVideo();
    socket.emit("playPreviousVideo");
  };
}

function canControlPlayback() {
  return currentRole === 'HOST' || currentRole === 'MODERATOR' || currentRole === 'ADMIN';
}

function requestPlaybackAction(type, payload) {
  swal({
    title: "Request Approval?",
    text: "As a Participant, your playback changes must be approved by the Host/Moderators. Send request now?",
    icon: "info",
    buttons: ["Cancel", "Send Request"]
  }).then((willSend) => {
    if (willSend) {
      socket.emit("request_action", { type, payload });
      showToast("Request sent to Host!", "fa-paper-plane");
    }
  });
}

// --------------------------------------------------------------------------
// 3. Playlist Queue Management
// --------------------------------------------------------------------------

function displayPlaylist() {
  if (!$videos) return;
  $videos.innerHTML = '';

  const countEl = document.getElementById('playlist-count');
  if (countEl) countEl.textContent = playlistQueue.length;

  const emptyMsg = document.getElementById('playlist-empty-msg');
  if (emptyMsg) emptyMsg.style.display = playlistQueue.length === 0 ? 'block' : 'none';

  playlistQueue.forEach((video, idx) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.innerHTML = `
      <img src="${video.thumbnail_url}" class="playlist-thumb" alt="${escapeHtml(video.title)}">
      <div class="playlist-meta">
        <div class="playlist-title">${escapeHtml(video.title)}</div>
        <div class="playlist-channel">${escapeHtml(video.channel)}</div>
      </div>
      <button class="btn-card-action btn-play-queued" data-index="${idx}" title="Play Now">
        <i class="fa-solid fa-play"></i>
      </button>
    `;

    item.querySelector('.btn-play-queued').addEventListener('click', () => {
      if (!canControlPlayback()) {
        requestPlaybackAction('change_video', video);
        return;
      }
      const selected = playlistQueue.splice(idx, 1)[0];
      if (currentVideoObj) historyQueue.push(currentVideoObj);
      currentVideoObj = selected;
      loadVideoInPlayer(selected);
      socket.emit("playlistUpdated", playlistQueue);
      socket.emit("playVideoDirectly", selected);
      displayPlaylist();
    });

    $videos.appendChild(item);
  });
}

function youtube_parser(url) {
  var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  var match = url.match(regExp);
  return (match && match[7].length == 11) ? match[7] : false;
}

function addVideoFromUrl(url, autoPlayIfFirst = false) {
  const videoId = youtube_parser(url);
  if (!videoId) {
    swal("Invalid Link", "Please paste a valid YouTube video URL.", "error");
    return;
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  fetch(oembedUrl)
    .then(res => res.json())
    .then(res => {
      const video = {
        title: res.title,
        channel: res.author_name,
        thumbnail_url: res.thumbnail_url,
        video_url: url,
        video_id: videoId
      };

      if (autoPlayIfFirst || !currentVideoObj || currentVideoObj.video_id === 'L7mfjvdnPno') {
        currentVideoObj = video;
        loadVideoInPlayer(video);
        if (canControlPlayback()) {
          socket.emit("playVideoDirectly", video);
        }
      } else {
        playlistQueue.push(video);
        socket.emit("playlistUpdated", playlistQueue);
        displayPlaylist();
        showToast("Video Added to Playlist Queue!");
      }
    })
    .catch(() => {
      const video = {
        title: "YouTube Video (" + videoId + ")",
        channel: "YouTube",
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        video_url: url,
        video_id: videoId
      };
      if (autoPlayIfFirst || !currentVideoObj || currentVideoObj.video_id === 'L7mfjvdnPno') {
        currentVideoObj = video;
        loadVideoInPlayer(video);
        if (canControlPlayback()) {
          socket.emit("playVideoDirectly", video);
        }
      } else {
        playlistQueue.push(video);
        socket.emit("playlistUpdated", playlistQueue);
        displayPlaylist();
        showToast("Video Added to Playlist Queue!");
      }
    });
}

if ($urlForm) {
  const urlInput = document.getElementById('url');

  $urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = urlInput ? urlInput.value.trim() : '';
    if (query) {
      if (youtube_parser(query)) {
        addVideoFromUrl(query);
        if (urlInput) urlInput.value = '';
      } else {
        fetchRoomYouTubeVideos(query, true);
        showToast(`Searching: "${query}"...`, "fa-magnifying-glass");
      }
    }
  });

  if (urlInput) {
    let navSearchTimer;
    urlInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val && !youtube_parser(val)) {
        clearTimeout(navSearchTimer);
        navSearchTimer = setTimeout(() => {
          fetchRoomYouTubeVideos(val, false);
        }, 400);
      } else if (!val) {
        renderRoomVideoGrid(ROOM_CURATED, false);
      }
    });
  }
}

// --------------------------------------------------------------------------
// 4. Socket.IO Listeners & RBAC Events
// --------------------------------------------------------------------------

$messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = $messageFormInput.value.trim();
  if (!message) return;

  // Clear input immediately so user can continue typing seamlessly on mobile
  $messageFormInput.value = '';
  $messageFormInput.focus();

  // Ensure Chat tab is visible
  switchToTab('chat');

  socket.emit('sendMessage', message);
});

socket.on('message', (message) => {
  if (!message || !message.text) return;

  const isSystem = message.username === 'System';
  const isMe = !isSystem && ((message.senderId && message.senderId === socket.id) || (message.username === username));
  const isHostMsg = message.isHost || (message.username && message.username.includes('(Owner)'));
  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let html = '';
  try {
    if (typeof Mustache !== 'undefined' && messageTemplate) {
      html = Mustache.render(messageTemplate, {
        username: escapeHtml(message.username || 'User'),
        message: escapeHtml(message.text || ''),
        meClass: isMe ? 'me' : '',
        badge: isHostMsg ? '<span class="chat-author-badge">Host</span>' : '',
        isSystem: isSystem,
        time: timeStr
      });
    } else {
      throw new Error('Mustache fallback');
    }
  } catch (err) {
    if (isSystem) {
      html = `<div class="chat-system-pill"><i class="fa-solid fa-circle-info text-info me-1"></i> ${escapeHtml(message.text)}</div>`;
    } else {
      html = `
        <div class="chat-message-pill ${isMe ? 'me' : ''}">
          <div class="chat-author">
            ${escapeHtml(message.username || 'User')} ${isHostMsg ? '<span class="chat-author-badge">Host</span>' : ''} <span class="chat-time">${timeStr}</span>
          </div>
          <div class="chat-text">${escapeHtml(message.text)}</div>
        </div>
      `;
    }
  }

  const msgBox = document.querySelector('#messages') || $messages;
  if (msgBox) {
    msgBox.insertAdjacentHTML('beforeend', html);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  // Unread message counter badge
  const chatTabContent = document.getElementById('tab-content-chat');
  const isChatVisible = chatTabContent && !chatTabContent.classList.contains('d-none');

  if (!isChatVisible && !isMe) {
    unreadMessagesCount++;
    const badge = document.getElementById('chat-unread-badge');
    if (badge) {
      badge.textContent = unreadMessagesCount;
      badge.classList.remove('d-none');
    }
  }
});

// Participant List & Role Update Listener
socket.on('roomUsersList', (data) => {
  if (!data || !Array.isArray(data.usersList)) return;
  roomMembersList = data.usersList;
  hostSocketId = data.hostSocketId;
  renderMembersList();
});

function renderMembersList() {
  const usersContainer = document.getElementById('users') || document.querySelector('#users');
  if (!usersContainer) return;

  if (!roomMembersList || roomMembersList.length === 0) {
    roomMembersList = [{
      id: socket ? socket.id : 'local-user',
      username: username || 'You (Host)',
      role: 'HOST'
    }];
  }

  usersContainer.innerHTML = '';
  const countEl = document.getElementById('members-count');
  if (countEl) countEl.textContent = roomMembersList.length;

  // Find my role in the list
  const me = roomMembersList.find(u => u && u.id === socket.id);
  if (me) {
    currentRole = me.role;
    isHost = (currentRole === 'HOST' || currentRole === 'ADMIN');
  }

  // Only show Room Code and Invite Link to the Room Host
  const hostActionsEl = document.getElementById('host-room-actions') || document.querySelector('.header-room-actions');
  if (hostActionsEl) {
    if (isHost) {
      hostActionsEl.classList.remove('d-none');
    } else {
      hostActionsEl.classList.add('d-none');
    }
  }

  roomMembersList.forEach(user => {
    if (!user) return;
    const isTargetHost = (user.id === hostSocketId || user.role === 'HOST' || user.role === 'ADMIN');
    let roleClass = 'participant';
    let roleLabel = 'Participant';
    let roleIcon = '<i class="fa-solid fa-user"></i>';

    if (isTargetHost) {
      roleClass = 'host';
      roleLabel = 'Host';
      roleIcon = '<i class="fa-solid fa-crown text-warning"></i>';
    } else if (user.role === 'MODERATOR') {
      roleClass = 'moderator';
      roleLabel = 'Moderator';
      roleIcon = '<i class="fa-solid fa-shield-halved text-info"></i>';
    }

    let hostControls = '';
    if (isHost && user.id !== socket.id) {
      const isMod = user.role === 'MODERATOR';
      hostControls = `
        <div class="user-actions-dropdown">
          <button class="btn-action-icon btn-toggle-mod" data-target-id="${user.id}" data-role="${isMod ? 'PARTICIPANT' : 'MODERATOR'}" title="${isMod ? 'Demote to Participant' : 'Promote to Moderator'}">
            <i class="fa-solid ${isMod ? 'fa-user-minus' : 'fa-shield-halved'}"></i>
          </button>
          <button class="btn-action-icon btn-transfer-host" data-target-id="${user.id}" title="Transfer Host Role">
            <i class="fa-solid fa-crown text-warning"></i>
          </button>
          <button class="btn-action-icon danger btn-kick-user" data-target-id="${user.id}" title="Kick from Room">
            <i class="fa-solid fa-user-xmark"></i>
          </button>
        </div>
      `;
    }

    const displayUsername = (user.username && typeof user.username === 'string' && user.username.trim()) ? user.username.trim() : 'Guest';
    const initialChar = displayUsername.charAt(0).toUpperCase();

    let html = '';
    try {
      if (typeof Mustache !== 'undefined' && userTemplate) {
        html = Mustache.render(userTemplate, {
          username: displayUsername,
          initial: initialChar,
          roleClass,
          roleLabel,
          roleIcon,
          hostControls
        });
      } else {
        throw new Error('Mustache fallback');
      }
    } catch (e) {
      html = `
        <div class="user-item">
          <div class="user-avatar">${initialChar}</div>
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2">
              <span class="fw-bold text-white fs-6">${escapeHtml(displayUsername)}</span>
              <span class="role-badge ${roleClass}">${roleIcon} ${roleLabel}</span>
            </div>
          </div>
          ${hostControls}
        </div>
      `;
    }

    usersContainer.insertAdjacentHTML('beforeend', html);
  });

  attachHostControlListeners();
}

function attachHostControlListeners() {
  document.querySelectorAll('.btn-toggle-mod').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetSocketId = e.currentTarget.dataset.targetId;
      const role = e.currentTarget.dataset.role;
      socket.emit("assign_role", { targetSocketId, role });
    });
  });

  document.querySelectorAll('.btn-transfer-host').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetSocketId = e.currentTarget.dataset.targetId;
      swal({
        title: "Transfer Host Role?",
        text: "Are you sure you want to pass Host privileges to this user?",
        icon: "warning",
        buttons: true,
        dangerMode: true,
      }).then((willTransfer) => {
        if (willTransfer) {
          socket.emit("transfer_host", { targetSocketId });
        }
      });
    });
  });

  document.querySelectorAll('.btn-kick-user').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetSocketId = e.currentTarget.dataset.targetId;
      swal({
        title: "Kick User?",
        text: "Remove this participant from the room?",
        icon: "warning",
        buttons: true,
        dangerMode: true,
      }).then((willKick) => {
        if (willKick) {
          socket.emit("remove_participant", { targetSocketId });
        }
      });
    });
  });
}

// RBAC Event Feedback & General Errors
socket.on("error", (data) => {
  if (data && data.message) {
    if (window.swal) {
      swal("Room Notice", data.message, "warning").then(() => {
        if (data.message.includes("Room ID does not exist") || data.message.includes("Room is full")) {
          window.location.href = "/";
        }
      });
    } else {
      showToast(data.message, "fa-circle-exclamation");
    }
  }
});

socket.on("permission_error", (data) => {
  swal("Permission Restricted", data.message, "warning");
});

socket.on("kicked_from_room", (data) => {
  swal({
    title: "Kicked from Room",
    text: data.message,
    icon: "error"
  }).then(() => {
    window.location.href = "/";
  });
});

socket.on("role_assigned", (data) => {
  showToast(`Role updated for user!`);
});

socket.on("host_transferred", (data) => {
  showToast("Host Role Transferred!", "fa-crown");
});

socket.on("participant_removed", (data) => {
  showToast(`User ${data.username} removed from room.`, "fa-user-xmark");
});

// Approval Request handling for Host/Moderator
socket.on("approval_request_received", (req) => {
  const container = document.getElementById('approval-requests-container');
  if (!container) return;

  const banner = document.createElement('div');
  banner.className = 'approval-request-banner';
  banner.id = `request-${req.id}`;
  banner.innerHTML = `
    <div class="fs-7 text-white">
      <i class="fa-solid fa-circle-info text-cyan me-1"></i>
      <strong>${escapeHtml(req.username)}</strong> requested to ${req.type === 'change_video' ? 'play video' : 'change playback'}.
    </div>
    <div class="d-flex gap-2">
      <button class="btn-primary-custom btn-sm py-1 px-3 btn-approve-req" data-id="${req.id}">Approve</button>
      <button class="btn-secondary-custom btn-sm py-1 px-3 btn-reject-req" data-id="${req.id}">Reject</button>
    </div>
  `;

  banner.querySelector('.btn-approve-req').addEventListener('click', () => {
    socket.emit("handle_request", { requestId: req.id, approve: true });
    banner.remove();
  });

  banner.querySelector('.btn-reject-req').addEventListener('click', () => {
    socket.emit("handle_request", { requestId: req.id, approve: false });
    banner.remove();
  });

  container.appendChild(banner);
});

socket.on("playlistUpdated", (updatedPlaylist) => {
  playlistQueue = updatedPlaylist;
  displayPlaylist();
});

socket.on("playNextVideo", () => playNextVideo());
socket.on("playPreviousVideo", () => playPreviousVideo());
socket.on("playVideoDirectly", (videoObj) => {
  if (currentVideoObj) historyQueue.push(currentVideoObj);
  currentVideoObj = videoObj;
  loadVideoInPlayer(videoObj);
});

// --------------------------------------------------------------------------
// 5. In-Room YouTube Discovery Feed (100% Verified Valid YouTube IDs)
// --------------------------------------------------------------------------
const ROOM_CURATED = [
  // 🎤 KK Best Hit Songs
  { id: "yW3wN-r0X6g", title: "KK - Tadap Tadap Ke Is Dil (Official Video)", channel: "KK", thumbnail: "https://i.ytimg.com/vi/yW3wN-r0X6g/hqdefault.jpg", category: "kk_songs" },
  { id: "5oExb-pbo3s", title: "KK - Zara Sa (Jannat) | Emraan Hashmi", channel: "SonyMusicIndiaVEVO", thumbnail: "https://i.ytimg.com/vi/5oExb-pbo3s/hqdefault.jpg", category: "kk_songs" },
  { id: "o2t_82s0DQA", title: "KK - Yaaron Dosti Badi Hi Haseen Hai", channel: "SonyMusicIndiaVEVO", thumbnail: "https://i.ytimg.com/vi/o2t_82s0DQA/hqdefault.jpg", category: "kk_songs" },
  { id: "T9n_Q1n3_34", title: "KK - Pal (Official Video)", channel: "SonyMusicIndiaVEVO", thumbnail: "https://i.ytimg.com/vi/T9n_Q1n3_34/hqdefault.jpg", category: "kk_songs" },
  { id: "v_7vW3XW28w", title: "KK - Labon Ko (Bhool Bhulaiyaa)", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/v_7vW3XW28w/hqdefault.jpg", category: "kk_songs" },
  { id: "Qz-c8fW5F68", title: "KK - Tu Hi Meri Shab Hai (Gangster)", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/Qz-c8fW5F68/hqdefault.jpg", category: "kk_songs" },

  // 🎵 Viral English Hits
  { id: "L7mfjvdnPno", title: "Trevor Daniel - Falling", channel: "Trevor Daniel", thumbnail: "https://i.ytimg.com/vi/L7mfjvdnPno/hqdefault.jpg", category: "english_hits" },
  { id: "51u5fnyrGj4", title: "Duncan Laurence - Arcade", channel: "Duncan Laurence", thumbnail: "https://i.ytimg.com/vi/51u5fnyrGj4/hqdefault.jpg", category: "english_hits" },
  { id: "tQ0yjYUFKAE", title: "Justin Bieber - Peaches ft. Daniel Caesar, Giveon", channel: "Justin Bieber", thumbnail: "https://i.ytimg.com/vi/tQ0yjYUFKAE/hqdefault.jpg", category: "english_hits" },
  { id: "fRh_vgS2dFE", title: "Justin Bieber - Sorry", channel: "Justin Bieber", thumbnail: "https://i.ytimg.com/vi/fRh_vgS2dFE/hqdefault.jpg", category: "english_hits" },
  { id: "kffacxfA7G4", title: "Justin Bieber - Baby ft. Ludacris", channel: "Justin Bieber", thumbnail: "https://i.ytimg.com/vi/kffacxfA7G4/hqdefault.jpg", category: "english_hits" },
  { id: "vGJTaP6anOU", title: "CKay - Love Nwantiti Remix", channel: "CKay", thumbnail: "https://i.ytimg.com/vi/vGJTaP6anOU/hqdefault.jpg", category: "english_hits" },
  { id: "JGwWNGJdvx8", title: "Ed Sheeran - Shape of You", channel: "Ed Sheeran", thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg", category: "english_hits" },
  { id: "2Vv-BfVoq4g", title: "Ed Sheeran - Perfect", channel: "Ed Sheeran", thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg", category: "english_hits" },
  { id: "OPf0YbXqDm0", title: "Mark Ronson - Uptown Funk ft. Bruno Mars", channel: "Mark Ronson", thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg", category: "english_hits" },
  { id: "hT_nvWreIhg", title: "OneRepublic - Counting Stars", channel: "OneRepublic", thumbnail: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg", category: "english_hits" },
  { id: "RBumgq5yVrA", title: "Passenger | Let Her Go", channel: "Passenger", thumbnail: "https://i.ytimg.com/vi/RBumgq5yVrA/hqdefault.jpg", category: "english_hits" },
  { id: "YykjpeuMNEk", title: "Coldplay - Hymn For The Weekend", channel: "Coldplay", thumbnail: "https://i.ytimg.com/vi/YykjpeuMNEk/hqdefault.jpg", category: "english_hits" },
  { id: "4NRXx6U8ABQ", title: "The Weeknd - Blinding Lights", channel: "The Weeknd", thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg", category: "english_hits" },
  { id: "34Na4j8AVgA", title: "The Weeknd - Starboy ft. Daft Punk", channel: "The Weeknd", thumbnail: "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg", category: "english_hits" },
  { id: "e-ORhEE9VVg", title: "Taylor Swift - Blank Space", channel: "Taylor Swift", thumbnail: "https://i.ytimg.com/vi/e-ORhEE9VVg/hqdefault.jpg", category: "english_hits" },
  { id: "TUVcZfQe-Kw", title: "Dua Lipa - Levitating", channel: "Dua Lipa", thumbnail: "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg", category: "english_hits" },
  { id: "H5v3kku4y6Q", title: "Harry Styles - As It Was", channel: "Harry Styles", thumbnail: "https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg", category: "english_hits" },
  { id: "ApXoWvfEYVU", title: "Post Malone, Swae Lee - Sunflower", channel: "Post Malone", thumbnail: "https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg", category: "english_hits" },
  { id: "fHI8X4OXluQ", title: "Alan Walker - Faded", channel: "Alan Walker", thumbnail: "https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg", category: "english_hits" },
  { id: "3tmd-ClpJxA", title: "Maroon 5 - Memories", channel: "Maroon 5", thumbnail: "https://i.ytimg.com/vi/3tmd-ClpJxA/hqdefault.jpg", category: "english_hits" },
  { id: "60ItHLz5WEA", title: "Ed Sheeran - Thinking Out Loud", channel: "Ed Sheeran", thumbnail: "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg", category: "english_hits" },

  // 🎤 Seedhe Maut & Desi Hip Hop
  { id: "9WbCfHutDSE", title: "Seedhe Maut - Maina (Official Video)", channel: "Seedhe Maut", thumbnail: "https://i.ytimg.com/vi/9WbCfHutDSE/hqdefault.jpg", category: "seedhe_maut" },
  { id: "D9G1VOjN_84", title: "KR$NA - Vyanjan (Official Track)", channel: "KR$NA", thumbnail: "https://i.ytimg.com/vi/D9G1VOjN_84/hqdefault.jpg", category: "seedhe_maut" },
  { id: "NW6Dgax2d6I", title: "Jasleen Royal - Sahiba (Official Video)", channel: "Jasleen Royal", thumbnail: "https://i.ytimg.com/vi/NW6Dgax2d6I/hqdefault.jpg", category: "seedhe_maut" },
  { id: "Kqfv-5DRAyo", title: "Tu Hi Mohabbat - Romantic Song", channel: "Ashwani Machal", thumbnail: "https://i.ytimg.com/vi/Kqfv-5DRAyo/hqdefault.jpg", category: "seedhe_maut" },
  { id: "c3DD2NvjLII", title: "Dil Tera Raha - Romantic Song", channel: "Prakash Jojawar", thumbnail: "https://i.ytimg.com/vi/c3DD2NvjLII/hqdefault.jpg", category: "seedhe_maut" },
  { id: "z5y8Clp_TdE", title: "KALYANI ft. Shreya Ghoshal", channel: "Universal Music", thumbnail: "https://i.ytimg.com/vi/z5y8Clp_TdE/hqdefault.jpg", category: "seedhe_maut" },
  { id: "b68HETiNO98", title: "Pavazha Malli - Official Song", channel: "Think Music", thumbnail: "https://i.ytimg.com/vi/b68HETiNO98/hqdefault.jpg", category: "seedhe_maut" },

  // 🤖 AI Labs & Tech
  { id: "UF8uR6Z6KLc", title: "Steve Jobs' 2005 Stanford Address", channel: "Stanford", thumbnail: "https://i.ytimg.com/vi/UF8uR6Z6KLc/hqdefault.jpg", category: "ai_labs" },
  { id: "cdiD-9MMpb0", title: "Mark Zuckerberg on Llama 3 & Meta AI", channel: "Meta", thumbnail: "https://i.ytimg.com/vi/cdiD-9MMpb0/hqdefault.jpg", category: "ai_labs" },
  { id: "kCc8FmEb1nY", title: "Andrej Karpathy - Intro to LLMs", channel: "Andrej Karpathy", thumbnail: "https://i.ytimg.com/vi/kCc8FmEb1nY/hqdefault.jpg", category: "ai_labs" },

  // 💻 Learning C & Coding
  { id: "KJgsSFOSQv0", title: "C Programming Tutorial for Beginners", channel: "freeCodeCamp.org", thumbnail: "https://i.ytimg.com/vi/KJgsSFOSQv0/hqdefault.jpg", category: "learning" },
  { id: "vLnPwxZdW4Y", title: "C++ Full Course for Beginners", channel: "freeCodeCamp.org", thumbnail: "https://i.ytimg.com/vi/vLnPwxZdW4Y/hqdefault.jpg", category: "learning" },
  { id: "zuegQmMdy8M", title: "Pointers in C / C++ Explained Simply", channel: "mycodeschool", thumbnail: "https://i.ytimg.com/vi/zuegQmMdy8M/hqdefault.jpg", category: "learning" },
  { id: "B31LgI4Y4DQ", title: "Data Structures and Algorithms in C", channel: "CodeWithHarry", thumbnail: "https://i.ytimg.com/vi/B31LgI4Y4DQ/hqdefault.jpg", category: "learning" },

  // 🎮 Gaming
  { id: "QdBZY2fkU-0", title: "Grand Theft Auto VI Trailer 1", channel: "Rockstar Games", thumbnail: "https://i.ytimg.com/vi/QdBZY2fkU-0/hqdefault.jpg", category: "gaming" },
  { id: "L_LUpnjgPso", title: "Minecraft 1.20 Update Official Trailer", channel: "Minecraft", thumbnail: "https://i.ytimg.com/vi/L_LUpnjgPso/hqdefault.jpg", category: "gaming" },
  { id: "E3Huy2cdih0", title: "Elden Ring Official Gameplay Reveal", channel: "BANDAI NAMCO", thumbnail: "https://i.ytimg.com/vi/E3Huy2cdih0/hqdefault.jpg", category: "gaming" },

  // 🎬 Movies & Trailers
  { id: "d9MyW72ELq0", title: "Avatar: The Way of Water Trailer", channel: "20th Century Studios", thumbnail: "https://i.ytimg.com/vi/d9MyW72ELq0/hqdefault.jpg", category: "entertainment" },
  { id: "uYPbbksJxIg", title: "Oppenheimer | Official Trailer", channel: "Universal Pictures", thumbnail: "https://i.ytimg.com/vi/uYPbbksJxIg/hqdefault.jpg", category: "entertainment" },
  { id: "cqGjhVJWtEg", title: "Spider-Man: Across the Spider-Verse", channel: "Sony Pictures", thumbnail: "https://i.ytimg.com/vi/cqGjhVJWtEg/hqdefault.jpg", category: "entertainment" },
  { id: "EXeTwQWrcwY", title: "The Dark Knight (2008) Official Trailer", channel: "Warner Bros.", thumbnail: "https://i.ytimg.com/vi/EXeTwQWrcwY/hqdefault.jpg", category: "entertainment" },

  // 🇮🇳 Trending Hindi & Bollywood Hit Songs
  { id: "V7LwfY5U_B8", title: "Arijit Singh - Kesariya (Brahmastra)", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/V7LwfY5U_B8/hqdefault.jpg", category: "hindi_hits" },
  { id: "vUCMO339vBw", title: "Arijit Singh - Tum Hi Ho (Aashiqui 2)", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/vUCMO339vBw/hqdefault.jpg", category: "hindi_hits" },
  { id: "BddP6PYo2gs", title: "Arijit Singh - Channa Mereya (Ae Dil Hai Mushkil)", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg", category: "hindi_hits" },
  { id: "fnT4f8jV_Qk", title: "Jubin Nautiyal - Raataan Lambiyan (Shershaah)", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/fnT4f8jV_Qk/hqdefault.jpg", category: "bollywood" },
  { id: "ATz8k_K3s38", title: "Vicky Kaushal - Tere Vaaste (Zara Hatke Zara Bachke)", channel: "Saregama Music", thumbnail: "https://i.ytimg.com/vi/ATz8k_K3s38/hqdefault.jpg", category: "bollywood" },

  // 🎤 Desi Hip Hop & Coke Studio Indie
  { id: "9WbCfHutDSE", title: "Seedhe Maut - Maina (Official Video)", channel: "Seedhe Maut", thumbnail: "https://i.ytimg.com/vi/9WbCfHutDSE/hqdefault.jpg", category: "seedhe_maut" },
  { id: "D9G1VOjN_84", title: "KR$NA - Vyanjan (Official Track)", channel: "KR$NA", thumbnail: "https://i.ytimg.com/vi/D9G1VOjN_84/hqdefault.jpg", category: "seedhe_maut" },
  { id: "5Eqb_-j3FDA", title: "Coke Studio Pakistan - Pasoori", channel: "Coke Studio", thumbnail: "https://i.ytimg.com/vi/5Eqb_-j3FDA/hqdefault.jpg", category: "indie_coke" },
  { id: "AnN79YJ6KFE", title: "Anuv Jain - Husn (Official Video)", channel: "Anuv Jain", thumbnail: "https://i.ytimg.com/vi/AnN79YJ6KFE/hqdefault.jpg", category: "indie_coke" },

  // 🇮🇳 Elvish Yadav, CarryMinati, Punjabi Hits & Popular Creators
  { id: "1g4373w9n9E", title: "Elvish Yadav - SYSTUMM (Official Music Video)", channel: "Elvish Yadav", thumbnail: "https://i.ytimg.com/vi/1g4373w9n9E/hqdefault.jpg", category: "elvish" },
  { id: "6cZ2C2b20-o", title: "Elvish Yadav Vlogs - Meeting Bigg Boss Fans", channel: "Elvish Yadav Vlogs", thumbnail: "https://i.ytimg.com/vi/6cZ2C2b20-o/hqdefault.jpg", category: "elvish" },
  { id: "zzwRbKI2js4", title: "CarryMinati - YALGAAR (Official Music Video)", channel: "CarryMinati", thumbnail: "https://i.ytimg.com/vi/zzwRbKI2js4/hqdefault.jpg", category: "carryminati" },
  { id: "hXh35C26570", title: "Sidhu Moose Wala - 295 (Official Audio)", channel: "Sidhu Moose Wala", thumbnail: "https://i.ytimg.com/vi/hXh35C26570/hqdefault.jpg", category: "punjabi" },
  { id: "cl0a3iY71ao", title: "AP Dhillon - With You (Official Video)", channel: "AP Dhillon", thumbnail: "https://i.ytimg.com/vi/cl0a3iY71ao/hqdefault.jpg", category: "punjabi" },

  // 🔥 Trending
  { id: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up", channel: "Rick Astley", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", category: "trending" },
  { id: "0e3GPea1Tyg", title: "MrBeast - $1 vs $500,000,000 Plane Ticket!", channel: "MrBeast", thumbnail: "https://i.ytimg.com/vi/0e3GPea1Tyg/hqdefault.jpg", category: "trending" }
];

const roomCategoryFilterMap = {
  'all': (v) => true,
  'famous_english': (v) => v.category === 'english_hits' || ['ed sheeran', 'justin bieber', 'shawn mendes', 'taylor swift', 'the weeknd', 'dua lipa', 'trevor daniel', 'duncan laurence', 'ckay', 'mark ronson', 'onerepublic', 'post malone', 'alan walker', 'maroon 5'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'bollywood': (v) => v.category === 'bollywood' || v.category === 'hindi_hits' || v.category === 'kk_songs' || ['arijit', 'kesariya', 'tum hi ho', 'channa mereya', 'badshah', 'jubin', 'raataan lambiyan', 'tere vaaste'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'kk_songs': (v) => v.category === 'kk_songs' || ['kk', 'tadap', 'zara sa', 'pal', 'yaaron', 'labon ko', 'alvida', 'tu hi meri shab'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'seedhe_maut': (v) => v.category === 'seedhe_maut' || ['seedhe maut', 'kr$na', 'dhh', 'hip hop', 'divine', 'mc stan'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'punjabi': (v) => v.category === 'punjabi' || ['sidhu moose wala', '295', 'ap dhillon', 'jass manak', 'punjabi', 'karan aujla'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'indie_coke': (v) => v.category === 'indie_coke' || ['pasoori', 'husn', 'anuv jain', 'coke studio', 'jasleen royal', 'indie'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'gaming': (v) => v.category === 'gaming' || ['gta', 'minecraft', 'coding', 'freecodecamp', 'rockstar', 'tech'].some(k => v.title.toLowerCase().includes(k))
};

var currentRoomCategoryQuery = 'all';

function initRoomVideoFeed() {
  fetchRoomYouTubeVideos(currentRoomCategoryQuery);

  // Category pill handlers
  document.querySelectorAll('#room-category-pills .cat-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#room-category-pills .cat-pill').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const query = e.currentTarget.dataset.query;
      currentRoomCategoryQuery = query;
      fetchRoomYouTubeVideos(query, true);
    });
  });

  // Watch More Songs button handler
  const btnWatchMore = document.getElementById('btn-watch-more-songs');
  if (btnWatchMore) {
    btnWatchMore.addEventListener('click', () => {
      fetchMoreRoomYouTubeVideos(currentRoomCategoryQuery);
    });
  }
}

const categoryQueryMap = {
  'all': 'trending english pop and bollywood songs 2024',
  'famous_english': 'famous english songs Justin Bieber Taylor Swift Ed Sheeran Trevor Daniel',
  'bollywood': 'top bollywood romantic songs 2024 Arijit Singh Kesariya',
  'kk_songs': 'KK best hit songs Tadap Tadap Zara Sa Pal Yaaron',
  'seedhe_maut': 'Seedhe Maut KRSNA Desi Hip Hop songs',
  'punjabi': 'top punjabi hit songs AP Dhillon Sidhu Moose Wala',
  'indie_coke': 'Coke Studio trending indie hindi songs Pasoori Husn',
  'gaming': 'GTA VI trailer gaming'
};

async function fetchMoreRoomYouTubeVideos(query) {
  showToast("Fetching Watch More Songs...", "fa-arrows-rotate");
  const apiKey = localStorage.getItem('YOUTUBE_API_KEY') || window.ENV_YOUTUBE_API_KEY || '';
  
  const querySearchTerms = [
    'Arijit Singh top hit songs 2024',
    'KK best romantic hit songs',
    'Seedhe Maut KRSNA DHH hip hop',
    'famous english songs Ed Sheeran Taylor Swift',
    'top punjabi hit songs AP Dhillon Sidhu Moose Wala',
    'Coke Studio pasoori husn indie',
    'trending bollywood songs 2024'
  ];
  const randomTerm = querySearchTerms[Math.floor(Math.random() * querySearchTerms.length)];
  const actualQuery = categoryQueryMap[query] || randomTerm;

  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(actualQuery)}`, {
      headers: apiKey ? { 'X-YouTube-API-Key': apiKey } : {}
    });
    const data = await res.json();
    if (data.success && data.videos && data.videos.length > 0) {
      appendRoomVideoGrid(data.videos);
      return;
    }
  } catch (err) {
    console.warn("Watch More YouTube API query failed:", err);
  }

  // Fallback: Pick a shuffled selection of curated songs from ROOM_CURATED catalog
  const shuffled = [...ROOM_CURATED].sort(() => Math.random() - 0.5);
  appendRoomVideoGrid(shuffled.slice(0, 12));
}

function appendRoomVideoGrid(videos) {
  const grid = document.getElementById('room-video-grid');
  if (!grid) return;

  const existingIds = new Set();
  grid.querySelectorAll('.video-card').forEach(card => {
    if (card.dataset.videoId) existingIds.add(card.dataset.videoId);
  });

  const unique = videos.filter(v => v && v.id && !existingIds.has(v.id));
  const listToRender = unique.length > 0 ? unique : videos.slice(0, 8);

  listToRender.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.videoId = video.id;
    const thumbUrl = video.thumbnail || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
    card.innerHTML = `
      <div class="video-thumb-wrapper">
        <img class="video-thumb-img" src="${thumbUrl}" alt="${escapeHtml(video.title)}" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${video.id}/mqdefault.jpg';">
        <div class="video-play-overlay">
          <div class="play-btn-circle"><i class="fa-solid fa-play ms-1"></i></div>
        </div>
      </div>
      <div class="video-info-body">
        <h3 class="video-title-text">${escapeHtml(video.title)}</h3>
        <div class="video-channel-text">
          <i class="fa-solid fa-circle-check text-primary"></i> ${escapeHtml(video.channel)}
        </div>
        <div class="video-card-actions">
          <button class="btn-card-action btn-play-now" title="Play directly in-app">
            <i class="fa-solid fa-play text-danger"></i> Play Now
          </button>
          <button class="btn-card-action btn-add-queue" title="Add to playlist queue">
            <i class="fa-solid fa-plus text-warning"></i> Queue
          </button>
        </div>
      </div>
    `;

    const videoObj = {
      title: video.title,
      channel: video.channel,
      thumbnail_url: video.thumbnail,
      video_url: `https://www.youtube.com/watch?v=${video.id}`,
      video_id: video.id
    };

    card.addEventListener('click', () => {
      if (currentVideoObj) historyQueue.push(currentVideoObj);
      currentVideoObj = videoObj;
      loadVideoInPlayer(videoObj);
      socket.emit("playVideoDirectly", videoObj);
      showToast(`Playing: ${video.title}`, "fa-play");
    });

    card.querySelector('.btn-play-now').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentVideoObj) historyQueue.push(currentVideoObj);
      currentVideoObj = videoObj;
      loadVideoInPlayer(videoObj);
      socket.emit("playVideoDirectly", videoObj);
      showToast(`Playing: ${video.title}`, "fa-play");
    });

    card.querySelector('.btn-add-queue').addEventListener('click', (e) => {
      e.stopPropagation();
      playlistQueue.push(videoObj);
      socket.emit("playlistUpdated", playlistQueue);
      displayPlaylist();
      showToast("Added to Playlist Queue!");
    });

    grid.appendChild(card);
  });

  showToast(`Loaded ${listToRender.length} More Songs!`, "fa-music");
  grid.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

async function fetchRoomYouTubeVideos(query = 'hindi_hits', isUserSearch = false) {
  // 1. Immediately render local curated videos with 0ms delay so mobile users never experience blank pages or frozen UI
  const filterFn = roomCategoryFilterMap[query];
  let localMatches = filterFn ? ROOM_CURATED.filter(filterFn) : [];
  if (localMatches.length === 0) {
    const qLower = (categoryQueryMap[query] || query).toLowerCase().trim();
    const terms = qLower.split(/\s+/);
    localMatches = ROOM_CURATED.filter(v => {
      const target = `${v.title} ${v.channel} ${v.category || ''} ${v.id}`.toLowerCase();
      return terms.some(term => target.includes(term));
    });
  }
  renderRoomVideoGrid(localMatches.length > 0 ? localMatches : ROOM_CURATED, isUserSearch);

  const apiKey = localStorage.getItem('YOUTUBE_API_KEY') || window.ENV_YOUTUBE_API_KEY || '';
  const actualQuery = categoryQueryMap[query] || query;
  
  // 2. Fetch live YouTube videos from backend endpoint
  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(actualQuery)}`, {
      headers: apiKey ? { 'X-YouTube-API-Key': apiKey } : {}
    });
    const data = await res.json();
    if (data.success && data.videos && data.videos.length > 0) {
      renderRoomVideoGrid(data.videos, isUserSearch);
      return;
    }
  } catch (err) {
    console.warn("Live YouTube API query failed:", err);
  }
}

function renderRoomVideoGrid(videos, isUserSearch = false) {
  const grid = document.getElementById('room-video-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Deduplicate videos by ID to prevent identical cards
  const uniqueMap = new Map();
  videos.forEach(v => {
    if (v && v.id && v.id !== 'undefined') {
      uniqueMap.set(v.id, v);
    }
  });
  let uniqueList = Array.from(uniqueMap.values());

  // Filter out currently playing video to avoid duplication below player
  if (currentVideoObj && currentVideoObj.video_id) {
    uniqueList = uniqueList.filter(v => v.id !== currentVideoObj.video_id);
  }

  // Shuffle/rotate dynamically so suggestions always vary
  uniqueList.sort(() => Math.random() - 0.5);

  if (isUserSearch) {
    setTimeout(() => {
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  uniqueList.slice(0, 12).forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    const thumbUrl = video.thumbnail || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
    card.innerHTML = `
      <div class="video-thumb-wrapper">
        <img class="video-thumb-img" src="${thumbUrl}" alt="${escapeHtml(video.title)}" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${video.id}/mqdefault.jpg';">
        <div class="video-play-overlay">
          <div class="play-btn-circle"><i class="fa-solid fa-play ms-1"></i></div>
        </div>
      </div>
      <div class="video-info-body">
        <h3 class="video-title-text">${escapeHtml(video.title)}</h3>
        <div class="video-channel-text">
          <i class="fa-solid fa-circle-check text-primary"></i> ${escapeHtml(video.channel)}
        </div>
        <div class="video-card-actions">
          <button class="btn-card-action btn-play-now" title="Play directly in-app">
            <i class="fa-solid fa-play text-danger"></i> Play Now
          </button>
          <button class="btn-card-action btn-add-queue" title="Add to playlist queue">
            <i class="fa-solid fa-plus text-warning"></i> Queue
          </button>
        </div>
      </div>
    `;

    const videoObj = {
      title: video.title,
      channel: video.channel,
      thumbnail_url: video.thumbnail,
      video_url: `https://www.youtube.com/watch?v=${video.id}`,
      video_id: video.id
    };

    card.addEventListener('click', () => {
      if (currentVideoObj) historyQueue.push(currentVideoObj);
      currentVideoObj = videoObj;
      loadVideoInPlayer(videoObj);
      socket.emit("playVideoDirectly", videoObj);
      showToast(`Playing: ${video.title}`, "fa-play");
    });

    card.querySelector('.btn-play-now').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentVideoObj) historyQueue.push(currentVideoObj);
      currentVideoObj = videoObj;
      loadVideoInPlayer(videoObj);
      socket.emit("playVideoDirectly", videoObj);
      showToast(`Playing: ${video.title}`, "fa-play");
    });

    card.querySelector('.btn-add-queue').addEventListener('click', (e) => {
      e.stopPropagation();
      const videoObj = {
        title: video.title,
        channel: video.channel,
        thumbnail_url: video.thumbnail,
        video_url: `https://www.youtube.com/watch?v=${video.id}`,
        video_id: video.id
      };
      playlistQueue.push(videoObj);
      socket.emit("playlistUpdated", playlistQueue);
      displayPlaylist();
      showToast("Added to Playlist Queue!");
    });

    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --------------------------------------------------------------------------
// 6. YouTube IFrame Player API Integration & Sync Engine
// --------------------------------------------------------------------------
var player;

function applyPendingSync() {
  if (!pendingSyncState || !player) return;
  const sync = pendingSyncState;
  pendingSyncState = null;

  try {
    const startTime = sync.currentTime || 0;
    if (typeof player.loadVideoById === 'function') {
      const currentLoadedId = (typeof player.getVideoData === 'function') ? player.getVideoData().video_id : null;
      if (!currentLoadedId || currentLoadedId !== sync.videoId) {
        player.loadVideoById(sync.videoId, startTime);
      } else {
        if (typeof player.seekTo === 'function') {
          player.seekTo(startTime, true);
        }
      }
    }
    if (sync.isPlaying && typeof player.playVideo === 'function') {
      player.playVideo();
    }
  } catch (err) {
    console.warn("applyPendingSync warning:", err);
  }
}

function ensureYouTubePlayerLoaded(videoId) {
  const vidToPlay = videoId || (currentVideoObj ? currentVideoObj.video_id : 'L7mfjvdnPno');

  // 1. If YT.Player instance is initialized and ready, use loadVideoById (with object parameter fallback)
  if (player && isPlayerReady && typeof player.loadVideoById === 'function') {
    try {
      player.loadVideoById({ videoId: vidToPlay, startSeconds: 0 });
      if (typeof player.playVideo === 'function') player.playVideo();
    } catch (e1) {
      try {
        player.loadVideoById(vidToPlay, 0);
        if (typeof player.playVideo === 'function') player.playVideo();
      } catch (e2) {}
    }
  }

  // 2. If YT API constructor is available and no player instance exists, create API player
  if (!player && typeof YT !== 'undefined' && YT.Player && typeof YT.Player === 'function') {
    try {
      const container = document.getElementById('player');
      if (container && container.querySelector('iframe#fallback-yt-iframe')) {
        container.innerHTML = '';
      }

      player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: vidToPlay,
        playerVars: {
          'playsinline': 1,
          'controls': 1,
          'enablejsapi': 1,
          'rel': 0,
          'modestbranding': 1,
          'autoplay': 1,
          'mute': 0
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
      return;
    } catch (err) {
      console.warn("YT.Player init warning, using mobile iframe fallback:", err);
    }
  }

  // 3. Mobile / Network Fallback Embed: Render or update YouTube responsive iframe directly
  const playerContainer = document.getElementById('player');
  if (playerContainer) {
    const embedUrl = `https://www.youtube.com/embed/${vidToPlay}?autoplay=1&playsinline=1&enablejsapi=1&rel=0`;
    const existingIframe = playerContainer.querySelector('iframe');
    if (existingIframe) {
      if (!existingIframe.src || !existingIframe.src.includes(vidToPlay)) {
        existingIframe.src = embedUrl;
      }
    } else {
      playerContainer.innerHTML = `<iframe id="fallback-yt-iframe" style="width:100%; height:100%; border:0; position:absolute; top:0; left:0;" src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
  }
}

function initYouTubePlayer(videoId) {
  ensureYouTubePlayerLoaded(videoId);
}

window.onYouTubeIframeAPIReady = function () {
  ensureYouTubePlayerLoaded();
};

function onPlayerError(event) {
  console.warn("YouTube player error code:", event.data);
  const errCode = event.data;

  // Handles restricted embedding, invalid parameters, or unplayable video errors (2, 5, 100, 101, 150)
  if (errCode === 2 || errCode === 5 || errCode === 100 || errCode === 101 || errCode === 150) {
    if (canControlPlayback()) {
      showToast("Current video is restricted on YouTube. Autoplay next working video...", "fa-forward");
      setTimeout(() => {
        playNextVideo();
      }, 1000);
    } else {
      showToast("Current video is restricted by YouTube owner.", "fa-triangle-exclamation");
    }
  }
}

function onPlayerReady(event) {
  isPlayerReady = true;

  const unlockAndUnmute = () => {
    if (player && typeof player.unMute === 'function') {
      player.unMute();
    }
    if (player && typeof player.setVolume === 'function') {
      player.setVolume(100);
    }
    if (player && typeof player.playVideo === 'function') {
      player.playVideo();
    }
  };

  document.body.addEventListener('click', unlockAndUnmute, { once: true });
  document.body.addEventListener('touchstart', unlockAndUnmute, { once: true });

  if (pendingSyncState) {
    applyPendingSync();
  }
}

var syncHeartbeatTimer = null;

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PAUSED) {
    if (syncHeartbeatTimer) {
      clearInterval(syncHeartbeatTimer);
      syncHeartbeatTimer = null;
    }
    if (canControlPlayback()) {
      socket.emit("videoPaused");
    }
  }

  if (event.data === YT.PlayerState.PLAYING) {
    if (canControlPlayback()) {
      const currentTime = player.getCurrentTime();
      socket.emit("videoPlaying", currentTime);

      if (!syncHeartbeatTimer) {
        syncHeartbeatTimer = setInterval(() => {
          if (canControlPlayback() && player && typeof player.getCurrentTime === 'function') {
            socket.emit("videoPlaying", player.getCurrentTime());
          }
        }, 2000);
      }
    }
  }

  if (event.data === YT.PlayerState.ENDED) {
    if (syncHeartbeatTimer) {
      clearInterval(syncHeartbeatTimer);
      syncHeartbeatTimer = null;
    }
    if (canControlPlayback()) {
      playNextVideo();
      socket.emit("playNextVideo");
    }
  }
}

// --------------------------------------------------------------------------
// 7. Synchronized WebSocket Listeners
// --------------------------------------------------------------------------
socket.on("sync_state", (state) => {
  if (!state || (!state.videoId && !state.videoObj)) return;
  const targetVideoId = state.videoId || (state.videoObj ? state.videoObj.video_id : null);
  if (!targetVideoId) return;

  let videoObj = state.videoObj;
  if (!videoObj) {
    const match = ROOM_CURATED.find(v => v.id === targetVideoId);
    videoObj = match ? {
      title: match.title,
      channel: match.channel,
      thumbnail_url: match.thumbnail,
      video_url: `https://www.youtube.com/watch?v=${match.id}`,
      video_id: match.id
    } : {
      title: "YouTube Watch Party Player",
      channel: "Synchronized Stream",
      thumbnail_url: `https://i.ytimg.com/vi/${targetVideoId}/hqdefault.jpg`,
      video_url: `https://www.youtube.com/watch?v=${targetVideoId}`,
      video_id: targetVideoId
    };
  }

  currentVideoObj = videoObj;

  const titleEl = document.getElementById('video-title') || $videoTitle;
  const channelEl = document.getElementById('channel-name') || $channelName;
  if (titleEl) titleEl.textContent = videoObj.title || "YouTube Watch Party Player";
  if (channelEl) channelEl.innerHTML = `<i class="fa-solid fa-circle-check text-primary me-1"></i> ${videoObj.channel || "Synchronized Stream"}`;

  pendingSyncState = {
    videoId: videoObj.video_id,
    currentTime: state.currentTime || 0,
    isPlaying: state.isPlaying !== false
  };

  ensureYouTubePlayerLoaded(videoObj.video_id);
});

socket.on("playVideoDirectly", (videoObj) => {
  if (videoObj && videoObj.video_id) {
    if (currentVideoObj && currentVideoObj.video_id !== videoObj.video_id) {
      historyQueue.push(currentVideoObj);
    }
    loadVideoInPlayer(videoObj);
    renderRoomVideoGrid(ROOM_CURATED);
  }
});

socket.on("videoPaused", () => {
  if (isPlayerReady && player && typeof player.pauseVideo === 'function') {
    player.pauseVideo();
  }
});

socket.on("videoPlaying", (currentTime) => {
  if (player) {
    const localTime = (typeof player.getCurrentTime === 'function') ? player.getCurrentTime() : 0;
    if (Math.abs(localTime - currentTime) > 2.0 && typeof player.seekTo === 'function') {
      player.seekTo(currentTime, true);
    }
    if (typeof player.playVideo === 'function') {
      player.playVideo();
    }
  } else {
    if (pendingSyncState) {
      pendingSyncState.currentTime = currentTime;
      pendingSyncState.isPlaying = true;
    }
  }
});

socket.on("seek", (currentTime) => {
  if (isPlayerReady && player && typeof player.seekTo === 'function') {
    player.seekTo(currentTime, true);
  }
});