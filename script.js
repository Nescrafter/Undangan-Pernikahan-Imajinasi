// ============================================================================
// KONFIGURASI UTAMA MUSIK & UNDANGAN
// ============================================================================
const YOUTUBE_VIDEO_ID = '9CHAP_Sdc9A'; // Banda Neira - Sampai Jadi Debu - Peaceful Piano
const TARGET_VOLUME = 65;               // Target volume YouTube (0 - 100)
const FALLBACK_LOCAL_AUDIO = 'assets/music.mp3'; // Opsional jika punya file lokal di folder assets/

let ytPlayer = null;
let isPlayerReady = false;
let isPlaying = false;
let fadeInterval = null;
let fallbackAudio = null;
let usingFallback = false;

// ============================================================================
// 1. INISIALISASI YOUTUBE IFRAME PLAYER API
// ============================================================================
function createYouTubePlayer() {
  if (ytPlayer) return;
  if (!window.YT || typeof window.YT.Player !== 'function') return;

  const container = document.getElementById('youtube-player');
  if (!container) return;

  const currentOrigin =
    window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'http://127.0.0.1:5500';

  ytPlayer = new window.YT.Player('youtube-player', {
    height: '90',
    width: '160',
    videoId: YOUTUBE_VIDEO_ID,
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      loop: 1,
      playlist: YOUTUBE_VIDEO_ID, // Wajib untuk loop satu video
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      origin: currentOrigin
    },
    events: {
      onReady: (event) => {
        isPlayerReady = true;
        try {
          event.target.setVolume(0);
        } catch (err) {
          console.warn('Gagal mengatur volume awal YouTube:', err);
        }
      },
      onStateChange: (event) => {
        const PlayerState = window.YT.PlayerState;
        if (event.data === PlayerState.PLAYING) {
          isPlaying = true;
          updateMusicIcon(true);
        } else if (event.data === PlayerState.PAUSED) {
          isPlaying = false;
          updateMusicIcon(false);
        } else if (event.data === PlayerState.ENDED) {
          // Pastikan kembali ke awal dan terus berputar
          try {
            event.target.seekTo(0);
            event.target.playVideo();
          } catch (err) {
            isPlaying = false;
            updateMusicIcon(false);
          }
        }
      },
      onError: (event) => {
        console.warn('YouTube Player Error Code:', event.data);
        // Jika YouTube gagal dimuat/diputar (misal diblokir atau embed dibatasi), aktifkan fallback jika ada
        activateFallbackIfAvailable();
      }
    }
  });
}

// Dipanggil otomatis oleh skrip https://www.youtube.com/iframe_api
window.onYouTubeIframeAPIReady = function () {
  createYouTubePlayer();
};

// ============================================================================
// 2. FUNGSI KONTROL MUSIK & FADE-IN
// ============================================================================
function updateMusicIcon(playing) {
  const musicIcon = document.getElementById('music-icon');
  if (musicIcon) {
    musicIcon.textContent = playing ? '❚❚' : '▶';
  }
}

function clearFadeTimer() {
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
}

function activateFallbackIfAvailable() {
  if (usingFallback) return true;

  fallbackAudio = new Audio(FALLBACK_LOCAL_AUDIO);
  fallbackAudio.loop = true;
  fallbackAudio.volume = 0;

  fallbackAudio.addEventListener('error', () => {
    console.warn(
      'Audio cadangan lokal tidak ditemukan (' + FALLBACK_LOCAL_AUDIO + '). ' +
      'Jika YouTube diblokir browser/ad-blocker, nonaktifkan pemblokir pada situs ini atau letakkan file MP3 di assets/music.mp3.'
    );
  });

  usingFallback = true;
  return true;
}

