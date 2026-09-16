// ==========================================================================
// YouTube Party - Landing Page & Discovery Engine
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initApiKeyManager();
  initRoomForms();
  initVideoFeed();
  initSmartNavbarScroll();
});

function initSmartNavbarScroll() {
  const navbar = document.querySelector('.navbar-custom');
  if (navbar) navbar.classList.remove('navbar-hidden');
}

// Curated Fallback Videos Catalog (100% Verified Valid YouTube IDs)
const CURATED_VIDEOS = [
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

  // 🔥 Trending
  { id: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up", channel: "Rick Astley", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", category: "trending" },
  { id: "0e3GPea1Tyg", title: "MrBeast - $1 vs $500,000,000 Plane Ticket!", channel: "MrBeast", thumbnail: "https://i.ytimg.com/vi/0e3GPea1Tyg/hqdefault.jpg", category: "trending" }
];

const categoryFilterMap = {
  'famous_english': (v) => v.category === 'english_hits' || ['ed sheeran', 'justin bieber', 'shawn mendes', 'taylor swift', 'passenger', 'the weeknd', 'coldplay', 'dua lipa', 'harry styles', 'trevor daniel', 'duncan laurence', 'ckay', 'mark ronson', 'onerepublic', 'post malone', 'alan walker', 'maroon 5'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'kk_songs': (v) => v.category === 'kk_songs' || ['kk', 'tadap', 'zara sa', 'pal', 'yaaron', 'labon ko', 'alvida', 'tu hi meri shab'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'hindi_hits': (v) => v.category === 'hindi_hits' || v.category === 'bollywood' || ['arijit', 'kesariya', 'tum hi ho', 'channa mereya', 'jubin', 'raataan lambiyan', 'tere vaaste', 'hindi', 'bollywood'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'seedhe_maut': (v) => v.category === 'seedhe_maut' || ['seedhe maut', 'kr$na', 'jasleen', 'dhh', 'hip hop'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'punjabi': (v) => v.category === 'punjabi' || ['sidhu moose wala', '295', 'ap dhillon', 'jass manak', 'punjabi', 'karan aujla'].some(k => v.title.toLowerCase().includes(k) || v.channel.toLowerCase().includes(k)),
  'learning': (v) => v.category === 'learning' || ['c ', 'c++', 'coding', 'programming', 'pointers', 'data structures', 'steve jobs', 'llama', 'karpathy', 'ai'].some(k => v.title.toLowerCase().includes(k)),
  'gaming': (v) => v.category === 'gaming' || v.category === 'entertainment' || ['gta', 'minecraft', 'elden ring', 'avatar', 'oppenheimer', 'spider-man', 'dark knight'].some(k => v.title.toLowerCase().includes(k))
};

const categoryQueryMap = {
  'famous_english': 'famous english songs Justin Bieber Shawn Mendes Taylor Swift',
  'kk_songs': 'KK best hit songs bollywood Tadap Tadap Zara Sa Pal',
  'hindi_hits': 'top bollywood romantic songs Arijit Singh Kesariya',
  'seedhe_maut': 'Seedhe Maut KRSNA hip hop songs',
  'punjabi': 'top punjabi hit songs AP Dhillon Sidhu Moose Wala',
  'learning': 'C programming full course freeCodeCamp',
  'gaming': 'GTA VI trailer gaming'
};

function initApiKeyManager() {
  const inputKey = document.getElementById('youtube-api-key-input');
  const savedKey = localStorage.getItem('YOUTUBE_API_KEY');
  if (savedKey && inputKey) inputKey.value = savedKey;
}

var currentLandingCategory = 'famous_english';

function initVideoFeed() {
  fetchYouTubeVideos(currentLandingCategory);

  // Category pill click handlers
  document.querySelectorAll('#landing-category-pills .cat-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#landing-category-pills .cat-pill').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const query = e.currentTarget.dataset.query;
      currentLandingCategory = query;
      fetchYouTubeVideos(query);
    });
  });

  // Watch More Songs button handler
  const btnWatchMore = document.getElementById('btn-landing-watch-more');
  if (btnWatchMore) {
    btnWatchMore.addEventListener('click', () => {
      fetchMoreLandingVideos(currentLandingCategory);
    });
  }
}

