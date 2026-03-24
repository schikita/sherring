(function () {
  "use strict";

  /**
   * Корень сайта: папка, где лежит index.html (рядом с /js/main.js).
   * Так относительные пути assets/... работают и при открытии из подпапки на сервере,
   * и при file://, если html и js лежат в ожидаемой структуре.
   */
  function getSiteRootHref() {
    var el = document.querySelector('script[src*="main.js"]');
    if (!el) return new URL("./", window.location.href).href;
    var raw = el.getAttribute("src");
    if (!raw) return new URL("./", window.location.href).href;
    try {
      var abs = new URL(raw, window.location.href);
      return abs.href.replace(/\/js\/main\.js(\?.*)?$/i, "/");
    } catch (e) {
      return new URL("./", window.location.href).href;
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
    document.querySelectorAll("main .section").forEach(function (sec) {
      lazyMediaObs.observe(sec);
    });
    var footLazy = document.querySelector("footer.site-footer");
    if (footLazy) lazyMediaObs.observe(footLazy);
  } else {
    document.querySelectorAll("main .section").forEach(loadSectionLazyMedia);
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

  /* Header shadow on scroll */
  function onScrollHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* Back to top: иконки — только когда кнопка реально нужна (прокрутка вниз), не через IO на fixed */
  var backToTop = document.getElementById("backToTop");
  if (backToTop) {
    function onScrollBackToTop() {
      var show = window.scrollY > 400;
      backToTop.classList.toggle("is-visible", show);
      if (show) loadSectionLazyMedia(backToTop);
    }
    window.addEventListener("scroll", onScrollBackToTop, { passive: true });
    onScrollBackToTop();
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
  var galleryItems = document.querySelectorAll("[data-gallery-open]");

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
    if (!modal || !modalImg || !gallerySources[index]) return;
    modalImg.src = gallerySources[index].src;
    modalImg.alt = gallerySources[index].alt;
    modal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    if (!modal || !modalImg) return;
    modal.setAttribute("hidden", "");
    modalImg.src = "";
    document.body.classList.remove("modal-open");
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
    if (e.key === "Escape" && modal && !modal.hasAttribute("hidden")) closeModal();
  });
})();