function playFallbackWithFade(targetVolDecimal = 0.65) {
  if (!fallbackAudio) activateFallbackIfAvailable();
  if (!fallbackAudio) return;

  clearFadeTimer();
  let vol = 0;
  fallbackAudio.volume = 0;

  const playPromise = fallbackAudio.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        isPlaying = true;
        updateMusicIcon(true);
        fadeInterval = setInterval(() => {
          if (vol < targetVolDecimal) {
            vol = Math.min(targetVolDecimal, +(vol + 0.05).toFixed(2));
            fallbackAudio.volume = vol;
          } else {
            clearFadeTimer();
          }
        }, 150);
      })
      .catch((err) => {
        console.warn('Gagal memutar fallback audio:', err);
        isPlaying = false;
        updateMusicIcon(false);
      });
  }
}

function playYouTubeWithFade(targetVol = TARGET_VOLUME) {
  if (!isPlayerReady || !ytPlayer || typeof ytPlayer.playVideo !== 'function') {
    return false;
  }

  clearFadeTimer();

  try {
    if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
    if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(0);
    ytPlayer.playVideo();
  } catch (err) {
    console.warn('Error saat memanggil playVideo() YouTube:', err);
    return false;
  }

  // Optimistic UI update saat klik pengguna
  isPlaying = true;
  updateMusicIcon(true);

  let currentVolume = 0;
  fadeInterval = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.setVolume !== 'function') {
      clearFadeTimer();
      return;
    }

    if (currentVolume < targetVol) {
      currentVolume = Math.min(targetVol, currentVolume + 5);
      try {
        ytPlayer.setVolume(currentVolume);
      } catch (err) {
        clearFadeTimer();
      }
    } else {
      clearFadeTimer();
    }
  }, 150);

  // Verifikasi setelah 1.8 detik apakah YouTube benar-benar mulai berputar
  setTimeout(() => {
    if (
      ytPlayer &&
      typeof ytPlayer.getPlayerState === 'function' &&
      window.YT &&
      window.YT.PlayerState
    ) {
      const state = ytPlayer.getPlayerState();
      // -1 = unstarted, 0 = ended, 2 = paused, 5 = video cued
      if (state === -1 || state === 5) {
        console.warn(
          'YouTube belum memulai pemutaran (state: ' + state + '). ' +
          'Cek apakah ad-blocker/shields memblokir YouTube atau klik tombol musik ▶ secara manual.'
        );
      }
    }
  }, 1800);

  return true;
}

function startMusicExperience() {
  // Coba buat player jika YT API sudah ada tapi belum sempat dibuat
  if (!ytPlayer && window.YT && typeof window.YT.Player === 'function') {
    createYouTubePlayer();
  }

  if (usingFallback) {
    playFallbackWithFade(TARGET_VOLUME / 100);
    return;
  }

  let attempts = 0;
  const maxAttempts = 12; // Total tunggu maksimal ~4.8 detik

  const tryStart = () => {
    attempts += 1;

    if (!ytPlayer && window.YT && typeof window.YT.Player === 'function') {
      createYouTubePlayer();
    }

    const started = playYouTubeWithFade(TARGET_VOLUME);
    if (started) return;

    if (attempts < maxAttempts) {
      setTimeout(tryStart, 400);
    } else {
      console.warn('YouTube IFrame API belum siap setelah beberapa percobaan.');
      updateMusicIcon(false);
    }
  };

  tryStart();
}

