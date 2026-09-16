// ==========================================================================
// YouTube Party - Realtime Synchronized Room Controller (RBAC Enabled)
// ==========================================================================

var serverUrl = window.location.hostname.includes('vercel.app')
  ? 'https://yotube-watch-party.onrender.com'
  : undefined;

var socket = io(serverUrl);

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
var username = (rawUserParam && rawUserParam.trim() && rawUserParam !== 'null' && rawUserParam !== 'undefined')
  ? rawUserParam.trim()
  : ('Guest-' + Math.floor(1000 + Math.random() * 9000));
var roomid;
var currentRole = 'PARTICIPANT';
var isHost = false;
var hostSocketId = '';
var control = 1;
var unreadMessagesCount = 0;

var currentVideoObj = { title: "Shawn Mendes - Treat You Better", channel: "Shawn Mendes", video_id: "sQVeK7dT18Y" };
var playlistQueue = [];
var historyQueue = [];

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
  if (greetEl) greetEl.textContent = `User: ${username}`;

  loadVideoInPlayer(currentVideoObj);
  initApiKeyManager();
  initCopyButtons();
  initSidebarTabs();
  initRoomVideoFeed();
  initSmartNavbarScroll();
  initEmojiBar();
  initialSetup();

  if (typeof YT !== 'undefined' && YT.Player) {
    initYouTubePlayer();
  }
});

function initSmartNavbarScroll() {
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar-custom');
    if (!navbar) return;
    const currentScrollY = window.scrollY;
    if (currentScrollY > 80 && currentScrollY > lastScrollY) {
      navbar.classList.add('navbar-hidden');
    } else {
      navbar.classList.remove('navbar-hidden');
    }
    lastScrollY = currentScrollY;
  });
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
      const code = document.getElementById('roomid').value;
      navigator.clipboard.writeText(code);
      showToast("Room Code Copied!");
    });
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
      const link = `${window.location.origin}/room.html?roomid=${roomid}`;
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
  if (params.has('roomid')) {
    roomid = params.get('roomid');
    socket.emit("joinRoom", { username, roomid });
    document.getElementById("roomid").value = roomid;
  } else {
    socket.emit("createRoom", { username });
    socket.on("getRoomID", (id) => {
      roomid = id;
      document.getElementById("roomid").value = id;

      if (params.has('initialVideo')) {
        const initialUrl = params.get('initialVideo');
        addVideoFromUrl(initialUrl, true);
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
  if (!videoObj) return;
  currentVideoObj = videoObj;

  const titleEl = document.getElementById('video-title') || $videoTitle;
  const channelEl = document.getElementById('channel-name') || $channelName;

  if (titleEl) titleEl.textContent = videoObj.title || "YouTube Watch Party Player";
  if (channelEl) channelEl.innerHTML = `<i class="fa-solid fa-circle-check text-primary me-1"></i> ${videoObj.channel || "Synchronized Stream"}`;

  if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById(videoObj.video_id, 0);
  } else {
    initYouTubePlayer(videoObj.video_id);
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

      if (autoPlayIfFirst && (!currentVideoObj || currentVideoObj.video_id === 'M7lc1UVf-VE')) {
        currentVideoObj = video;
        loadVideoInPlayer(video);
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
      playlistQueue.push(video);
      socket.emit("playlistUpdated", playlistQueue);
      displayPlaylist();
      showToast("Video Added to Playlist Queue!");
    });
}

if ($urlForm) {
  $urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = $urlForm.elements['url'].value.trim();
    if (url) {
      addVideoFromUrl(url);
      $urlForm.elements['url'].value = '';
    }
  });
}

// --------------------------------------------------------------------------
// 4. Socket.IO Listeners & RBAC Events
// --------------------------------------------------------------------------

$messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  $messageFormButton.setAttribute('disabled', 'disabled');
  const message = $messageFormInput.value.trim();
  if (!message) {
    $messageFormButton.removeAttribute('disabled');
    return;
  }

  // Ensure Chat tab is visible when user sends a message
  switchToTab('chat');

  socket.emit('sendMessage', message, () => {
    $messageFormButton.removeAttribute('disabled');
    $messageFormInput.value = '';
    $messageFormInput.focus();
  });
});

