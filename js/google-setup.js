/* ============================================================
   js/google-setup.js
   خاص بصفحة google-setup.html فقط — مستقل تماماً عن script.js
   ============================================================ */

/* ── Supabase (نفس المفاتيح بالضبط) ── */
const SUPABASE_URL = "https://yrxsmdtsjlqvvzwibsyq.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyeHNtZHRzamxxdnZ6d2lic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDk0NTIsImV4cCI6MjA5MzgyNTQ1Mn0.1atB_5xByde4i94HcIkIbEdR_0CgEuOz9jVbArLBiHM";

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/* ============================================================
   خلفية النجوم — نسخة طبق الأصل من script.js (بلا أي تعديل)
   ============================================================ */
const canvas = document.getElementById("starsCanvas");
const ctx = canvas.getContext("2d");
let stars = [];

function initStars() {
  const _starsRect = canvas.getBoundingClientRect();
  canvas.width = _starsRect.width;
  canvas.height = _starsRect.height;
  stars = [];
  createStars(350, 1, 0.18, 0.4);
  createStars(180, 1.8, 0.35, 0.65);
  createStars(70, 2.8, 0.55, 0.9);
}

function createStars(count, size, speed, opacity) {
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: size,
      speed: speed,
      opacity: opacity,
      baseOpacity: opacity,
      twinkleSpeed: 0.003 + Math.random() * 0.007,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }
}

function animateStars() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height,
    0,
    canvas.width / 2,
    canvas.height,
    canvas.height * 1.1,
  );
  glow.addColorStop(0, "rgba(26, 58, 110, 1)");
  glow.addColorStop(0.28, "rgba(15, 35, 80, 0.88)");
  glow.addColorStop(0.52, "rgba(8, 16, 40, 0.55)");
  glow.addColorStop(0.75, "rgba(3, 6, 18, 0.2)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let star of stars) {
    star.twinklePhase += star.twinkleSpeed;
    const twinkle = star.baseOpacity + Math.sin(star.twinklePhase) * 0.15;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, twinkle))})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2);
    ctx.fill();
    star.y -= star.speed;
    if (star.y < 0) {
      star.y = canvas.height;
      star.x = Math.random() * canvas.width;
    }
  }
  requestAnimationFrame(animateStars);
}

window.addEventListener("resize", initStars);
initStars();
animateStars();

/* ============================================================
   مبدّل خلفية النجوم/تتبع المؤشر — نسخة طبق الأصل من index.html
   ============================================================ */
var BG_KEY = "bgTheme";
var currentBgTheme = localStorage.getItem(BG_KEY) || "stars";

function applyBgTheme(theme) {
  var starsEl = document.getElementById("starsCanvas");
  var pixelEl = document.getElementById("pixelBg");
  if (theme === "stars") {
    if (starsEl) starsEl.style.display = "";
    if (pixelEl) pixelEl.style.display = "none";
    document.body.style.background = "#000";
  } else {
    if (starsEl) starsEl.style.display = "none";
    if (pixelEl) pixelEl.style.display = "";
    document.body.style.background = "#000";
  }
}

applyBgTheme(currentBgTheme);

/* ============================================================
   خلفية البكسل المتتبعة للمؤشر — نسخة طبق الأصل من index.html
   ============================================================ */
