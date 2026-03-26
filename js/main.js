(function () {
  "use strict";

  /**
   * Корень сайта: папка, где лежит index.html (рядом с /js/main.js).
   * Так относительные пути assets/... работают и при открытии из подпапки на сервере,
   * и при file://, если html и js лежат в ожидаемой структуре.
   */
  var _siteRootHrefCache = null;
  function getSiteRootHref() {
    if (_siteRootHrefCache) return _siteRootHrefCache;
    var el = document.querySelector('script[src*="main.js"]');
    if (!el) {
      _siteRootHrefCache = new URL("./", window.location.href).href;
      return _siteRootHrefCache;
    }
    var raw = el.getAttribute("src");
    if (!raw) {
      _siteRootHrefCache = new URL("./", window.location.href).href;
      return _siteRootHrefCache;
    }
    try {
      var abs = new URL(raw, window.location.href);
      _siteRootHrefCache = abs.href.replace(/\/js\/main\.js(\?.*)?$/i, "/");
      return _siteRootHrefCache;
    } catch (e) {
      _siteRootHrefCache = new URL("./", window.location.href).href;
      return _siteRootHrefCache;
    }
  }

  function resolveAssetRef(ref) {
    if (!ref || /^(https?:|data:|\/\/)/i.test(ref)) return ref;
    var trimmed = ref.replace(/^\.\//, "");
    try {
      return new URL(trimmed, getSiteRootHref()).href;
    } catch (e2) {
      return ref;
    }
  }

  var header = document.querySelector(".header");
  var navToggle = document.getElementById("navToggle");
  var mainNav = document.getElementById("mainNav");
  var yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /**
   * Медиа секции: фон data-bg, фото hero, img[data-lazy-src] — только при попадании в зону просмотра.
   */
  function loadSectionLazyMedia(section) {
    if (!section || section._lazyMediaLoaded) return;
    section._lazyMediaLoaded = true;

    if (section.id === "hero") {
      var heroU = resolveAssetRef("assets/hero.jpg");
      document.documentElement.style.setProperty(
        "--hero-photo-url",
        'url("' + heroU.replace(/"/g, "%22") + '")'
      );
    }

    var bgPath = section.getAttribute("data-bg");
    if (bgPath) {
      var fullBg = resolveAssetRef(bgPath);
      var valBg = 'url("' + fullBg.replace(/"/g, "%22") + '")';
      var bgEl = section.querySelector(".section__bg");
      if (bgEl && !bgEl.classList.contains("section__bg--hero")) {
        bgEl.style.setProperty("--section-bg-image", valBg);
      }
    }

    section.querySelectorAll("img[data-lazy-src]").forEach(function (img) {
      var p = img.getAttribute("data-lazy-src");
      if (!p) return;
      img.src = resolveAssetRef(p.replace(/^\.\//, ""));
      img.removeAttribute("data-lazy-src");
    });
  }

  var mainSectionsForLazy = document.querySelectorAll("main .section");
  if ("IntersectionObserver" in window) {
    var lazyMediaObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadSectionLazyMedia(entry.target);
          lazyMediaObs.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px 10% 0px", threshold: 0.02 }
    );
    mainSectionsForLazy.forEach(function (sec) {
      lazyMediaObs.observe(sec);
    });
    var footLazy = document.querySelector("footer.site-footer");
    if (footLazy) lazyMediaObs.observe(footLazy);
  } else {
    mainSectionsForLazy.forEach(loadSectionLazyMedia);
    var footFb = document.querySelector("footer.site-footer");
    if (footFb) loadSectionLazyMedia(footFb);
  }

  /* Абсолютные URL: только img без отложенной загрузки (логотип и т.п.) */
  document.querySelectorAll("img[src]").forEach(function (img) {
    if (img.hasAttribute("data-lazy-src")) return;
    var attr = img.getAttribute("src");
    if (!attr || /^data:/i.test(attr)) return;
    if (/^(https?:|\/\/)/i.test(attr)) return;
    if (attr.charAt(0) === "/") return;
    var rel = attr.replace(/^\.\//, "");
    if (rel.indexOf("assets/") !== 0) return;
    img.src = resolveAssetRef(rel);
  });

  /* Cross-section background emphasis on scroll */
  var sections = document.querySelectorAll(".section");
  if (sections.length && "IntersectionObserver" in window) {
    var bgObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-bg-visible");
          } else {
            entry.target.classList.remove("is-bg-visible");
          }
        });
      },
      { root: null, rootMargin: "-12% 0px -12% 0px", threshold: 0.15 }
    );
    sections.forEach(function (s) {
      bgObserver.observe(s);
    });
  }

  /* Fade-in on reveal */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length && "IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i * 0.06, 0.35) + "s";
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* Один passive scroll: шапка + «наверх» (меньше слушателей на scroll) */
  var backToTop = document.getElementById("backToTop");
  function onScrollUi() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
    if (backToTop) {
      var show = window.scrollY > 400;
      backToTop.classList.toggle("is-visible", show);
      if (show) loadSectionLazyMedia(backToTop);
    }
  }
  window.addEventListener("scroll", onScrollUi, { passive: true });
  onScrollUi();

  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* Mobile nav */
  function closeNav() {
    if (!navToggle || !mainNav) return;
    navToggle.setAttribute("aria-expanded", "false");
    mainNav.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function openNav() {
    if (!navToggle || !mainNav) return;
    navToggle.setAttribute("aria-expanded", "true");
    mainNav.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var open = navToggle.getAttribute("aria-expanded") === "true";
      if (open) closeNav();
      else openNav();
    });
    mainNav.querySelectorAll("a[data-scroll]").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
  }

  /* Smooth scroll */
  document.querySelectorAll("a[data-scroll]").forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var id = this.getAttribute("href");
      if (!id || id.charAt(0) !== "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0);
      window.scrollTo({ top: top, behavior: "smooth" });
    });
  });

  /* Slider */
  var track = document.getElementById("sliderTrack");
  var slides = track ? track.querySelectorAll(".slider__slide") : [];
  var prevBtn = document.getElementById("sliderPrev");
  var nextBtn = document.getElementById("sliderNext");
  var dotsWrap = document.getElementById("sliderDots");
  var currentSlide = 0;
  var slideCount = slides.length;

  function goToSlide(index) {
    if (!slideCount) return;
    currentSlide = (index + slideCount) % slideCount;
    slides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", i === currentSlide);
    });
    if (dotsWrap) {
      dotsWrap.querySelectorAll(".slider__dot").forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === currentSlide);
        dot.setAttribute("aria-selected", i === currentSlide ? "true" : "false");
      });
    }
  }

  if (dotsWrap && slideCount) {
    for (var d = 0; d < slideCount; d++) {
      (function (idx) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "slider__dot" + (idx === 0 ? " is-active" : "");
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-label", "Слайд " + (idx + 1));
        dot.setAttribute("aria-selected", idx === 0 ? "true" : "false");
        dot.addEventListener("click", function () {
          goToSlide(idx);
        });
        dotsWrap.appendChild(dot);
      })(d);
    }
  }

  if (prevBtn) prevBtn.addEventListener("click", function () { goToSlide(currentSlide - 1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { goToSlide(currentSlide + 1); });

  var touchStartX = 0;
  if (track) {
    track.addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );
    track.addEventListener(
      "touchend",
      function (e) {
        var dx = e.changedTouches[0].screenX - touchStartX;
        if (Math.abs(dx) > 50) goToSlide(currentSlide + (dx < 0 ? 1 : -1));
      },
      { passive: true }
    );
  }

  /* Gallery modal */
  var modal = document.getElementById("galleryModal");
  var modalImg = document.getElementById("modalImg");
  var modalImgFlip = document.getElementById("modalImgFlip");
  var modalTitle = document.getElementById("modalTitle");
  var galleryModalViewer = document.getElementById("galleryModalViewer");
  var galleryModalPrev = document.getElementById("galleryModalPrev");
  var galleryModalNext = document.getElementById("galleryModalNext");
  var galleryItems = document.querySelectorAll("[data-gallery-open]");

  var galleryModalIndex = 0;
  var galleryAnimating = false;
  var galleryTouchStartX = 0;

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function clearModalFlipClasses() {
    if (!modalImgFlip) return;
    modalImgFlip.classList.remove(
      "modal__img-flip--out-next",
      "modal__img-flip--in-next",
      "modal__img-flip--out-prev",
      "modal__img-flip--in-prev"
    );
  }

  function updateModalCaption(idx, total) {
    if (!modalTitle) return;
    modalTitle.textContent =
      "Фото " +
      (idx + 1) +
      " из " +
      total +
      ". Стрелки на клавиатуре, кнопки по бокам или свайп влево и вправо.";
  }

  function syncModalViewerSingleClass() {
    var n = getGallerySources().length;
    if (galleryModalViewer) {
      galleryModalViewer.classList.toggle("modal__viewer--single", n <= 1);
    }
  }

  function getGallerySources() {
    var out = [];
    galleryItems.forEach(function (btn) {
      var img = btn.querySelector("img");
      if (!img) return;
      var raw = img.getAttribute("data-lazy-src") || img.getAttribute("src");
      if (!raw || /^data:/i.test(raw)) return;
      if (/^(https?:|\/\/)/i.test(raw)) {
        out.push({ src: raw, alt: img.alt || "Фото" });
        return;
      }
      var rel = raw.replace(/^\.\//, "");
      if (rel.indexOf("assets/") === 0) {
        out.push({ src: resolveAssetRef(rel), alt: img.alt || "Фото" });
      }
    });
    return out;
  }

  function openModal(index) {
    var gallerySources = getGallerySources();
    if (!modal || !modalImg || !gallerySources.length) return;
    var n = gallerySources.length;
    var idx = index;
    if (isNaN(idx)) idx = 0;
    idx = ((idx % n) + n) % n;
    galleryModalIndex = idx;
    galleryAnimating = false;
    clearModalFlipClasses();
    modalImg.src = gallerySources[idx].src;
    modalImg.alt = gallerySources[idx].alt;
    updateModalCaption(idx, n);
    syncModalViewerSingleClass();
    modal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    if (!modal || !modalImg) return;
    modal.setAttribute("hidden", "");
    modalImg.src = "";
    galleryAnimating = false;
    clearModalFlipClasses();
    if (galleryModalViewer) galleryModalViewer.classList.remove("modal__viewer--single");
    document.body.classList.remove("modal-open");
  }

  function beginModalNavigate(delta) {
    var sources = getGallerySources();
    if (!modal || modal.hasAttribute("hidden") || !modalImgFlip || !modalImg)
      return;
    if (sources.length <= 1) return;
    if (galleryAnimating) return;

    var n = sources.length;
    var nextIdx = (galleryModalIndex + delta + n) % n;

    if (prefersReducedMotion()) {
      galleryModalIndex = nextIdx;
      modalImg.src = sources[nextIdx].src;
      modalImg.alt = sources[nextIdx].alt;
      updateModalCaption(nextIdx, n);
      return;
    }

    galleryAnimating = true;
    var dirNext = delta > 0;
    var outClass = dirNext
      ? "modal__img-flip--out-next"
      : "modal__img-flip--out-prev";

    function finishIn() {
      var inClass = dirNext
        ? "modal__img-flip--in-next"
        : "modal__img-flip--in-prev";

      function onInEnd(ev) {
        if (ev.target !== modalImgFlip) return;
        modalImgFlip.removeEventListener("animationend", onInEnd);
        modalImgFlip.classList.remove(inClass);
        galleryAnimating = false;
      }

      modalImgFlip.addEventListener("animationend", onInEnd);
      void modalImgFlip.offsetWidth;
      modalImgFlip.classList.add(inClass);
    }

    function afterSrcSet() {
      modalImg.onload = null;
      modalImg.onerror = null;
      finishIn();
    }

    function onOutEnd(ev) {
      if (ev.target !== modalImgFlip) return;
      modalImgFlip.removeEventListener("animationend", onOutEnd);
      modalImgFlip.classList.remove(outClass);
      galleryModalIndex = nextIdx;
      modalImg.alt = sources[nextIdx].alt;
      updateModalCaption(nextIdx, n);
      modalImg.onload = afterSrcSet;
      modalImg.onerror = afterSrcSet;
      modalImg.src = sources[nextIdx].src;
      if (modalImg.complete && modalImg.naturalWidth) afterSrcSet();
    }

    modalImgFlip.addEventListener("animationend", onOutEnd);
    modalImgFlip.classList.add(outClass);
  }

  if (galleryModalPrev) {
    galleryModalPrev.addEventListener("click", function (e) {
      e.stopPropagation();
      beginModalNavigate(-1);
    });
  }
  if (galleryModalNext) {
    galleryModalNext.addEventListener("click", function (e) {
      e.stopPropagation();
      beginModalNavigate(1);
    });
  }

  if (galleryModalViewer) {
    galleryModalViewer.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length === 1) {
          galleryTouchStartX = e.touches[0].clientX;
        }
      },
      { passive: true }
    );
    galleryModalViewer.addEventListener(
      "touchend",
      function (e) {
        if (!modal || modal.hasAttribute("hidden")) return;
        if (!e.changedTouches.length) return;
        var dx = e.changedTouches[0].clientX - galleryTouchStartX;
        if (Math.abs(dx) < 48) return;
        if (dx < 0) beginModalNavigate(1);
        else beginModalNavigate(-1);
      },
      { passive: true }
    );
  }

  galleryItems.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var idx = parseInt(btn.getAttribute("data-gallery-open"), 10);
      openModal(isNaN(idx) ? 0 : idx);
    });
  });

  document.querySelectorAll("[data-gallery-close]").forEach(function (el) {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", function (e) {
    if (!modal || modal.hasAttribute("hidden")) return;
    if (e.key === "Escape") {
      closeModal();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      beginModalNavigate(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      beginModalNavigate(1);
    }
  });

  (function pageSplash() {
    var splash = document.getElementById("pageSplash");
    if (!splash) return;

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      splash.remove();
      return;
    }

    var titleDelayMs = 700;
    var titleFadeMs = 1100;
    var holdAfterTitleMs = 5000;
    var exitAnimMs = 1500;
    var titleReadyMs = titleDelayMs + titleFadeMs;
    var scanImg = splash.querySelector(".page-splash__scan");
    var splashSequenceStarted = false;
    var safetyTimer;

    document.documentElement.classList.add("splash-active");

    function finishSplash() {
      document.documentElement.classList.remove("splash-active");
      splash.remove();
    }

    function startExit() {
      splash.classList.add("page-splash--exit");
      window.setTimeout(finishSplash, exitAnimMs);
    }

    function beginSplashAfterPreloadReady() {
      if (splashSequenceStarted) return;
      splashSequenceStarted = true;
      if (safetyTimer) window.clearTimeout(safetyTimer);
      splash.classList.add("page-splash--scan-ready");
      window.setTimeout(startExit, titleReadyMs + holdAfterTitleMs);
    }

    function tryDecodeThenStart() {
      if (scanImg && scanImg.decode) {
        scanImg
          .decode()
          .then(beginSplashAfterPreloadReady)
          .catch(beginSplashAfterPreloadReady);
      } else {
        beginSplashAfterPreloadReady();
      }
    }

    if (scanImg) {
      var rawSrc = scanImg.getAttribute("src");
      if (rawSrc && rawSrc.indexOf("assets/") === 0) {
        scanImg.src = resolveAssetRef(rawSrc.replace(/^\.\//, ""));
      }
      safetyTimer = window.setTimeout(beginSplashAfterPreloadReady, 12000);
      if (scanImg.complete && scanImg.naturalWidth > 0) {
        tryDecodeThenStart();
      } else {
        scanImg.addEventListener("load", tryDecodeThenStart, { once: true });
        scanImg.addEventListener("error", beginSplashAfterPreloadReady, {
          once: true,
        });
      }
    } else {
      beginSplashAfterPreloadReady();
    }
  })();

  /**
   * Игра «Самокатчик» — тяжёлый скрипт: грузим при приближении к секции #game
   * или в фоне через requestIdleCallback (fallback: таймаут), без блокировки первого кадра.
   */
  (function loadScooterGameDeferred() {
    function injectScooterScript() {
      if (window.__scooterGameLoadRequested) return;
      window.__scooterGameLoadRequested = true;
      var s = document.createElement("script");
      try {
        s.src = new URL("js/scooter-game.js", getSiteRootHref()).href;
      } catch (e4) {
        s.src = "js/scooter-game.js";
      }
      s.async = true;
      document.body.appendChild(s);
    }
    var gameEl =
      document.getElementById("scooterGameRoot") ||
      document.getElementById("game");
    if (!gameEl) return;
    if (!("IntersectionObserver" in window)) {
      injectScooterScript();
      return;
    }
    var scooterIo = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            scooterIo.disconnect();
            injectScooterScript();
            return;
          }
        }
      },
      { root: null, rootMargin: "180px 0px 180px 0px", threshold: 0.01 }
    );
    scooterIo.observe(gameEl);
    if (window.requestIdleCallback) {
      window.requestIdleCallback(
        function () {
          injectScooterScript();
        },
        { timeout: 5500 }
      );
    } else {
      window.setTimeout(injectScooterScript, 5500);
    }
  })();
})();