socket.on('message', (message) => {
  const isSystem = message.username === 'System';
  const isMe = !isSystem && ((message.senderId && message.senderId === socket.id) || (message.username === username));
  const isHostMsg = message.isHost || (message.username && message.username.includes('(Owner)'));
  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const html = Mustache.render(messageTemplate, {
    username: message.username,
    message: message.text,
    meClass: isMe ? 'me' : '',
    badge: isHostMsg ? '<span class="chat-author-badge">Host</span>' : '',
    isSystem: isSystem,
    time: timeStr
  });

  $messages.insertAdjacentHTML('beforeend', html);
  $messages.scrollTop = $messages.scrollHeight;

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
  const list = data.usersList;
  hostSocketId = data.hostSocketId;

  const usersContainer = document.getElementById('users') || document.querySelector('#users');
  if (usersContainer) {
    usersContainer.innerHTML = '';
  }

  const countEl = document.getElementById('members-count');
  if (countEl) countEl.textContent = list.length;

  // Find my role in the updated list
  const me = list.find(u => u && u.id === socket.id);
  if (me) {
    currentRole = me.role;
    isHost = (currentRole === 'HOST' || currentRole === 'ADMIN');
  }

  list.forEach(user => {
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

    // Generate Host Control Action Icons if current user is Host and target is not Host
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

    if (usersContainer) {
      usersContainer.insertAdjacentHTML('beforeend', html);
    }
  });

  attachHostControlListeners();
});

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

// RBAC Event Feedback
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

  // 🔥 Trending
  { id: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up", channel: "Rick Astley", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", category: "trending" },
  { id: "0e3GPea1Tyg", title: "MrBeast - $1 vs $500,000,000 Plane Ticket!", channel: "MrBeast", thumbnail: "https://i.ytimg.com/vi/0e3GPea1Tyg/hqdefault.jpg", category: "trending" }
];

function initRoomVideoFeed() {
  const searchInput = document.getElementById('room-search-input');
  const pillsContainer = document.getElementById('room-category-pills');

  fetchRoomYouTubeVideos();

  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = e.target.value.trim();
        if (q) fetchRoomYouTubeVideos(q);
        else renderRoomVideoGrid(ROOM_CURATED);
      }, 400);
    });
  }

  if (pillsContainer) {
    pillsContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      document.querySelectorAll('#room-category-pills .cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.dataset.category;
      fetchRoomYouTubeVideos(cat === 'trending' ? 'trending' : cat);
    });
  }
}

const categoryQueryMap = {
  'famous_english': 'famous english songs Justin Bieber Shawn Mendes Taylor Swift',
  'kk_songs': 'KK best hit songs bollywood Tadap Tadap Zara Sa Pal',
  'bieber_shawn': 'Justin Bieber Shawn Mendes official music videos',
  'pop_hits': 'viral pop english songs 2024',
  'seedhe_maut': 'Seedhe Maut hip hop songs',
  'learning': 'C programming full course freeCodeCamp',
  'gaming': 'GTA VI trailer gaming'
};

async function fetchRoomYouTubeVideos(query = 'famous_english') {
  const apiKey = localStorage.getItem('YOUTUBE_API_KEY') || window.ENV_YOUTUBE_API_KEY || '';
  const actualQuery = categoryQueryMap[query] || query;
  
  // 1. Official YouTube Data API v3 using universal system key
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(actualQuery)}&type=video&videoEmbeddable=true&key=${apiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const formatted = data.items
          .filter(item => item.id && item.id.videoId)
          .slice(0, 12)
          .map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : (item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : item.snippet.thumbnails.default.url)
          }));
        if (formatted.length > 0) {
          renderRoomVideoGrid(formatted);
          return;
        }
      }
    } catch (err) {
      console.warn("API Key query failed, using public search fallback", err);
    }
  }

  // 2. Public Invidious YouTube Search Engine (No Key Required!)
  try {
    const invidiousUrl = `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
    const res = await fetch(invidiousUrl);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const formatted = data
        .filter(item => item.videoId)
        .slice(0, 12)
        .map(item => ({
          id: item.videoId,
          title: item.title,
          channel: item.author,
          thumbnail: item.videoThumbnails && item.videoThumbnails[0] ? item.videoThumbnails[0].url : `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`
        }));
      if (formatted.length > 0) {
        renderRoomVideoGrid(formatted);
        return;
      }
    }
  } catch (err) {
    console.warn("Invidious public search offline, filtering ROOM_CURATED list", err);
  }

  // 3. Fallback to local ROOM_CURATED list
  const qLower = query.toLowerCase();
  const filtered = ROOM_CURATED.filter(v =>
    v.title.toLowerCase().includes(qLower) ||
    v.category.toLowerCase().includes(qLower) ||
    v.channel.toLowerCase().includes(qLower)
  );
  renderRoomVideoGrid(filtered.length > 0 ? filtered : ROOM_CURATED);
}

function renderRoomVideoGrid(videos) {
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

  uniqueList.slice(0, 12).forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <div class="video-thumb-wrapper">
        <img class="video-thumb-img" src="${video.thumbnail}" alt="${escapeHtml(video.title)}">
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

    card.querySelector('.btn-play-now').addEventListener('click', (e) => {
      e.stopPropagation();
      const videoObj = {
        title: video.title,
        channel: video.channel,
        thumbnail_url: video.thumbnail,
        video_url: `https://www.youtube.com/watch?v=${video.id}`,
        video_id: video.id
      };

      if (!canControlPlayback()) {
        requestPlaybackAction('change_video', videoObj);
        return;
      }

      if (currentVideoObj) historyQueue.push(currentVideoObj);
      currentVideoObj = videoObj;
      loadVideoInPlayer(videoObj);
      socket.emit("playVideoDirectly", videoObj);
      showToast("Playing Video in App!");
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

