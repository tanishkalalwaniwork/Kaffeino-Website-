// Cinematic Brand Website Controller for Kaffeino L'Essence
// Handles slow autoplay splash, scroll scrubbing experience, header blurs, and parallax reveals.

(function () {
  'use strict';

  console.log("KAFFEINO: Storytelling script executing...");

  // --- CONFIGURATION ---
  const TOTAL_FRAMES = 192;
  const PRELOAD_THRESHOLD = 20; // Core frames for fast start
  const IMAGE_SUBDIR = '_MConverter.eu_Iced_coffee_erupts_into_splash_202606261831';
  
  // --- SUPABASE CONFIGURATION ---
  const SUPABASE_URL = 'https://lchyyvjzhsgkqjmnmpdj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaHl5dmp6aHNna3FqbW5tcGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MDYyMzAsImV4cCI6MjA5ODM4MjIzMH0.qSOryVN5u0cyrDtVlT8fCSB2pGjaBFEITZDskQQGwnE';
  
  let supabaseClient = null;
  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn("Supabase SDK is not loaded. Form submissions will only run locally.");
  }
  
  const getFramePath = (index) => {
    const pad = String(index).padStart(5, '0');
    return `${IMAGE_SUBDIR}/${pad}.png`;
  };

  // --- STATE ---
  const images = [];
  let loadedCount = 0;
  let isCoreLoaded = false;
  let currentFrameIndex = 1;
  
  let introPlaying = true;
  let elapsedIntroTime = 0;
  let lastTime = 0;
  const AUTOPLAY_DURATION = 3500; // Autoplay splash frames 1-80 over 3.5 seconds

  // Mouse & tiny cursor tracking
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let cursorDotX = mouseX;
  let cursorDotY = mouseY;

  // DOM Elements
  const canvas = document.getElementById('coffee-canvas');
  const ctx = canvas.getContext('2d');
  const preloader = document.getElementById('preloader');
  const preloaderBar = document.getElementById('preloader-bar');
  const preloaderNum = document.getElementById('preloader-number');
  const cursorDot = document.getElementById('cursor-dot');
  const ambientGlow = document.getElementById('ambient-glow');
  
  // Scrollers & Navbars
  const brandNav = document.getElementById('brand-nav');
  const progressIndicator = document.getElementById('progress-indicator');
  const mainContent = document.getElementById('main-content');

  // Modals & Quiz Elements
  const guideModal = document.getElementById('guide-modal');
  const guideClose = document.getElementById('guide-close');
  const guideQuizContainer = document.getElementById('guide-quiz-container');
  const guideResultContainer = document.getElementById('guide-result-container');
  const resultTitle = document.getElementById('result-title');
  const resultSpecs = document.getElementById('result-specs');
  const resultText = document.getElementById('result-text');
  const resultTags = document.getElementById('result-tags');
  const resultReserveBtn = document.getElementById('result-reserve-btn');
  const resultRetryBtn = document.getElementById('result-retry-btn');

  // Reservation Modal Elements
  const reserveModal = document.getElementById('reserve-modal');
  const reserveClose = document.getElementById('reserve-close');
  const reserveForm = document.getElementById('reserve-form');
  const productSelect = document.getElementById('product-select');

  // --- INITIALIZATION ---
  function init() {
    console.log("KAFFEINO: init() started...");
    
    // Disable automatic scroll restoration and force scroll to top on load
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    setupCanvas();
    startProgressiveLoading();
    setupEventListeners();
    setupIntersectionObservers();
    initParticles();
    bindDynamicElementsHover();
    
    requestAnimationFrame(renderLoop);
    console.log("KAFFEINO: init() completed.");
  }

  // --- PROGRESSIVE BATCH ASSETS STREAMER ---
  function startProgressiveLoading() {
    for (let i = 0; i <= TOTAL_FRAMES; i++) {
      images[i] = null;
    }

    // Preload critical core frames first to start the autoplay sequence
    preloadBatch(1, PRELOAD_THRESHOLD, () => {
      console.log("KAFFEINO: Core frames loaded. Hiding preloader...");
      isCoreLoaded = true;
      hidePreloader();
      
      // Load remaining frames in background thread
      preloadBatch(PRELOAD_THRESHOLD + 1, TOTAL_FRAMES, null);
    });
  }

  function preloadBatch(start, end, callback) {
    let batchLoadedCount = 0;
    const batchSize = end - start + 1;

    for (let i = start; i <= end; i++) {
      const img = new Image();
      
      img.onload = () => {
        images[i] = img;
        loadedCount++;
        batchLoadedCount++;
        
        if (!isCoreLoaded) {
          const progress = Math.min(100, Math.floor((loadedCount / PRELOAD_THRESHOLD) * 100));
          if (preloaderBar) preloaderBar.style.width = `${progress}%`;
          if (preloaderNum) preloaderNum.textContent = `${progress}%`;
        }

        if (batchLoadedCount === batchSize && callback) {
          callback();
        }
      };
      
      img.onerror = () => {
        console.error(`KAFFEINO: Frame ${i} failed. Binding fallback.`);
        images[i] = images[1]; // Fallback to avoid blank spots
        loadedCount++;
        batchLoadedCount++;
        if (batchLoadedCount === batchSize && callback) {
          callback();
        }
      };

      img.src = getFramePath(i);
    }
  }

  function interruptIntro(e) {
    if (introPlaying) {
      console.log("KAFFEINO: Intro interrupted by user interaction.");
      introPlaying = false;
      revealDashboard();
    }
  }

  function addIntroInterrupters() {
    window.addEventListener('wheel', interruptIntro, { passive: true });
    window.addEventListener('touchmove', interruptIntro, { passive: true });
    window.addEventListener('keydown', interruptIntro, { passive: true });
  }

  function removeIntroInterrupters() {
    window.removeEventListener('wheel', interruptIntro);
    window.removeEventListener('touchmove', interruptIntro);
    window.removeEventListener('keydown', interruptIntro);
  }

  function hidePreloader() {
    if (preloader) preloader.classList.add('fade-out');
    // Lock scroll offset during splash sequence
    document.body.style.overflow = 'hidden';
    
    resizeCanvas();
    updateAmbientGlow(0);
    lastTime = performance.now();
    addIntroInterrupters();
  }

  function revealDashboard() {
    console.log("KAFFEINO: revealDashboard() executed. Unlocking scroll...");
    document.body.style.overflow = '';
    
    if (brandNav) brandNav.classList.add('visible');
    if (progressIndicator) progressIndicator.classList.add('visible');
    removeIntroInterrupters();
  }

  // --- CANVAS CONTROL & RESIZING ---
  function setupCanvas() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    
    ctx.scale(dpr, dpr);
    drawFrame(currentFrameIndex);
  }

  function getNearestLoadedImage(frameIndex) {
    if (images[frameIndex] && images[frameIndex].complete) {
      return images[frameIndex];
    }
    for (let i = frameIndex - 1; i >= 1; i--) {
      if (images[i] && images[i].complete) return images[i];
    }
    for (let i = frameIndex + 1; i <= TOTAL_FRAMES; i++) {
      if (images[i] && images[i].complete) return images[i];
    }
    return null;
  }

  function drawFrame(frameIndex) {
    if (!ctx) return;
    const img = getNearestLoadedImage(frameIndex);
    if (!img) return;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const imgWidth = 1280;
    const imgHeight = 720;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = window.innerWidth / window.innerHeight;

    let drawWidth, drawHeight, drawX, drawY;

    if (canvasRatio > imgRatio) {
      drawWidth = window.innerWidth;
      drawHeight = window.innerWidth / imgRatio;
      drawX = 0;
      drawY = (window.innerHeight - drawHeight) / 2;
    } else {
      drawWidth = window.innerHeight * imgRatio;
      drawHeight = window.innerHeight;
      drawX = (window.innerWidth - drawWidth) / 2;
      drawY = 0;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }

  // --- SCROLL INTERSECTION OBSERVERS ---
  function setupIntersectionObservers() {
    // Observer for clip-path and text reveal classes
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      root: null,
      threshold: 0.15
    });

    document.querySelectorAll('.reveal-text, .reveal-image, .reveal-scale').forEach(el => {
      revealObserver.observe(el);
    });

    // Synchronize scrolling tracker with sidebar indicator dots
    const activeDotObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const targetId = entry.target.id;
          
          document.querySelectorAll('.progress-dot').forEach(dot => {
            if (dot.getAttribute('data-target') === targetId) {
              dot.classList.add('active');
            } else {
              dot.classList.remove('active');
            }
          });

          // Highlight matching top navbar links
          document.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href').replace('#', '');
            if (href === targetId) {
              link.style.color = 'var(--accent-gold)';
            } else {
              link.style.color = '';
            }
          });
        }
      });
    }, {
      root: null,
      threshold: 0.3
    });

    document.querySelectorAll('.story-section').forEach(section => {
      activeDotObserver.observe(section);
    });
  }

  // --- BRAND SPECIFICATIONS DATABASE ---
  const aromaData = {
    black: {
      title: 'Black Alchemist',
      intensity: '11 / 12',
      acidity: 'Subtle',
      roast: 'Double Dark',
      altitude: '1,850m',
      desc: 'An intense, full-bodied extraction designed for coffee purists. Slowly roasted at precisely 218°C, the Black Alchemist delivers a deep smoky cacao body with complex notes of black cherry and roasted oakwood.',
      tags: ['Dark Cocoa', 'Oakwood Smoke', 'Black Cherry']
    },
    amber: {
      title: 'Amber Nectar',
      intensity: '08 / 12',
      acidity: 'Vibrant',
      roast: 'Medium Gold',
      altitude: '1,620m',
      desc: 'A warm, inviting gold roast blend created to capture smooth, complex highlights. Infused with sweet notes of natural vanilla bean, honeyed molasses, and soft caramel undertones for a balanced, vibrant finish.',
      tags: ['Caramel Fudge', 'Vanilla Bean', 'Wild Honey']
    },
    velvet: {
      title: 'Velvet Eclipse',
      intensity: '06 / 12',
      acidity: 'Balanced',
      roast: 'Slow Cold-Brew',
      altitude: '1,700m',
      desc: 'A super-smooth, cold-drip infusion layered with thick, velvety sweet cream. Representing structural brew precision, it releases subtle floral jasmine elements and clean, refreshing espresso profiles.',
      tags: ['Sweet Cream', 'Floral Jasmine', 'Velvet Crema']
    }
  };

  // --- EVENT LISTENERS & INTERACTION FLOWS ---
  function setupEventListeners() {
    // Window scroll coordinates, navbar shrinks, bean parallaxes, and canvas scrubbing
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;

      // 1. Navbar shrink & background blur on scroll
      if (brandNav) {
        if (scrollY > 50) {
          brandNav.classList.add('scrolled');
        } else {
          brandNav.classList.remove('scrolled');
        }
      }

      // 2. Ambient glow shift
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0) {
        const scrollPercent = scrollY / maxScroll;
        updateAmbientGlow(scrollPercent);
      }

      // 3. Scroll Pinned Scrubbing (frames 80 to 192)
      const pinnedSection = document.getElementById('pinned-experience');
      if (pinnedSection && !introPlaying) {
        const rect = pinnedSection.getBoundingClientRect();
        const sectionHeight = rect.height;
        const viewportHeight = window.innerHeight;
        const scrollRange = sectionHeight - viewportHeight;
        
        if (scrollRange > 0) {
          let progress = -rect.top / scrollRange;
          progress = Math.max(0, Math.min(1, progress));
          
          // Map progress directly to frame 80-192
          currentFrameIndex = Math.floor(80 + progress * (192 - 80));
          drawFrame(currentFrameIndex);

          // Pinned text fade & scale calculations
          const pinnedMessage = document.getElementById('pinned-message');
          if (pinnedMessage) {
            if (progress > 0.3) {
              const textProgress = Math.min(1, (progress - 0.3) / 0.4); // scale up over 40% duration
              pinnedMessage.style.opacity = textProgress;
              pinnedMessage.style.transform = `scale(${0.95 + textProgress * 0.05})`;
            } else {
              pinnedMessage.style.opacity = 0;
              pinnedMessage.style.transform = `scale(0.95)`;
            }
          }
        }
      }

      // 4. Parallax Coffee Bean Drift
      const parallaxBean = document.getElementById('parallax-bean');
      const ingredientsSection = document.getElementById('cinematic-ingredients');
      if (parallaxBean && ingredientsSection) {
        const rect = ingredientsSection.getBoundingClientRect();
        const scrollPercent = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        if (scrollPercent >= 0 && scrollPercent <= 1) {
          const yOffset = (scrollPercent - 0.5) * 80; // +/- 40px drift
          parallaxBean.style.transform = `translate3d(0, ${yOffset}px, 0) rotate(${yOffset * 0.1}deg)`;
        }
      }
    }, { passive: true });

    // Tactile Click Ripples
    window.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION' || e.target.closest('.modal-container')) {
        return;
      }
      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      
      setTimeout(() => { ripple.remove(); }, 750);
    });

    // Anchor smooth scrolling
    document.querySelectorAll('a[href^="#"], .progress-dot').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        let targetSelector = this.getAttribute('href') || `#${this.getAttribute('data-target')}`;
        const targetEl = document.querySelector(targetSelector);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Magnetic Button Triggers
    document.querySelectorAll('.premium-btn').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const pullX = (e.clientX - centerX) * 0.35;
        const pullY = (e.clientY - centerY) * 0.35;
        
        btn.style.transform = `translate3d(${pullX}px, ${pullY}px, 0)`;
        cursorDotX = centerX + pullX * 0.4;
        cursorDotY = centerY + pullY * 0.4;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });

    // Cursor position tracker
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Modal triggers & binds
    // 1. Coffee Guide Selector Modal
    if (guideClose) {
      guideClose.addEventListener('click', () => {
        guideModal.classList.remove('open');
        document.body.classList.remove('hovering-link');
      });
    }

    const openGuideModal = () => {
      if (guideQuizContainer) guideQuizContainer.style.display = 'block';
      if (guideResultContainer) guideResultContainer.style.display = 'none';
      if (guideModal) guideModal.classList.add('open');
      document.body.classList.add('hovering-link');
    };

    const navGuideTrigger = document.getElementById('nav-guide-trigger');
    if (navGuideTrigger) navGuideTrigger.addEventListener('click', (e) => { e.preventDefault(); openGuideModal(); });
    
    const originGuideTrigger = document.getElementById('origin-guide-trigger');
    if (originGuideTrigger) originGuideTrigger.addEventListener('click', (e) => { e.preventDefault(); openGuideModal(); });

    const quizStartTrigger = document.getElementById('quiz-start-trigger');
    if (quizStartTrigger) quizStartTrigger.addEventListener('click', (e) => { e.preventDefault(); openGuideModal(); });

    // Handle Sensory Selector Quiz Choices
    document.querySelectorAll('.quiz-opt-btn').forEach(optBtn => {
      optBtn.addEventListener('click', () => {
        const outcome = optBtn.getAttribute('data-outcome');
        const data = aromaData[outcome];
        if (data) {
          resultTitle.textContent = data.title;
          resultText.textContent = data.desc;
          
          resultSpecs.innerHTML = `
            <div class="spec-row"><span>Intensity</span><span class="spec-val">${data.intensity}</span></div>
            <div class="spec-row"><span>Acidity</span><span class="spec-val">${data.acidity}</span></div>
            <div class="spec-row"><span>Roast Profile</span><span class="spec-val">${data.roast}</span></div>
            <div class="spec-row"><span>Altitude</span><span class="spec-val">${data.altitude}</span></div>
          `;

          resultTags.innerHTML = '';
          data.tags.forEach(tag => {
            const span = document.createElement('span');
            span.textContent = tag;
            resultTags.appendChild(span);
          });

          if (productSelect) productSelect.value = outcome;

          guideQuizContainer.style.display = 'none';
          guideResultContainer.style.display = 'block';
        }
      });
    });

    if (resultRetryBtn) {
      resultRetryBtn.addEventListener('click', () => {
        guideResultContainer.style.display = 'none';
        guideQuizContainer.style.display = 'block';
      });
    }

    if (resultReserveBtn) {
      resultReserveBtn.addEventListener('click', () => {
        guideModal.classList.remove('open');
        setTimeout(openReserveModal, 300);
      });
    }

    // 2. Reservation Registry Form Modal
    const openReserveModal = () => {
      if (reserveModal) reserveModal.classList.add('open');
      document.body.classList.add('hovering-link');
    };

    const navShopTrigger = document.getElementById('nav-shop-trigger');
    if (navShopTrigger) navShopTrigger.addEventListener('click', (e) => { e.preventDefault(); openReserveModal(); });
    
    const showcaseCta = document.getElementById('showcase-cta');
    if (showcaseCta) showcaseCta.addEventListener('click', (e) => { e.preventDefault(); openReserveModal(); });

    if (reserveClose) {
      reserveClose.addEventListener('click', () => {
        reserveModal.classList.remove('open');
        document.body.classList.remove('hovering-link');
        setTimeout(() => {
          document.getElementById('reserve-form-container').style.display = 'block';
          document.getElementById('reserve-success-container').style.display = 'none';
          if (reserveForm) reserveForm.reset();
        }, 450);
      });
    }

    if (reserveForm) {
      reserveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = reserveForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Request Allocation';
        
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-circle" style="display:inline-block; width:14px; height:14px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align: middle;"></span>Processing...';
        }

        const clientName = document.getElementById('client-name').value;
        const clientEmail = document.getElementById('client-email').value;
        const selectedDecanter = productSelect.value;

        let success = true;
        if (supabaseClient) {
          try {
            const { data, error } = await supabaseClient
              .from('reservations')
              .insert([
                { name: clientName, email: clientEmail, decanter: selectedDecanter }
              ]);
            if (error) {
              console.error('Supabase error:', error);
              alert('Could not submit request: ' + error.message);
              success = false;
            }
          } catch (err) {
            console.error('Connection error:', err);
            alert('Failed to connect to backend server. Please try again.');
            success = false;
          }
        } else {
          console.warn('Supabase client not initialized. Proceeding locally.');
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }

        if (success) {
          document.getElementById('reserve-form-container').style.display = 'none';
          const successContainer = document.getElementById('reserve-success-container');
          successContainer.style.display = 'block';
          successContainer.style.opacity = 0;
          setTimeout(() => {
            successContainer.style.transition = 'opacity 0.6s ease';
            successContainer.style.opacity = 1;
          }, 50);
        }
      });
    }

    // Hero explore button smooth scroll
    const heroExploreBtn = document.getElementById('hero-explore-btn');
    if (heroExploreBtn) {
      heroExploreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById('pinned-experience');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  function updateAmbientGlow(progress) {
    if (!ambientGlow) return;
    if (progress < 0.25) {
      ambientGlow.style.opacity = 0.15;
    } else if (progress >= 0.25 && progress < 0.65) {
      ambientGlow.style.opacity = 0.22;
    } else {
      ambientGlow.style.opacity = 0.12;
    }
  }

  // --- VOLUMETRIC FLOATING PARTICLES SIMULATION ---
  const particles = [];
  const particleCanvas = document.getElementById('particle-canvas');
  let pCtx = null;
  const PARTICLE_COUNT = 24; // Decreased particle count to ensure high performance

  function initParticles() {
    if (!particleCanvas) return;
    pCtx = particleCanvas.getContext('2d');
    resizeParticleCanvas();
    window.addEventListener('resize', resizeParticleCanvas);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 1.2 + 0.4,
        speedX: (Math.random() - 0.5) * 0.1,
        speedY: -Math.random() * 0.15 - 0.04,
        alpha: Math.random() * 0.15 + 0.05,
        parallax: Math.random() * 0.02 + 0.005
      });
    }
  }

  function resizeParticleCanvas() {
    if (!particleCanvas) return;
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }

  function drawParticles() {
    if (!pCtx) return;
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    const mouseOffsetX = cursorDotX - window.innerWidth / 2;
    const mouseOffsetY = cursorDotY - window.innerHeight / 2;

    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.x < 0) p.x = window.innerWidth;
      if (p.x > window.innerWidth) p.x = 0;
      if (p.y < 0) p.y = window.innerHeight;
      if (p.y > window.innerHeight) p.y = 0;

      const drawX = p.x + mouseOffsetX * p.parallax;
      const drawY = p.y + mouseOffsetY * p.parallax;

      pCtx.beginPath();
      pCtx.arc(drawX, drawY, p.size, 0, Math.PI * 2);
      pCtx.fillStyle = `rgba(197, 160, 89, ${p.alpha})`;
      pCtx.shadowBlur = p.size * 2;
      pCtx.shadowColor = 'rgba(197, 160, 89, 0.4)';
      pCtx.fill();
      pCtx.shadowBlur = 0;
    });
  }

  // --- ANIMATION RENDER LOOP ---
  function renderLoop() {
    if (isCoreLoaded) {
      if (introPlaying) {
        const now = performance.now();
        if (!lastTime) lastTime = now;
        const delta = now - lastTime;
        lastTime = now;

        elapsedIntroTime += delta;
        const t = Math.min(1, elapsedIntroTime / AUTOPLAY_DURATION);
        
        // Cubic ease-out calculation: plays frames 1 to 80 over 3.5 seconds
        const easedT = 1 - Math.pow(1 - t, 3);
        currentFrameIndex = Math.min(80, Math.max(1, Math.floor(easedT * 79) + 1));

        if (t >= 1) {
          introPlaying = false;
          revealDashboard();
        }
        drawFrame(currentFrameIndex);
      }
    }

    // Tiny dot cursor physics
    cursorDotX += (mouseX - cursorDotX) * 0.22;
    cursorDotY += (mouseY - cursorDotY) * 0.22;

    if (cursorDot) {
      cursorDot.style.transform = `translate3d(${cursorDotX}px, ${cursorDotY}px, 0) translate(-50%, -50%)`;
    }

    drawParticles();
    requestAnimationFrame(renderLoop);
  }

  // --- DYNAMIC LINKS HOVER DECORATOR ---
  function bindDynamicElementsHover() {
    document.querySelectorAll('a, button, input, select, textarea, .progress-dot, .quiz-opt-btn').forEach(el => {
      el.addEventListener('mouseenter', () => {
        document.body.classList.add('hovering-link');
      });
      el.addEventListener('mouseleave', () => {
        document.body.classList.remove('hovering-link');
      });
    });
  }

  // Launch application
  init();

})();