(function () {
  var pcanvas = document.getElementById("pixelBg");
  if (!pcanvas) return;
  var pctx = pcanvas.getContext("2d", { alpha: true });
  if (!pctx) return;

  var GAP = 6;
  var SPEED_DECAY = 0.025;
  var COLORS = ["#3b82f6", "#06b6d4", "#8b5cf6", "#22d3ee"];
  var pixels = [];
  var cols = 0,
    rows = 0;
  var mouseX = -1000,
    mouseY = -1000;
  var animId = 0;
  var lastTime = 0;

  function hexToRgb(hex) {
    var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r
      ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
      : null;
  }

  function lerpColor(c1, c2, t) {
    var a = hexToRgb(c1),
      b = hexToRgb(c2);
    if (!a || !b) return c1;
    return (
      "rgb(" +
      Math.round(a.r + (b.r - a.r) * t) +
      "," +
      Math.round(a.g + (b.g - a.g) * t) +
      "," +
      Math.round(a.b + (b.b - a.b) * t) +
      ")"
    );
  }

  function getColor(intensity, phase) {
    var t = (phase + intensity) % 1;
    var idx = Math.floor(t * (COLORS.length - 1));
    var nxt = Math.min(idx + 1, COLORS.length - 1);
    var lt = (t * (COLORS.length - 1)) % 1;
    return lerpColor(COLORS[idx], COLORS[nxt], lt);
  }

  function init() {
    var dpr = window.devicePixelRatio || 1;
    var w = window.innerWidth;
    var h = window.innerHeight;
    pcanvas.width = w * dpr;
    pcanvas.height = h * dpr;
    pcanvas.style.width = w + "px";
    pcanvas.style.height = h + "px";
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.scale(dpr, dpr);

    cols = Math.ceil(w / GAP);
    rows = Math.ceil(h / GAP);
    pixels = [];
    for (var i = 0; i < cols; i++) {
      var col = [];
      for (var j = 0; j < rows; j++) {
        col.push({
          x: i * GAP,
          y: j * GAP,
          size: GAP - 1,
          intensity: 0,
          targetIntensity: 0,
          colorPhase: Math.random(),
        });
      }
      pixels.push(col);
    }
  }

  function draw(ts) {
    var dt = ts - lastTime;
    lastTime = ts;
    pctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var radius = 100;

    for (var i = 0; i < cols; i++) {
      var col = pixels[i];
      if (!col) continue;
      for (var j = 0; j < rows; j++) {
        var p = col[j];
        if (!p) continue;
        var cx = p.x + p.size / 2;
        var cy = p.y + p.size / 2;
        var dx = mouseX - cx;
        var dy = mouseY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);

        p.targetIntensity = dist < radius ? Math.pow(1 - dist / radius, 1.5) : 0;
        var lspeed = p.targetIntensity > p.intensity ? 0.3 : SPEED_DECAY;
        p.intensity += (p.targetIntensity - p.intensity) * lspeed;
        p.colorPhase = (p.colorPhase + 0.001 * (dt / 16)) % 1;

        if (p.intensity > 0.01) {
          pctx.globalAlpha = p.intensity * 0.9;
          pctx.fillStyle = getColor(p.intensity, p.colorPhase);
          pctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }
    }
    pctx.globalAlpha = 1;
    animId = requestAnimationFrame(draw);
  }

  var glowTimer;
  function resetGlow() {
    clearTimeout(glowTimer);
    glowTimer = setTimeout(function () {
      mouseX = -1000;
      mouseY = -1000;
    }, 1950);
  }

  window.addEventListener("mousemove", function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    resetGlow();
  });
  window.addEventListener("mouseleave", function () {
    clearTimeout(glowTimer);
    mouseX = -1000;
    mouseY = -1000;
  });
  window.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
        resetGlow();
      }
    },
    { passive: true },
  );
  window.addEventListener("touchend", function () {
    clearTimeout(glowTimer);
    mouseX = -1000;
    mouseY = -1000;
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      cancelAnimationFrame(animId);
      init();
      lastTime = performance.now();
      animId = requestAnimationFrame(draw);
    }, 150);
  });

  init();
  lastTime = performance.now();
  function startIfVisible() {
    if (pcanvas.style.display !== "none") {
      animId = requestAnimationFrame(draw);
    } else {
      setTimeout(startIfVisible, 300);
    }
  }
  startIfVisible();

  var _origApply = window.applyBgTheme;
  window.applyBgTheme = function (theme) {
    _origApply && _origApply(theme);
    if (theme === "pixel") {
      cancelAnimationFrame(animId);
      init();
      lastTime = performance.now();
      animId = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(animId);
    }
  };
})();