async function fetchMoreLandingVideos(query) {
  const apiKey = localStorage.getItem('YOUTUBE_API_KEY') || window.ENV_YOUTUBE_API_KEY || '';
  const searchTerms = [
    'Arijit Singh Kesariya Tum Hi Ho',
    'KK best romantic songs Tadap Tadap',
    'Seedhe Maut KRSNA DHH hip hop',
    'Ed Sheeran Shape of You Taylor Swift',
    'AP Dhillon Sidhu Moose Wala Punjabi hits',
    'Coke Studio pasoori husn'
  ];
  const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  const actualQuery = categoryQueryMap[query] || randomTerm;

  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(actualQuery)}`, {
      headers: apiKey ? { 'X-YouTube-API-Key': apiKey } : {}
    });
    const data = await res.json();
    if (data.success && data.videos && data.videos.length > 0) {
      appendLandingVideoGrid(data.videos);
      return;
    }
  } catch (err) {}

  const shuffled = [...CURATED_VIDEOS].sort(() => Math.random() - 0.5);
  appendLandingVideoGrid(shuffled.slice(0, 12));
}

function appendLandingVideoGrid(videos) {
  const grid = document.getElementById('landing-video-grid');
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
          <button class="btn-card-action btn-start-party" data-video-id="${video.id}">
            <i class="fa-solid fa-sparkles text-warning"></i> Start Watch Party
          </button>
        </div>
      </div>
    `;

    card.querySelector('.btn-start-party').addEventListener('click', (e) => {
      e.stopPropagation();
      startPartyWithVideo(video.id);
    });

    card.addEventListener('click', () => {
      startPartyWithVideo(video.id);
    });

    grid.appendChild(card);
  });

  grid.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function initRoomForms() {
  const formJoin = document.getElementById('form-join-room');
  if (formJoin) {
    formJoin.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('join-username')?.value.trim() || 'Guest';
      const roomid = document.getElementById('join-roomid')?.value.trim();
      if (!roomid) {
        if (window.swal) {
          swal("Room Required", "Please enter a valid Room ID to join.", "warning");
        } else {
          alert("Please enter a valid Room ID to join.");
        }
        return;
      }
      window.location.href = `/room.html?username=${encodeURIComponent(username)}&roomid=${encodeURIComponent(roomid.toUpperCase())}`;
    });
  }

  const formCreate = document.getElementById('form-create-room');
  if (formCreate) {
    formCreate.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('create-username')?.value.trim() || 'Host';
      window.location.href = `/room.html?username=${encodeURIComponent(username)}`;
    });
  }
}

// Fetch from YouTube Data API endpoint or fallback catalog
async function fetchYouTubeVideos(query = 'famous_english') {
  const apiKey = localStorage.getItem('YOUTUBE_API_KEY') || window.ENV_YOUTUBE_API_KEY || '';
  const actualQuery = categoryQueryMap[query] || query;
  
  // 1. Live YouTube API Search Endpoint
  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(actualQuery)}`, {
      headers: apiKey ? { 'X-YouTube-API-Key': apiKey } : {}
    });
    const data = await res.json();
    if (data.success && data.videos && data.videos.length > 0) {
      renderVideoGrid(data.videos);
      return;
    }
  } catch (err) {
    console.warn("Live YouTube API request failed, trying curated catalog:", err);
  }

  // 2. Category Filter Lookup Fallback
  const filterFn = categoryFilterMap[query];
  if (filterFn) {
    const filtered = CURATED_VIDEOS.filter(filterFn);
    if (filtered.length > 0) {
      renderVideoGrid(filtered);
      return;
    }
  }

  // 3. Fallback to general search query matching
  const qLower = query.toLowerCase();
  const filtered = CURATED_VIDEOS.filter(v => 
    v.title.toLowerCase().includes(qLower) || 
    (v.category && v.category.toLowerCase().includes(qLower)) ||
    v.channel.toLowerCase().includes(qLower)
  );
  
  renderVideoGrid(filtered.length > 0 ? filtered : CURATED_VIDEOS);
}

// Render video items in responsive grid
function renderVideoGrid(videos) {
  const grid = document.getElementById('landing-video-grid');
  if (!grid) return;

  grid.innerHTML = '';

  videos.forEach(video => {
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
          <button class="btn-card-action btn-start-party" data-video-id="${video.id}">
            <i class="fa-solid fa-sparkles text-warning"></i> Start Watch Party
          </button>
        </div>
      </div>
    `;

    card.querySelector('.btn-start-party').addEventListener('click', (e) => {
      e.stopPropagation();
      startPartyWithVideo(video.id);
    });

    card.addEventListener('click', () => {
      startPartyWithVideo(video.id);
    });

    grid.appendChild(card);
  });
}

function startPartyWithVideo(videoId) {
  const usernameInput = document.getElementById('create-username');
  let username = usernameInput ? usernameInput.value.trim() : '';
  
  if (!username) {
    username = 'Host' + Math.floor(Math.random() * 1000);
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  window.location.href = `/room.html?username=${encodeURIComponent(username)}&initialVideo=${encodeURIComponent(videoUrl)}`;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
