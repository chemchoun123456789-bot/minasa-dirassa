(function () {
  "use strict";
  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  function initReveal() {
    if (reducedMotion) {
      document
        .querySelectorAll(".reveal, .reveal-stagger")
        .forEach(function (el) {
          el.classList.add("visible");
        });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -40px 0px",
      },
    );
    document
      .querySelectorAll(".reveal, .reveal-stagger")
      .forEach(function (el) {
        io.observe(el);
      });
  }
  var _origInitDash = window.initDashboard;
  if (_origInitDash) {
    window.initDashboard = function () {
      _origInitDash.apply(this, arguments);
      setTimeout(initReveal, 500);
      setTimeout(showNavUI, 520);
    };
  }
  initReveal();
  var SECTIONS = [
    {
      id: "sec-schedule",
      label: "📅",
      name: "الجدول",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    },
    {
      id: "sec-tasks",
      label: "✅",
      name: "المهام",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    },
    {
      id: "sec-pomodoro",
      label: "⏱",
      name: "بومودورو",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="currentColor" opacity="0.9"/><ellipse cx="9.5" cy="10" rx="2" ry="1.2" fill="rgba(255,255,255,0.28)" transform="rotate(-20 9.5 10)"/><path d="M12 5 C12 5 11 3 9 3 C9 3 10 5 12 5Z" fill="currentColor"/><path d="M12 5 C12 5 13 2.5 15.5 3 C15.5 3 14 5.5 12 5Z" fill="currentColor" opacity="0.75"/><path d="M12 5 C12 5 10.5 2.2 8.5 3.5 C8.5 3.5 10 5.2 12 5Z" fill="currentColor"/></svg>',
    },
    {
      id: "sec-notes",
      label: "📓",
      name: "الملاحظات",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    },
    {
      id: "sec-stats",
      label: "📊",
      name: "الإحصائيات",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    },
    {
      id: "sec-grades",
      label: "🎯",
      name: "الدرجات",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    },
    {
      id: "sec-exams",
      label: "📆",
      name: "الفروض",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>',
    },
    {
      id: "sec-resources",
      label: "🔗",
      name: "الموارد",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    },
  ];
  var currentSectionIdx = 0;
  var dotsContainer = document.getElementById("sectionDots");
  function buildDots() {
    dotsContainer.innerHTML = "";
    SECTIONS.forEach(function (s, i) {
      var d = document.createElement("div");
      d.className = "sdot" + (i === currentSectionIdx ? " active" : "");
      d.title = s.name;
      d.setAttribute("role", "button");
      d.setAttribute("aria-label", s.name);
      d.setAttribute("tabindex", "0");
      var iconWrap = document.createElement("div");
      iconWrap.className = "sdot-icon";
      iconWrap.innerHTML = s.icon;
      var nameSpan = document.createElement("span");
      nameSpan.className = "sdot-name";
      nameSpan.textContent = s.name;
      d.appendChild(iconWrap);
      d.appendChild(nameSpan);
      d.addEventListener("click", function () {
        navigateTo(i);
      });
      d.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateTo(i);
        }
      });
      dotsContainer.appendChild(d);
    });
  }
  function updateDotUI(idx) {
    currentSectionIdx = idx;
    var dots = dotsContainer.querySelectorAll(".sdot");
    dots.forEach(function (d, i) {
      d.classList.toggle("active", i === idx);
    });
    var arrPrev = document.getElementById("arrPrev");
    var arrNext = document.getElementById("arrNext");
    if (arrPrev) arrPrev.classList.toggle("disabled", idx === 0);
    if (arrNext)
      arrNext.classList.toggle("disabled", idx === SECTIONS.length - 1);
  }
  function showNavUI() {
    var arrowNav = document.getElementById("arrowNav");
    var sectionDots = document.getElementById("sectionDots");
    if (!arrowNav || !sectionDots) return;
    buildDots();
    updateDotUI(0);
    arrowNav.classList.add("visible");
    sectionDots.classList.add("visible");
  }
  function hideNavUI() {
    document.getElementById("arrowNav")?.classList.remove("visible");
    document.getElementById("sectionDots")?.classList.remove("visible");
  }
  var _origLogout = window.logout;
  if (_origLogout) {
    window.logout = function () {
      _origLogout.apply(this, arguments);
      hideNavUI();
    };
  }
  function navigateTo(idx) {
    if (idx < 0 || idx >= SECTIONS.length) return;
    var sectionId = SECTIONS[idx].id;
    var el = document.getElementById(sectionId);
    if (!el) return;
    updateDotUI(idx);
    var offset = 80;
    var top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top: top,
      behavior: "smooth",
    });
  }
  window.navigateSectionDir = function (dir) {
    navigateTo(currentSectionIdx + dir);
  };
  /* backward-compat alias — keeps any inline onclick="arrowNav()" working */
  window.arrowNav = window.navigateSectionDir;
  var scrollSpyAttached = false;
  function scrollSpy() {
    var winH = window.innerHeight;
    var best = 0;
    SECTIONS.forEach(function (s, i) {
      var el = document.getElementById(s.id);
      if (!el) return;
      var rect = el.getBoundingClientRect();
      if (rect.top <= winH * 0.5) best = i;
    });
    if (best !== currentSectionIdx) updateDotUI(best);
  }
  function attachScrollSpy() {
    if (scrollSpyAttached) return;
    scrollSpyAttached = true;
    window.addEventListener("scroll", scrollSpy, {
      passive: true,
    });
  }
  var dashboardEl = document.getElementById("dashboard");
  if (dashboardEl) {
    var dashObserver = new MutationObserver(function () {
      if (dashboardEl.style.display !== "none") {
        attachScrollSpy();
        dashObserver.disconnect();
      }
    });
    dashObserver.observe(dashboardEl, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }
  document.addEventListener("keydown", function (e) {
    var dash = document.getElementById("dashboard");
    if (!dash || dash.style.display === "none") return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var confirm = document.getElementById("confirmDialog");
    if (confirm && confirm.classList.contains("open")) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      navigateTo(currentSectionIdx + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      navigateTo(currentSectionIdx - 1);
    }
  });
  var touchStartX = 0;
  var touchStartY = 0;
  var swipeThreshold = 50;
  var swipeActive = false;
  document.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      swipeActive = true;
      swipeThreshold = Math.max(40, window.innerWidth * 0.12);
    },
    {
      passive: true,
    },
  );
  document.addEventListener(
    "touchmove",
    function (e) {
      if (!swipeActive) return;
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx) * 1.5) swipeActive = false;
    },
    {
      passive: true,
    },
  );
  document.addEventListener(
    "touchend",
    function (e) {
      if (!swipeActive) return;
      swipeActive = false;
      var dash = document.getElementById("dashboard");
      if (!dash || dash.style.display === "none") return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < swipeThreshold) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) {
        navigateTo(currentSectionIdx + 1);
      } else {
        navigateTo(currentSectionIdx - 1);
      }
    },
    {
      passive: true,
    },
  );
  if (!reducedMotion) {
    document.addEventListener("mouseover", function (e) {
      var card = e.target.closest(".note-card, .stat-card");
      if (!card) return;
      if (card._rippleTimeout) clearTimeout(card._rippleTimeout);
      card.style.transition =
        "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s, border-color 0.25s";
    });
  }
  if (!reducedMotion) {
    var timerEl = document.getElementById("pomoTimer");
    if (timerEl) {
      timerEl.style.transition = "text-shadow 0.5s, transform 0.5s";
      setInterval(function () {
        var running = window.isRunning;
        if (!running) {
          timerEl.style.transform = "translateY(-4px)";
          setTimeout(function () {
            timerEl.style.transform = "";
          }, 1200);
        }
      }, 3e3);
    }
  }
  setTimeout(function () {
    var dash = document.getElementById("dashboard");
    if (dash && dash.style.display !== "none") {
      showNavUI();
      attachScrollSpy();
      initReveal();
    }
  }, 600);
})();