function initYouTubePlayer(videoId) {
  const vidToPlay = videoId || (currentVideoObj ? currentVideoObj.video_id : 'sQVeK7dT18Y');

  if (player) {
    if (typeof player.loadVideoById === 'function') {
      player.loadVideoById(vidToPlay, 0);
    }
    return;
  }

  if (typeof YT !== 'undefined' && YT.Player) {
    player = new YT.Player('player', {
      height: '450',
      width: '800',
      videoId: vidToPlay,
      playerVars: {
        'playsinline': 1,
        'controls': control,
        'start': 0,
        'disablekb': 1,
        'rel': 0,
        'autoplay': 0
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });
  }
}

window.onYouTubeIframeAPIReady = function () {
  initYouTubePlayer();
};

var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
if (firstScriptTag && firstScriptTag.parentNode) {
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

function onPlayerError(event) {
  console.warn("YouTube player error (video unavailable/restricted):", event.data);
  showToast("Video unavailable/restricted, autoplaying next video...", "fa-forward");
  setTimeout(() => {
    playNextVideo();
  }, 800);
}

function onPlayerReady(event) {
  if (currentVideoObj) {
    loadVideoInPlayer(currentVideoObj);
  }
  event.target.pauseVideo();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PAUSED) {
    if (canControlPlayback()) {
      socket.emit("videoPaused");
    }
  }

  if (event.data === YT.PlayerState.PLAYING) {
    if (canControlPlayback()) {
      const currentTime = player.getCurrentTime();
      socket.emit("videoPlaying", currentTime);
    }
  }

  if (event.data === YT.PlayerState.ENDED) {
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
  if (!state || !state.videoId) return;
  const targetVideoId = state.videoId;

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
      title: "Shawn Mendes - Treat You Better",
      channel: "Shawn Mendes",
      thumbnail_url: `https://i.ytimg.com/vi/${targetVideoId}/hqdefault.jpg`,
      video_url: `https://www.youtube.com/watch?v=${targetVideoId}`,
      video_id: targetVideoId
    };
  }

  loadVideoInPlayer(videoObj);

  if (player && typeof player.seekTo === 'function') {
    player.seekTo(state.currentTime || 0, true);
    if (state.isPlaying && typeof player.playVideo === 'function') {
      player.playVideo();
    } else if (!state.isPlaying && typeof player.pauseVideo === 'function') {
      player.pauseVideo();
    }
  }
});

socket.on("playVideoDirectly", (videoObj) => {
  if (videoObj && videoObj.video_id) {
    loadVideoInPlayer(videoObj);
  }
});

socket.on("videoPaused", () => {
  if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
});

socket.on("videoPlaying", (currentTime) => {
  if (player && typeof player.seekTo === 'function' && typeof player.playVideo === 'function') {
    player.seekTo(currentTime, true);
    player.playVideo();
  }
});

socket.on("seek", (currentTime) => {
  if (player && typeof player.seekTo === 'function') {
    player.seekTo(currentTime, true);
  }
});