function toggleMusicPlayback() {
  if (usingFallback && fallbackAudio) {
    if (isPlaying) {
      clearFadeTimer();
      fallbackAudio.pause();
      isPlaying = false;
      updateMusicIcon(false);
    } else {
      playFallbackWithFade(TARGET_VOLUME / 100);
    }
    return;
  }

  if (!ytPlayer) {
    startMusicExperience();
    return;
  }

  if (isPlaying) {
    clearFadeTimer();
    try {
      if (typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
    } catch (err) {
      console.warn('Gagal pause video YouTube:', err);
    }
    isPlaying = false;
    updateMusicIcon(false);
  } else {
    if (isPlayerReady) {
      playYouTubeWithFade(TARGET_VOLUME);
    } else {
      startMusicExperience();
    }
  }
}

// ============================================================================
// 3. INISIALISASI HALAMAN (COVER, COUNTDOWN, RSVP, ANIMASI SCROLL)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Jika YouTube IFrame API sudah lebih dulu selesai dimuat sebelum DOMContentLoaded
  if (window.YT && typeof window.YT.Player === 'function' && !ytPlayer) {
    createYouTubePlayer();
  }

  // --- A. Cover & Tombol Musik ---
  const cover = document.getElementById('cover');
  const openBtn = document.getElementById('open-invitation');
  const musicToggle = document.getElementById('music-toggle');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (cover) cover.classList.add('opened');
      if (musicToggle) musicToggle.classList.remove('hidden');
      startMusicExperience();
    });
  }

  if (musicToggle) {
    musicToggle.addEventListener('click', () => {
      toggleMusicPlayback();
    });
  }

  // --- B. Countdown Timer (Target: May 21, 2035 09:00:00 WIB / 8.5 tahun dari 21 Nov 2026) ---
  const targetDate = new Date('2035-05-21T09:00:00+07:00').getTime();
  const countdownEl = document.getElementById('countdown');
  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');

  const updateCountdown = () => {
    if (!countdownEl || !daysEl || !hoursEl || !minutesEl || !secondsEl) return;

    const now = Date.now();
    const distance = targetDate - now;

    if (distance <= 0) {
      countdownEl.innerHTML =
        '<p style="grid-column: 1 / -1; color: var(--gold-antique); font-family: Cormorant Garamond, serif; font-size: 1.5rem;">The day has finally arrived.</p>';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');
  };

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // --- C. Form RSVP & Penyimpanan Ucapan (localStorage) ---
  const rsvpForm = document.getElementById('rsvp-form');
  const wishesList = document.getElementById('wishes-list');

  const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  const getSavedWishes = () => {
    try {
      const raw = localStorage.getItem('wedding_wishes');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Gagal membaca data wishes dari localStorage:', err);
      return [];
    }
  };

  const renderWishes = () => {
    if (!wishesList) return;
    const saved = getSavedWishes();
    wishesList.innerHTML = '';

    saved.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'wish-item';

      const statusText =
        item.status === 'attending'
          ? `Attending (${escapeHTML(String(item.guests || 1))})`
          : 'Unable to Attend';

      card.innerHTML = `
        <div class="wish-header">
          <strong>${escapeHTML(item.name || 'Anonymous')}</strong>
          <span>${statusText}</span>
        </div>
        <p class="wish-text">"${escapeHTML(item.message || 'Sending quiet regards into the unknown.')}"</p>
      `;
      wishesList.appendChild(card);
    });
  };

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('guest-name');
      const attendanceInput = document.getElementById('attendance');
      const guestsInput = document.getElementById('guests-count');
      const wishesInput = document.getElementById('wishes');

      const name = nameInput ? nameInput.value.trim() : '';
      const status = attendanceInput ? attendanceInput.value : '';
      const guests = guestsInput ? guestsInput.value : '1';
      const message = wishesInput ? wishesInput.value.trim() : '';

      if (!name || !status) {
        alert('Please fill in your name and attendance confirmation.');
        return;
      }

      const saved = getSavedWishes();
      saved.unshift({ name, status, guests, message });

      try {
        localStorage.setItem('wedding_wishes', JSON.stringify(saved));
      } catch (err) {
        console.warn('Gagal menyimpan ke localStorage:', err);
      }

      rsvpForm.reset();
      renderWishes();
      alert('Thank you. Your response has been recorded.');
    });
  }

  renderWishes();

  // --- D. Animasi Fade-In Saat Scroll ---
  const fadeEls = document.querySelectorAll('.fade-in');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    fadeEls.forEach((el) => observer.observe(el));
  } else {
    fadeEls.forEach((el) => el.classList.add('visible'));
  }
});