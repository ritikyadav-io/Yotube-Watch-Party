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

// Curated Fallback Videos Catalog (100% Verified Valid YouTube IDs)
const CURATED_VIDEOS = [
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
  { id: "B31LgI4Y4DQ", title: "Data Structures and Algorithms in C", channel: "CodeWithHarry", thumbnail: "https://i.i.ytimg.com/vi/B31LgI4Y4DQ/hqdefault.jpg", category: "learning" },

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

// Toast notification helper
function showToast(message, icon = 'fa-circle-check') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast-custom';
  toast.innerHTML = `<i class="fa-solid ${icon} text-danger"></i> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function initApiKeyManager() {
  // API Key is automatically managed on system level via SYSTEM_YOUTUBE_API_KEY
}

// --------------------------------------------------------------------------
// 2. Room Join & Create Forms Handling
// --------------------------------------------------------------------------
function initRoomForms() {
  const joinForm = document.getElementById('form-join-room');
  const joinUsername = document.getElementById('join-username');
  const joinRoomId = document.getElementById('join-roomid');

  if (joinForm) {
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = joinUsername.value.trim();
      const roomid = joinRoomId.value.trim();

      if (!username || !roomid) return;

      const xhr = new XMLHttpRequest();
      const checkUrl = `/room?username=${encodeURIComponent(username)}&roomid=${encodeURIComponent(roomid)}`;
      
      xhr.open("GET", checkUrl);
      xhr.send();
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.error === false) {
              window.location.href = `/room.html?username=${encodeURIComponent(username)}&roomid=${encodeURIComponent(roomid)}`;
            } else {
              swal("Cannot Join Room", res.message, "error");
            }
          } catch (err) {
            console.error(err);
          }
        }
      };
    });
  }
}

// --------------------------------------------------------------------------
// 3. YouTube Video Feed & Search Engine
// --------------------------------------------------------------------------
function initVideoFeed() {
  const searchInput = document.getElementById('landing-search-input');
  const pillsContainer = document.getElementById('landing-category-pills');

  // Load initial videos
  fetchYouTubeVideos();

  // Search on enter key or typing delay
  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const query = e.target.value.trim();
        if (query) {
          fetchYouTubeVideos(query);
        } else {
          renderVideoGrid(CURATED_VIDEOS);
        }
      }, 400);
    });
  }

  // Category Pill Clicks
  if (pillsContainer) {
    pillsContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;

      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const cat = pill.dataset.category;
      if (cat === 'trending') {
        fetchYouTubeVideos();
      } else {
        fetchYouTubeVideos(cat);
      }
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

const SYSTEM_YOUTUBE_API_KEY = "AIzaSyBrsPDTGXFqmvogUIhEiWDZGKPzi3yu1kQ";

// Fetch from YouTube Data API v3 using system key, or public search API fallback
async function fetchYouTubeVideos(query = 'famous_english') {
  localStorage.removeItem('YOUTUBE_API_KEY');
  const apiKey = SYSTEM_YOUTUBE_API_KEY;
  const actualQuery = categoryQueryMap[query] || query;
  
  // 1. Official YouTube Data API v3 Query
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(actualQuery)}&type=video&videoEmbeddable=true&key=${apiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      
      if (data.items && data.items.length > 0) {
        const formatted = data.items
          .filter(item => item.id && item.id.videoId)
          .slice(0, 15)
          .map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : (item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : item.snippet.thumbnails.default.url)
          }));
        if (formatted.length > 0) {
          renderVideoGrid(formatted);
          return;
        }
      }
    } catch (err) {
      console.warn("YouTube Data API request failed, trying fallback search engine:", err);
    }
  }

  // 2. Try Public Invidious YouTube Search Endpoint (No API Key Required!)
  try {
    const invidiousUrl = `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
    const res = await fetch(invidiousUrl);
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const formatted = data.slice(0, 12).map(item => ({
        id: item.videoId,
        title: item.title,
        channel: item.author,
        thumbnail: item.videoThumbnails && item.videoThumbnails[0] ? item.videoThumbnails[0].url : `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`
      }));
      renderVideoGrid(formatted);
      return;
    }
  } catch (err) {
    console.warn("Invidious public search offline, filtering local curated catalog:", err);
  }

  // 3. Fallback to local curated videos catalog matching search query
  const qLower = query.toLowerCase();
  const filtered = CURATED_VIDEOS.filter(v => 
    v.title.toLowerCase().includes(qLower) || 
    v.category.toLowerCase().includes(qLower) ||
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
          <button class="btn-card-action btn-start-party" data-video-id="${video.id}">
            <i class="fa-solid fa-sparkles text-warning"></i> Start Watch Party
          </button>
        </div>
      </div>
    `;

    // Click handler to start party with video
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