/* ============================================================
   Toast — نسخة طبق الأصل من script.js
   ============================================================ */
function toast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.innerHTML = "";
  const msgEl = document.createElement("span");
  msgEl.className = "toast-msg";
  msgEl.textContent = msg;
  t.appendChild(msgEl);
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toast-close";
  closeBtn.setAttribute("aria-label", "إغلاق");
  closeBtn.onclick = closeToast;
  closeBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  t.appendChild(closeBtn);
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  const duration = type === "error" ? 10000 : 5000;
  t._timer = setTimeout(() => t.classList.remove("show"), duration);
}

function closeToast() {
  const t = document.getElementById("toast");
  clearTimeout(t._timer);
  t.classList.remove("show");
}

/* ============================================================
   فلاتر كلمة السر واسم المؤسسة — نسخة طبق الأصل من script.js
   ============================================================ */
const COMMON_PASSWORDS = new Set([
  "123456",
  "password",
  "123456789",
  "12345678",
  "12345",
  "1234567",
  "1234567890",
  "qwerty",
  "abc123",
  "111111",
  "123123",
  "admin",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "master",
  "sunshine",
  "princess",
  "iloveyou",
  "trustno1",
  "football",
  "shadow",
  "superman",
  "michael",
  "password1",
  "qwerty123",
  "passw0rd",
  "654321",
]);

function validatePassSecurity(pass) {
  if (pass.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (COMMON_PASSWORDS.has(pass.toLowerCase()))
    return "كلمة المرور شائعة جداً، اختر كلمة أصعب";
  return null;
}

const SCHOOL_NAME_PREFIXES = [
  "جامعة",
  "الجامعة",
  "ثانوية",
  "الثانوية",
  "متوسطة",
  "المتوسطة",
  "ابتدائية",
  "الابتدائية",
  "إبتدائية",
  "الإبتدائية",
];

function validateInstitutionName(school) {
  var trimmed = school.trim();
  var ok = SCHOOL_NAME_PREFIXES.some(function (prefix) {
    return trimmed.indexOf(prefix) === 0;
  });
  if (!ok)
    return "اسم المؤسسة يجب أن يبدأ بـ: جامعة، ثانوية، متوسطة أو إبتدائية";
  return null;
}

/* ============================================================
   جلب بيانات البروفايل — نسخة طبق الأصل من script.js
   ============================================================ */
async function dbLoadUser(uid) {
  const { data: data, error: error } = await _supabase
    .from("user_profiles")
    .select("*")
    .eq("id", uid)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("dbLoadUser:", error.code, error.message);
    return { __loadError: true };
  }
  return data;
}

/* ============================================================
   منطق فورم إكمال البيانات
   ============================================================ */
