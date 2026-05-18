(function () {
  "use strict";

  /* ---------------------------------------------------------------
         1. INTERSECTION OBSERVER — scroll-reveal
      --------------------------------------------------------------- */
  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  function initReveal() {
    if (reducedMotion) {
      // instantly show everything
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
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );

    document
      .querySelectorAll(".reveal, .reveal-stagger")
      .forEach(function (el) {
        io.observe(el);
      });
  }

  // Re-run reveal after dashboard renders (cards added dynamically)
  var _origInitDash = window.initDashboard;
  if (_origInitDash) {
    window.initDashboard = function () {
      _origInitDash.apply(this, arguments);
      setTimeout(initReveal, 500); // after skeleton fades
      setTimeout(showNavUI, 520);
    };
  }

  initReveal();

  /* ---------------------------------------------------------------
         2. SECTION LIST (mirrors sectionNav order)
      --------------------------------------------------------------- */
  var SECTIONS = [
    { id: "sec-schedule", label: "📅" },
    { id: "sec-tasks", label: "✅" },
    { id: "sec-notes", label: "📓" },
    { id: "sec-stats", label: "📊" },
    { id: "sec-grades", label: "🎯" },
    { id: "sec-exams", label: "📆" },
    { id: "sec-resources", label: "🔗" },
  ];
  var currentSectionIdx = 0;

  /* ---------------------------------------------------------------
         3. BUILD SIDEBAR DOTS
      --------------------------------------------------------------- */
  var dotsContainer = document.getElementById("sectionDots");

  function buildDots() {
    dotsContainer.innerHTML = "";
    SECTIONS.forEach(function (s, i) {
      var d = document.createElement("div");
      d.className = "sdot" + (i === currentSectionIdx ? " active" : "");
      d.title = s.label;
      d.addEventListener("click", function () {
        navigateTo(i);
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
    // update arrow disabled state
    document.getElementById("arrPrev").classList.toggle("disabled", idx === 0);
    document
      .getElementById("arrNext")
      .classList.toggle("disabled", idx === SECTIONS.length - 1);
  }

  /* ---------------------------------------------------------------
         4. SHOW / HIDE NAV UI (called after login / logout)
      --------------------------------------------------------------- */
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
    document.getElementById("arrowNav").classList.remove("visible");
    document.getElementById("sectionDots").classList.remove("visible");
  }

  // Hook into existing logout
  var _origLogout = window.logout;
  if (_origLogout) {
    window.logout = function () {
      _origLogout.apply(this, arguments);
      hideNavUI();
    };
  }

  /* ---------------------------------------------------------------
         5. NAVIGATE TO SECTION
      --------------------------------------------------------------- */
  function navigateTo(idx) {
    if (idx < 0 || idx >= SECTIONS.length) return;
    var sectionId = SECTIONS[idx].id;
    var el = document.getElementById(sectionId);
    if (!el) return;

    updateDotUI(idx);

    var offset = 80;
    var top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  /* Public helper used by arrow buttons (onclick in HTML) */
  window.arrowNav = function (dir) {
    navigateTo(currentSectionIdx + dir);
  };

  /* ---------------------------------------------------------------
         6. SCROLL SPY — update active dot as user scrolls
      --------------------------------------------------------------- */
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
    window.addEventListener("scroll", scrollSpy, { passive: true });
  }

  // Attach once dashboard is visible
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

  /* ---------------------------------------------------------------
         7. KEYBOARD ARROW NAVIGATION
      --------------------------------------------------------------- */
  document.addEventListener("keydown", function (e) {
    // Only when dashboard is visible and no input is focused
    var dash = document.getElementById("dashboard");
    if (!dash || dash.style.display === "none") return;

    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    // Don't interfere with dialogs
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

  /* ---------------------------------------------------------------
         8. TOUCH SWIPE — mobile support
      --------------------------------------------------------------- */
  var touchStartX = 0;
  var touchStartY = 0;
  var swipeThreshold = 60;
  var swipeActive = false;

  document.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      swipeActive = true;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    function (e) {
      if (!swipeActive) return;
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      // If mostly vertical swipe, let normal scroll happen
      if (Math.abs(dy) > Math.abs(dx) * 1.5) swipeActive = false;
    },
    { passive: true },
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

      // Only handle horizontal swipes
      if (Math.abs(dx) < swipeThreshold) return;
      if (Math.abs(dy) > Math.abs(dx)) return;

      // RTL: swipe left = next section, swipe right = previous
      if (dx < 0) {
        navigateTo(currentSectionIdx + 1);
      } else {
        navigateTo(currentSectionIdx - 1);
      }
    },
    { passive: true },
  );

  /* ---------------------------------------------------------------
         9. HOVER RIPPLE on cards (lightweight, transform-only)
      --------------------------------------------------------------- */
  if (!reducedMotion) {
    document.addEventListener("mouseover", function (e) {
      var card = e.target.closest(".note-card, .stat-card");
      if (!card) return;
      if (card._rippleTimeout) clearTimeout(card._rippleTimeout);
      card.style.transition =
        "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s, border-color 0.25s";
    });
  }

  /* ---------------------------------------------------------------
         10. FLOATING ANIMATION on pomo card
      --------------------------------------------------------------- */
  if (!reducedMotion) {
    var pomoCard = document.querySelector("#pomoSettings")?.closest(".card");
    // Apply float to pomo timer display area when idle
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
      }, 3000);
    }
  }

  /* ---------------------------------------------------------------
         11. AUTO-SHOW if already logged in on page load
      --------------------------------------------------------------- */
  setTimeout(function () {
    var dash = document.getElementById("dashboard");
    if (dash && dash.style.display !== "none") {
      showNavUI();
      attachScrollSpy();
      initReveal();
    }
  }, 600);
})();