function gsCheckPassword(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) || /[a-z]/.test(pw)) score++;
  if (/[0-9!@#$%^&*]/.test(pw)) score++;
  const colors = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6"];
  const labels = ["ضعيفة", "متوسطة", "جيدة", "قوية"];
  for (let i = 1; i <= 4; i++) {
    const seg = document.getElementById("gs" + i);
    if (!seg) continue;
    seg.style.background =
      i <= score ? colors[score - 1] : "rgba(255,255,255,0.08)";
  }
  const lbl = document.getElementById("gsStrengthLabel");
  if (lbl) {
    lbl.textContent = score ? `قوة كلمة المرور: ${labels[score - 1]}` : "";
    lbl.style.color = score ? colors[score - 1] : "var(--muted)";
  }
}

function togglePassVis(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var show = inp.type === "password";
  inp.type = show ? "text" : "password";

  var svg = btn.querySelector("svg");
  if (!svg) return;

  var clone = svg.cloneNode(false);
  if (show) {
    clone.innerHTML =
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<line class="pw-slash" x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    clone.innerHTML =
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
      '<circle cx="12" cy="12" r="3"/>';
  }
  svg.parentNode.replaceChild(clone, svg);
}

var _gsSession = null;

async function submitGoogleProfile() {
  const name = document.getElementById("gsName").value.trim();
  const school = document.getElementById("gsSchool").value.trim();
  const pass = document.getElementById("gsPass").value;
  if (!name) return toast("أدخل اسمك الكامل", "error");
  if (!school) return toast("أدخل اسم المدرسة أو الجامعة", "error");
  const schoolErr = validateInstitutionName(school);
  if (schoolErr) return toast(schoolErr, "error");
  const passErr = validatePassSecurity(pass);
  if (passErr) return toast(passErr, "error");
  const session = _gsSession || (await _supabase.auth.getSession()).data.session;
  if (!session) return toast("انتهت صلاحية الجلسة، حاول مرة أخرى", "error");
  toast("جاري إنشاء ملفك الشخصي...", "info");
  const btn = document.getElementById("gsSubmitBtn");
  if (btn) btn.disabled = true;
  const { error: pwErr } = await _supabase.auth.updateUser({ password: pass });
  if (pwErr) console.warn("Password update warning:", pwErr.message);
  const uid = session.user.id;
  const defaultData = {
    todos: [],
    notes: [],
    schedule: {},
    exams: {},
    practicalSessions: {},
    studyLog: {},
    grades: [],
    theme: "blue",
    examsCountdown: [],
    resources: [],
  };
  const { error: profileError } = await _supabase.from("user_profiles").upsert({
    id: uid,
    name: name,
    school: school,
    data: defaultData,
  });
  if (profileError) {
    console.error("Profile error:", profileError);
    if (btn) btn.disabled = false;
    return toast("خطأ في إنشاء الملف الشخصي: " + profileError.message, "error");
  }
  toast(`أهلاً بك ${name}! تم إنشاء حسابك بنجاح 🎉`, "success");
  setTimeout(function () {
    window.location.href = "/";
  }, 900);
}

async function cancelGoogleSetup() {
  await _supabase.auth.signOut();
  window.location.href = "/";
}

/* ============================================================
   Auth Gate — تخفي شاشة التحميل وتوري الفورم (تُستدعى فقط بعد
   ما نتأكد إنو المستخدم فعلاً محتاج يكمل بياناته)
   ============================================================ */
function hideAuthGateOverlay() {
  var ov = document.getElementById("authGateOverlay");
  if (ov) {
    ov.classList.add("hidden");
    ov.style.display = "none";
  }
  var gsPage = document.getElementById("gsPage");
  if (gsPage) gsPage.style.display = "";
  // نشيل قفل السكرول باش فورم إكمال البيانات يبقى قابل للسكرول عادي
  document.documentElement.classList.remove("auth-gate-locked");
}

/* ============================================================
   حراسة تحميل الصفحة
   ============================================================ */
(async function initGoogleSetupPage() {
  const { data } = await _supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    // ماكاش جلسة — نرجعو للصفحة الرئيسية، overlay تبعها يبقى شغال
    // بلا فلاش لهاذ الفورم
    window.location.href = "/";
    return;
  }
  const profile = await dbLoadUser(session.user.id);
  if (profile && profile.__loadError) {
    toast("خطأ في تحميل بياناتك، حاول مجدداً", "error");
    hideAuthGateOverlay();
    return;
  }
  if (profile && profile.school) {
    // البروفايل مكتمل بالفعل — index.html يدخله للوحة التحكم مباشرة
    window.location.href = "/";
    return;
  }
  _gsSession = session;
  const gsNameEl = document.getElementById("gsName");
  if (gsNameEl && session.user?.user_metadata) {
    gsNameEl.value =
      session.user.user_metadata.full_name ||
      session.user.user_metadata.name ||
      "";
  }
  hideAuthGateOverlay();
})();
