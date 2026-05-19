// ============================================================
//  SUPABASE CLIENT
// ============================================================
const SUPABASE_URL = "https://yrxsmdtsjlqvvzwibsyq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyeHNtZHRzamxxdnZ6d2lic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDk0NTIsImV4cCI6MjA5MzgyNTQ1Mn0.1atB_5xByde4i94HcIkIbEdR_0CgEuOz9jVbArLBiHM";

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  STATE
// ============================================================
let user = null; // { id, name, school, email, data:{...} }
let timerInterval = null;
let timeLeft = 25 * 60;
let isRunning = false;
let pomoMode = "study";
let currentSession = 1;
let currentTab = "schedule";
let audioCtx = null;
let chillSounds = {};
let config = { study: 25, break: 5, sessions: 4, longBreak: 20 };
let confirmCallback = null;

const subjects = [
  "رياضيات",
  "فيزياء",
  "علوم",
  "عربية",
  "فرنسية",
  "إنجليزية",
  "تاريخ/جغرافيا",
  "فلسفة",
  "إسلامية",
  "إعلام آلي",
  "تكنلوجيا",
  "تكنلوجيا - كهرباء",
  "تكنلوجيا - اقتصاد",
  "تكنلوجيا - ميكانيك",
  "تربية بدنية",
  "فراغ",
];

// ============================================================
//  SUPABASE HELPERS
// ============================================================
async function dbSaveUser() {
  if (!user) return;
  const { error } = await _supabase.from("user_profiles").upsert(
    {
      id: user.id,
      name: user.name,
      school: user.school,
      data: user.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) console.error("Save error:", error);
}

async function dbLoadUser(uid) {
  const { data, error } = await _supabase
    .from("user_profiles")
    .select("*")
    .eq("id", uid)
    .single();
  if (error) return null;
  return data;
}

// ============================================================
//  UTILS
// ============================================================
function toast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3200);
}

function getAudioCtx() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function confirmAction(msg, cb) {
  document.getElementById("confirmMsg").textContent = msg;
  document.getElementById("confirmDialog").classList.add("open");
  confirmCallback = cb;
}
function closeConfirm() {
  document.getElementById("confirmDialog").classList.remove("open");
  confirmCallback = null;
}
document.getElementById("confirmYes").onclick = () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const dlg = document.getElementById("confirmDialog");
    if (dlg.classList.contains("open")) closeConfirm();
    const pModal = document.getElementById("practicalModal");
    if (pModal.style.display === "flex") closePracticalModal();
    const pomoSet = document.getElementById("pomoSettings");
    if (pomoSet.classList.contains("open")) togglePomoSettings();
  }
});

function formatNow() {
  return new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
//  RESPONSIVE GRID
// ============================================================
function applyResponsive() {
  const grid = document.getElementById("mainGrid");
  if (!grid) return;
  grid.style.gridTemplateColumns = window.innerWidth < 768 ? "1fr" : "1fr 1fr";
}
window.addEventListener("resize", applyResponsive);

// ============================================================
//  GOOGLE SIGN-IN — OAuth via Supabase
// ============================================================

// حالة مؤقتة لتخزين بيانات جلسة Google قبل إتمام الملف الشخصي
let _googlePendingSession = null;

// فحص جلسة Google عند تحميل الصفحة (بعد الرجوع من Google)
(async function checkGoogleSession() {
  try {
    const {
      data: { session },
    } = await _supabase.auth.getSession();
    if (!session) return;

    // تحقق إذا كان هذا login عادي (email/password) أم Google OAuth
    const provider = session.user?.app_metadata?.provider;
    if (provider !== "google") return;

    // تحقق من وجود ملف شخصي
    const profile = await dbLoadUser(session.user.id);

    if (profile) {
      // مستخدم موجود — دخول مباشر
      user = {
        id: session.user.id,
        name: profile.name,
        school: profile.school,
        email: session.user.email,
        data: profile.data || {},
      };
      if (!user.data.practicalSessions) user.data.practicalSessions = {};
      if (!user.data.studyLog) user.data.studyLog = {};
      if (!user.data.totalPomoSec) user.data.totalPomoSec = 0;
      if (!user.data.grades) user.data.grades = [];
      if (!user.data.theme) user.data.theme = "blue";
      if (!user.data.examsCountdown) user.data.examsCountdown = [];
      if (!user.data.resources) user.data.resources = [];
      toast(`أهلاً ${user.name}! 👋`, "success");
      initDashboard();
    } else {
      // مستخدم جديد — أظهر modal الإعداد
      _googlePendingSession = session;
      const gsNameEl = document.getElementById("gsName");
      if (gsNameEl) {
        gsNameEl.value =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          "";
      }
      openGoogleSetupModal();
    }
  } catch (err) {
    console.error("Google session check error:", err);
  }
})();

async function handleGoogleSignIn() {
  const btn = document.getElementById("googleSignInBtn");
  const inner = document.getElementById("googleBtnInner");
  const spinner = document.getElementById("googleSpinner");

  // أظهر حالة التحميل
  btn.disabled = true;
  inner.style.display = "none";
  spinner.style.display = "flex";

  try {
    const { error } = await _supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://minassa-dirasa.vercel.app",
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) {
      toast("خطأ في الاتصال بـ Google: " + error.message, "error");
      btn.disabled = false;
      inner.style.display = "flex";
      spinner.style.display = "none";
    }
    // لو نجح → Google ستعيد التوجيه تلقائياً، لا حاجة لتعطيل الـ spinner
  } catch (err) {
    toast("خطأ: " + err.message, "error");
    btn.disabled = false;
    inner.style.display = "flex";
    spinner.style.display = "none";
  }
}

function openGoogleSetupModal() {
  const modal = document.getElementById("googleSetupModal");
  modal.style.display = "flex";
  // إخفاء كل شيء خلف الـ modal
  document.getElementById("authArea").classList.add("hidden");
  setTimeout(() => {
    const nameInput = document.getElementById("gsName");
    if (nameInput) nameInput.focus();
  }, 200);
}

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

async function submitGoogleProfile() {
  const name = document.getElementById("gsName").value.trim();
  const school = document.getElementById("gsSchool").value.trim();
  const pass = document.getElementById("gsPass").value;

  if (!name) return toast("يرجى إدخال اسمك الكامل", "error");
  if (!school) return toast("يرجى إدخال اسم المدرسة أو الجامعة", "error");
  if (pass.length < 6)
    return toast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");

  const session =
    _googlePendingSession || (await _supabase.auth.getSession()).data.session;
  if (!session) return toast("انتهت صلاحية الجلسة، حاول مرة أخرى", "error");

  toast("جاري إنشاء ملفك الشخصي...", "info");

  // تحديث كلمة المرور في Supabase Auth (كلمة مرور خاصة بالموقع)
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

  const { error: profileError } = await _supabase
    .from("user_profiles")
    .insert({ id: uid, name, school, data: defaultData });

  if (profileError) {
    console.error("Profile error:", profileError);
    return toast("خطأ في إنشاء الملف الشخصي: " + profileError.message, "error");
  }

  user = {
    id: uid,
    name,
    school,
    email: session.user.email,
    data: defaultData,
  };
  _googlePendingSession = null;

  // إغلاق الـ modal
  document.getElementById("googleSetupModal").style.display = "none";
  toast(`أهلاً بك ${name}! تم إنشاء حسابك بنجاح 🎉`, "success");
  initDashboard();
}

async function cancelGoogleSetup() {
  _googlePendingSession = null;
  await _supabase.auth.signOut();
  document.getElementById("googleSetupModal").style.display = "none";
  document.getElementById("authArea").classList.remove("hidden");
  document.getElementById("authChoice").style.display = "flex";
  document.getElementById("googleAuthWrap").style.display = "block";
  toast("تم إلغاء التسجيل", "info");
}

// ============================================================
function checkPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) || /[a-z]/.test(pw)) score++;
  if (/[0-9!@#$%^&*]/.test(pw)) score++;
  const colors = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6"];
  const labels = ["ضعيفة", "متوسطة", "جيدة", "قوية"];
  for (let i = 1; i <= 4; i++) {
    const seg = document.getElementById("s" + i);
    seg.style.background =
      i <= score ? colors[score - 1] : "rgba(255,255,255,0.08)";
  }
  document.getElementById("strengthLabel").textContent = score
    ? `قوة كلمة المرور: ${labels[score - 1]}`
    : "";
  document.getElementById("strengthLabel").style.color = score
    ? colors[score - 1]
    : "var(--muted)";
}

async function handleAuth(type) {
  if (type === "register") {
    const name = document.getElementById("regName").value.trim();
    const school = document.getElementById("regSchool").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPass").value;

    if (!name || !school)
      return toast("يرجى ملء كافة البيانات الأساسية", "error");
    if (!validateEmail(email))
      return toast("صيغة البريد الإلكتروني غير صحيحة!", "error");
    if (pass.length < 6)
      return toast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");

    toast("جاري إنشاء الحساب...", "info");

    const { data: authData, error: authError } = await _supabase.auth.signUp({
      email,
      password: pass,
    });

    if (authError) {
      if (authError.message.includes("already registered"))
        return toast("هذا البريد مسجل مسبقاً", "error");
      return toast("خطأ: " + authError.message, "error");
    }

    const uid = authData.user.id;
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

    const { error: profileError } = await _supabase
      .from("user_profiles")
      .insert({ id: uid, name, school, data: defaultData });

    if (profileError) {
      console.error("Profile error:", profileError);
      return toast("خطأ في إنشاء الملف الشخصي", "error");
    }

    user = { id: uid, name, school, email, data: defaultData };
    toast("أهلاً بك! تم إنشاء حسابك بنجاح 🎉", "success");
    initDashboard();
  } else {
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("pass").value;

    toast("جاري تسجيل الدخول...", "info");

    const { data: authData, error: authError } =
      await _supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

    if (authError) {
      if (authError.message.includes("Invalid login"))
        return toast("البريد الإلكتروني أو كلمة المرور غير صحيحة", "error");
      return toast("خطأ: " + authError.message, "error");
    }

    const uid = authData.user.id;
    const profile = await dbLoadUser(uid);

    if (!profile) return toast("لا يوجد ملف شخصي لهذا الحساب", "error");

    user = {
      id: uid,
      name: profile.name,
      school: profile.school,
      email: email,
      data: profile.data || {},
    };

    if (!user.data.practicalSessions) user.data.practicalSessions = {};
    if (!user.data.studyLog) user.data.studyLog = {};
    if (!user.data.totalPomoSec) user.data.totalPomoSec = 0;
    if (!user.data.grades) user.data.grades = [];
    if (!user.data.theme) user.data.theme = "blue";
    if (!user.data.examsCountdown) user.data.examsCountdown = [];
    if (!user.data.resources) user.data.resources = [];

    toast(`أهلاً ${user.name}! 👋`, "success");
    initDashboard();
  }
}

function toggleAuth(isReg) {
  var loginForm = document.getElementById("loginForm");
  var regForm = document.getElementById("regForm");
  var choice = document.getElementById("authChoice");
  var googleWrap = document.getElementById("googleAuthWrap");

  choice.style.display = "none";
  if (googleWrap) googleWrap.style.display = "none";

  if (isReg) {
    loginForm.style.display = "none";
    loginForm.classList.add("hidden");
    loginForm.classList.remove("card-reveal");
    regForm.style.display = "block";
    regForm.classList.remove("hidden");
    regForm.classList.add("card-reveal");
  } else {
    regForm.style.display = "none";
    regForm.classList.add("hidden");
    regForm.classList.remove("card-reveal");
    loginForm.style.display = "block";
    loginForm.classList.remove("hidden");
    loginForm.classList.add("card-reveal");
  }
}

function expandToForm(type) {
  const choice = document.getElementById("authChoice");
  const btnLogin = document.getElementById("btnGoLogin");
  const btnReg = document.getElementById("btnGoRegister");
  const googleWrap = document.getElementById("googleAuthWrap");

  const activeBtn = type === "login" ? btnLogin : btnReg;
  const otherBtn = type === "login" ? btnReg : btnLogin;

  otherBtn.style.transition = "opacity 0.25s, transform 0.25s";
  otherBtn.style.opacity = "0";
  otherBtn.style.transform = "scale(0.85)";

  activeBtn.classList.add("expanding");
  activeBtn.style.width = "100%";
  activeBtn.style.minWidth = "100%";

  // إخفاء زر Google بشكل سلس
  if (googleWrap) {
    googleWrap.style.transition = "opacity 0.2s, transform 0.2s";
    googleWrap.style.opacity = "0";
    googleWrap.style.transform = "translateY(8px)";
  }

  setTimeout(function () {
    choice.style.display = "none";
    if (googleWrap) googleWrap.style.display = "none";

    var formId = type === "login" ? "loginForm" : "regForm";
    var form = document.getElementById(formId);
    form.style.display = "block";
    form.classList.remove("hidden");
    form.classList.add("card-reveal");

    otherBtn.style.opacity = "";
    otherBtn.style.transform = "";
    activeBtn.classList.remove("expanding");
    activeBtn.style.width = "";
    activeBtn.style.minWidth = "";

    if (googleWrap) {
      googleWrap.style.opacity = "";
      googleWrap.style.transform = "";
    }
  }, 420);
}

async function logout() {
  await saveUser();
  await _supabase.auth.signOut();
  user = null;
  clearInterval(timerInterval);
  isRunning = false;
  Object.keys(chillSounds).forEach((k) => {
    const s = chillSounds[k];
    if (s.audio) {
      s.audio.pause();
    } else {
      try {
        s.source.stop();
      } catch {}
    }
  });
  chillSounds = {};
  if (window._navHide) window._navHide();
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("authArea").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("exportDataBtn").classList.add("hidden");
  document.getElementById("importDataBtn").classList.add("hidden");
  document.getElementById("themeBar").classList.remove("visible");
  var ft = document.getElementById("focusModeToggle");
  if (ft) ft.classList.remove("visible");
  var gb = document.getElementById("guideFloatBtn");
  if (gb) gb.classList.remove("visible");
  if (window._focusMode) {
    window._focusMode = false;
    document.body.classList.remove("focus-mode");
  }
  document.getElementById("mainTitle").textContent = "منصة دراسة";
  document.getElementById("displaySchool").textContent = "نحو مستقبل مشرق";
  // إعادة إظهار الـ tagline
  var tagline = document.getElementById("landingTagline");
  if (tagline) tagline.style.display = "";
  document.getElementById("email").value = "";
  document.getElementById("pass").value = "";
  document.getElementById("authChoice").style.display = "flex";
  var lf = document.getElementById("loginForm");
  var rf = document.getElementById("regForm");
  lf.style.display = "none";
  lf.classList.add("hidden");
  lf.classList.remove("card-reveal");
  rf.style.display = "none";
  rf.classList.add("hidden");
  rf.classList.remove("card-reveal");
  // إعادة إظهار زر Google
  var gw = document.getElementById("googleAuthWrap");
  if (gw) {
    gw.style.display = "block";
    gw.style.opacity = "";
    gw.style.transform = "";
  }
  // إعادة ضبط زر Google للوضع الطبيعي
  var gBtn = document.getElementById("googleSignInBtn");
  if (gBtn) {
    gBtn.disabled = false;
  }
  var gInner = document.getElementById("googleBtnInner");
  if (gInner) gInner.style.display = "flex";
  var gSpin = document.getElementById("googleSpinner");
  if (gSpin) gSpin.style.display = "none";
  toast("تم تسجيل الخروج بنجاح", "info");
}

// ============================================================
//  DASHBOARD INIT
// ============================================================
function initDashboard() {
  document.getElementById("authArea").classList.add("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");
  document.getElementById("exportDataBtn").classList.remove("hidden");
  document.getElementById("importDataBtn").classList.remove("hidden");
  document.getElementById("themeBar").classList.add("visible");
  document.getElementById("mainTitle").textContent = user.school;
  document.getElementById("displaySchool").textContent =
    `طالب: ${user.name}  •  ${user.school}`;

  // إخفاء الـ tagline بعد تسجيل الدخول
  var tagline = document.getElementById("landingTagline");
  if (tagline) tagline.style.display = "none";

  // أظهر الـ skeleton
  const skeleton = document.getElementById("skeletonLoader");
  if (skeleton) skeleton.classList.add("visible");

  setTimeout(function () {
    applyResponsive();
    renderTable();
    renderList("todo");
    renderList("note");
    renderStats();
    renderGrades();
    renderExams();
    renderResources();
    applyTheme(user.data.theme || "blue");
    updateDots();
    resetPomo();

    // أخفِ الـ skeleton وأظهر الداشبورد
    if (skeleton) {
      skeleton.style.transition = "opacity 0.35s ease";
      skeleton.style.opacity = "0";
      setTimeout(function () {
        skeleton.classList.remove("visible");
        skeleton.style.opacity = "";
        skeleton.style.transition = "";
        const dash = document.getElementById("dashboard");
        dash.classList.remove("hidden");
        dash.style.display = "block";
        if (window._navAttach) window._navAttach();
        // إظهار الأزرار فوراً عند ظهور الداشبورد
        var _ft = document.getElementById("focusModeToggle");
        if (_ft) _ft.classList.add("visible");
        var _gb = document.getElementById("guideFloatBtn");
        if (_gb) _gb.classList.add("visible");
        var _sb = document.getElementById("searchBtn");
        if (_sb) _sb.classList.remove("hidden");
      }, 360);
    }
  }, 400);
}

async function saveUser() {
  if (user) await dbSaveUser();
}

// ============================================================
//  SCHEDULE TABLE
// ============================================================
function renderTable() {
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const body = document.getElementById("tableBody");
  body.innerHTML = "";
  const pBtn = document.getElementById("practicalSettingsBtn");
  if (pBtn) pBtn.style.display = currentTab === "schedule" ? "flex" : "none";
  const rBtn = document.getElementById("resetScheduleBtn");
  if (rBtn) rBtn.style.display = currentTab === "schedule" ? "flex" : "none";
  days.forEach((day, dIdx) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(255,255,255,0.04)";
    const dayTd = document.createElement("td");
    dayTd.className = "day-cell";
    dayTd.textContent = day;
    tr.appendChild(dayTd);
    for (let i = 0; i < 8; i++) {
      if (i === 4) {
        const brk = document.createElement("td");
        brk.style.cssText =
          "background:rgba(0,0,0,0.25);text-align:center;font-size:13px;color:var(--muted);";
        brk.textContent = "☕";
        tr.appendChild(brk);
        continue;
      }
      const slotIdx = i < 4 ? i : i;
      const key = `${currentTab}_${dIdx}_${slotIdx}`;
      const val = user.data[currentTab]?.[key] || "-";
      const td = document.createElement("td");
      td.id = `cell_${currentTab}_${dIdx}_${slotIdx}`;
      const practKey = `practical_${dIdx}_${slotIdx}`;
      const practData = user.data.practicalSessions?.[practKey];
      if (practData && currentTab === "schedule") {
        td.style.cssText =
          "background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);text-align:center;padding:6px 4px;";
        td.innerHTML = `<span style="font-size:11px;color:var(--cyan);font-weight:700;">${escHtml(practData.sub1)} / ${escHtml(practData.sub2)}</span>`;
        tr.appendChild(td);
        continue;
      }
      const sel = document.createElement("select");
      sel.setAttribute(
        "aria-label",
        `مادة ${days[dIdx]} - خانة ${slotIdx + 1}`,
      );
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "-";
      emptyOpt.textContent = "-";
      if (val === "-") emptyOpt.selected = true;
      sel.appendChild(emptyOpt);
      subjects.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        if (val === s) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = () => saveCell(key, sel.value);
      td.appendChild(sel);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  });
}

function saveSchedule() {
  saveUser();
  toast("✓ تم حفظ الجدول بنجاح", "success");
}

function saveCell(key, val) {
  if (!user.data[currentTab]) user.data[currentTab] = {};
  user.data[currentTab][key] = val;
  saveUser();
}

function resetScheduleTable() {
  confirmAction(
    "⚠️ لا يمكن التراجع عن هذا الإجراء\nسيتم حذف كل محتوى الجدول الحالي نهائياً. هل تريد المتابعة؟",
    () => {
      user.data[currentTab] = {};
      if (currentTab === "schedule") {
        user.data.practicalSessions = {};
      }
      saveUser();
      renderTable();
      toast("تم مسح الجدول بالكامل", "info");
    },
  );
}

function openPracticalSettings() {
  if (currentTab !== "schedule") return;
  document.getElementById("practicalModal").style.display = "flex";
  document.getElementById("pDay").value = "";
  document.getElementById("pSlot").value = "";
  document.getElementById("pDuration").value = "2";
  document.getElementById("pSub1").value = "";
  document.getElementById("pSub2").value = "";
  document.getElementById("pSub1TechnoOpts").style.display = "none";
  document.getElementById("pSub2TechnoOpts").style.display = "none";
}

function closePracticalModal() {
  document.getElementById("practicalModal").style.display = "none";
}

function updatePSub1() {
  const v = document.getElementById("pSub1").value;
  document.getElementById("pSub1TechnoOpts").style.display =
    v === "تكنلوجيا" ? "block" : "none";
}

function updatePSub2() {
  const v = document.getElementById("pSub2").value;
  document.getElementById("pSub2TechnoOpts").style.display =
    v === "تكنلوجيا" ? "block" : "none";
}

function applyPracticalSession() {
  const day = document.getElementById("pDay").value;
  const slot = document.getElementById("pSlot").value;
  const duration = parseInt(document.getElementById("pDuration").value);
  let sub1Raw = document.getElementById("pSub1").value;
  let sub2Raw = document.getElementById("pSub2").value;

  if (day === "" || slot === "") return toast("اختر اليوم والوقت", "error");
  if (!sub1Raw || !sub2Raw) return toast("اختر المادتين", "error");

  if (sub1Raw === "تكنلوجيا")
    sub1Raw = document.getElementById("pSub1Techno").value;
  if (sub2Raw === "تكنلوجيا")
    sub2Raw = document.getElementById("pSub2Techno").value;

  const dIdx = parseInt(day);
  const slotIdx = parseInt(slot);
  const combined = `${sub1Raw} / ${sub2Raw}`;

  if (!user.data.practicalSessions) user.data.practicalSessions = {};

  const key1 = `practical_${dIdx}_${slotIdx}`;
  user.data.practicalSessions[key1] = { sub1: sub1Raw, sub2: sub2Raw };

  if (duration === 2) {
    let next = slotIdx + 1;
    if (next === 4) next = 5; // skip the break column (index 4)
    const key2 = `practical_${dIdx}_${next}`;
    user.data.practicalSessions[key2] = { sub1: sub1Raw, sub2: sub2Raw };
  }

  saveUser();
  closePracticalModal();
  renderTable();
  toast(`✓ تم تطبيق الحصة التطبيقية: ${combined}`, "success");
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById("tab-schedule").className =
    "tab" + (tab === "schedule" ? " active" : "");
  document.getElementById("tab-exams").className =
    "tab" + (tab === "exams" ? " active" : "");
  renderTable();
}

// ============================================================
//  TASKS & NOTES
// ============================================================
function renderList(type) {
  const list = document.getElementById(`${type}List`);
  const items = user.data[type + "s"] || [];

  if (type === "todo") {
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>لا توجد مهام بعد<br>أضف مهمتك الأولى!</p></div>`;
    } else {
      list.innerHTML = items
        .map(
          (item, idx) => `
                <div class="todo-item">
                    <input type="checkbox" ${item.completed ? "checked" : ""} onchange="toggleComplete(${idx})">
                    <span style="font-size:14px; flex:1; ${item.completed ? "text-decoration:line-through; color:var(--muted);" : "color:var(--text);"}">${escHtml(item.text)}</span>
                    <button class="del-btn" onclick="removeItem('todo',${idx},'${escHtml(item.text).substring(0, 20)}')">✕</button>
                </div>
            `,
        )
        .join("");
    }
    updateProgress();
  } else {
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg><p>لا توجد ملاحظات بعد<br>سجّل أول ملاحظاتك!</p></div>`;
    } else {
      list.innerHTML = items
        .map(
          (item, idx) => `
                <div class="note-card">
                    <button class="del-btn" onclick="removeItem('note',${idx},'ملاحظة')">✕ حذف</button>
                    <p>${escHtml(typeof item === "string" ? item : item.text)}</p>
                    <time>${typeof item === "object" && item.date ? item.date : ""}</time>
                </div>
            `,
        )
        .join("");
    }
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addItem(type) {
  const inp = document.getElementById(`${type}Inp`);
  const val = inp.value.trim();
  if (!val) {
    inp.focus();
    return;
  }
  if (type === "todo") {
    user.data.todos.push({ text: val, completed: false });
  } else {
    user.data.notes.push({ text: val, date: formatNow() });
  }
  inp.value = "";
  saveUser();
  renderList(type);
  inp.focus();
}

function toggleComplete(idx) {
  user.data.todos[idx].completed = !user.data.todos[idx].completed;
  saveUser();
  renderList("todo");
}

function removeItem(type, idx, label) {
  confirmAction(`حذف "${label}"؟ لا يمكن التراجع عن هذا.`, () => {
    user.data[type + "s"].splice(idx, 1);
    saveUser();
    renderList(type);
  });
}

function updateProgress() {
  const todos = user.data.todos || [];
  const done = todos.filter((t) => t.completed).length;
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0;
  document.getElementById("progressBar").style.width = pct + "%";
  document.getElementById("progressText").textContent = pct + "%";
  document.getElementById("progressDetail").textContent =
    `${done} من ${todos.length} مهمة مكتملة`;
}

// ============================================================
//  STATS
// ============================================================
function renderStats() {
  if (!user) return;
  if (!user.data.studyLog) user.data.studyLog = {};
  const log = user.data.studyLog;
  const dayNames = ["أحد", "اثن", "ثلا", "أرب", "خمس", "جمع", "سبت"];
  const now = new Date();

  // بناء آخر 14 يوم
  const days14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days14.push({
      key,
      label: dayNames[d.getDay()],
      seconds: log[key] || 0,
    });
  }
  const thisWeek = days14.slice(7); // آخر 7 أيام
  const prevWeek = days14.slice(0, 7); // الأسبوع قبله

  const todaySec = thisWeek[6].seconds;
  const weekSec = thisWeek.reduce((s, d) => s + d.seconds, 0);
  const prevSec = prevWeek.reduce((s, d) => s + d.seconds, 0);
  const bestDay = thisWeek.reduce(
    (b, d) => (d.seconds > b.seconds ? d : b),
    thisWeek[0],
  );

  function fmtTime(sec) {
    if (sec === 0) return "0د";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0 && m > 0) return `${h}س ${m}د`;
    if (h > 0) return `${h}س`;
    return `${m}د`;
  }

  // أكثر مادة — من جدول الحصص
  function getTopSubject() {
    const schedule = user.data.schedule || {};
    const count = {};
    Object.values(schedule).forEach((v) => {
      if (v && v !== "-" && v !== "فراغ") count[v] = (count[v] || 0) + 1;
    });
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "—";
  }

  // أفضل يوم إنتاجية — من كل السجل
  function getBestDayName() {
    const dayTotal = [0, 0, 0, 0, 0, 0, 0]; // 0=أحد ... 6=سبت
    Object.entries(log).forEach(([k, v]) => {
      const day = new Date(k).getDay();
      dayTotal[day] += v;
    });
    const maxIdx = dayTotal.indexOf(Math.max(...dayTotal));
    return Math.max(...dayTotal) > 0
      ? [
          "الأحد",
          "الاثنين",
          "الثلاثاء",
          "الأربعاء",
          "الخميس",
          "الجمعة",
          "السبت",
        ][maxIdx]
      : "—";
  }

  // مقارنة أسبوعية
  function weekCompare() {
    if (prevSec === 0 && weekSec === 0) return "—";
    if (prevSec === 0) return "↑ جديد";
    const diff = weekSec - prevSec;
    const pct = Math.abs(Math.round((diff / prevSec) * 100));
    return diff >= 0 ? `↑ ${pct}%` : `↓ ${pct}%`;
  }

  document.getElementById("statWeekHours").textContent = fmtTime(weekSec);
  document.getElementById("statTodayHours").textContent = fmtTime(todaySec);
  document.getElementById("statBestDay").textContent =
    bestDay.seconds > 0 ? fmtTime(bestDay.seconds) : "—";
  document.getElementById("statTopSubject").textContent = getTopSubject();
  document.getElementById("statBestDayName").textContent = getBestDayName();
  const cmpEl = document.getElementById("statWeekVsPrev");
  const cmp = weekCompare();
  cmpEl.textContent = cmp;
  cmpEl.style.color = cmp.startsWith("↑")
    ? "var(--green)"
    : cmp.startsWith("↓")
      ? "var(--red)"
      : "var(--text)";

  // ===== رسم المنحنى =====
  const canvas = document.getElementById("statsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 0;
  const H = 160;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const PAD_L = 10,
    PAD_R = 10,
    PAD_T = 20,
    PAD_B = 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const n = 7;

  const maxSec = Math.max(...days14.map((d) => d.seconds), 1);

  // نقاط X لكل أسبوع
  function xOf(i) {
    return PAD_L + (i / (n - 1)) * chartW;
  }
  function yOf(sec) {
    return PAD_T + chartH - (sec / maxSec) * chartH;
  }

  // ---- خطوط شبكة أفقية خفيفة ----
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach((r) => {
    const y = PAD_T + chartH - r * chartH;
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(W - PAD_R, y);
    ctx.stroke();
  });

  // ---- رسم منحنى الأسبوع الماضي (متقطع، فاتح) ----
  function drawCurve(data, color, dash) {
    const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.seconds) }));
    ctx.beginPath();
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    pts.forEach((p, i) => {
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
        return;
      }
      const cp1x = (pts[i - 1].x + p.x) / 2;
      ctx.bezierCurveTo(cp1x, pts[i - 1].y, cp1x, p.y, p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // منطقة تحت منحنى هذا الأسبوع (gradient fill)
  function drawFill(data) {
    const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.seconds) }));
    const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH);
    grad.addColorStop(0, "rgba(59,130,246,0.18)");
    grad.addColorStop(1, "rgba(59,130,246,0)");
    ctx.beginPath();
    ctx.fillStyle = grad;
    pts.forEach((p, i) => {
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
        return;
      }
      const cp1x = (pts[i - 1].x + p.x) / 2;
      ctx.bezierCurveTo(cp1x, pts[i - 1].y, cp1x, p.y, p.x, p.y);
    });
    ctx.lineTo(xOf(n - 1), PAD_T + chartH);
    ctx.lineTo(xOf(0), PAD_T + chartH);
    ctx.closePath();
    ctx.fill();
  }

  drawFill(thisWeek);
  drawCurve(prevWeek, "rgba(255,255,255,0.18)", [4, 4]);
  drawCurve(thisWeek, "var(--blue)");

  // ---- نقاط على المنحنى + قيم ----
  thisWeek.forEach((d, i) => {
    const x = xOf(i),
      y = yOf(d.seconds);
    const isToday = i === 6;
    // نقطة
    ctx.beginPath();
    ctx.arc(x, y, isToday ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isToday ? "var(--blue)" : "rgba(59,130,246,0.7)";
    ctx.fill();
    if (isToday) {
      ctx.strokeStyle = "rgba(59,130,246,0.3)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    // قيمة فوق النقطة
    if (d.seconds > 0) {
      ctx.fillStyle = isToday ? "#93c5fd" : "rgba(255,255,255,0.5)";
      ctx.font = `${isToday ? "700" : "400"} 10px Tajawal, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        Math.floor(d.seconds / 60) + "د",
        x,
        Math.max(y - 10, PAD_T),
      );
    }
  });

  // ---- تسميات الأيام ----
  const labelsDiv = document.getElementById("chartDayLabels");
  if (labelsDiv) {
    labelsDiv.innerHTML = thisWeek
      .map(
        (d, i) =>
          `<span class="chart-day-lbl" style="${i === 6 ? "color:var(--blue);font-weight:700" : ""}">${d.label}</span>`,
      )
      .join("");
  }
}

// ============================================================
//  POMODORO
// ============================================================
function togglePomoSettings() {
  document.getElementById("pomoSettings").classList.toggle("open");
}

function savePomoSettings() {
  config.study = Math.max(
    1,
    parseInt(document.getElementById("studyInp").value) || 25,
  );
  config.break = Math.max(
    1,
    parseInt(document.getElementById("breakInp").value) || 5,
  );
  config.sessions = Math.max(
    1,
    parseInt(document.getElementById("sessionInp").value) || 4,
  );
  config.longBreak = Math.max(
    1,
    parseInt(document.getElementById("longBreakInp").value) || 20,
  );
  resetPomo();
  togglePomoSettings();
  toast("تم تحديث إعدادات الوقت ✓", "success");
}

// ── متغيرات الطابع الزمني للمؤقت (لضمان الدقة في الخلفية) ──
let _pomoStartTimestamp = null; // Date.now() عند بدء/استئناف المؤقت
let _pomoStartTimeLeft = 0; // timeLeft عند بدء/استئناف المؤقت
let _lastTickSecond = -1; // آخر ثانية تمت معالجتها (لتجنب التكرار)

function toggleTimer() {
  if (isRunning) {
    // إيقاف مؤقت — نحفظ الوقت المتبقي الحقيقي
    const elapsed = _pomoStartTimestamp
      ? Math.floor((Date.now() - _pomoStartTimestamp) / 1000)
      : 0;
    timeLeft = Math.max(0, _pomoStartTimeLeft - elapsed);
    clearInterval(timerInterval);
    _pomoStartTimestamp = null;
    document.getElementById("startBtn").textContent = "استئناف";
  } else {
    requestNotificationPermission();
    _pomoStartTimestamp = Date.now();
    _pomoStartTimeLeft = timeLeft;
    _lastTickSecond = -1;
    timerInterval = setInterval(tick, 250); // كل 250ms لدقة أفضل
    document.getElementById("startBtn").textContent = "توقف مؤقت";
  }
  isRunning = !isRunning;
}

function tick() {
  if (!_pomoStartTimestamp) return;

  // حساب الوقت المنقضي بدقة عبر الطابع الزمني
  const elapsed = Math.floor((Date.now() - _pomoStartTimestamp) / 1000);
  const newTimeLeft = Math.max(0, _pomoStartTimeLeft - elapsed);

  // نعالج كل ثانية مرة واحدة فقط
  const currentSecond = elapsed;
  if (currentSecond === _lastTickSecond) return;
  _lastTickSecond = currentSecond;

  timeLeft = newTimeLeft;
  updateTimerDisplay();

  if (newTimeLeft > 0) {
    // تسجيل ثانية دراسة
    if (pomoMode === "study" && user) {
      const today = new Date().toISOString().slice(0, 10);
      if (!user.data.studyLog) user.data.studyLog = {};
      user.data.studyLog[today] = (user.data.studyLog[today] || 0) + 1;

      // تحديث إجمالي الدراسة كل ثانية
      if (!user.data.totalPomoSec) user.data.totalPomoSec = 0;
      user.data.totalPomoSec += 1;

      // حفظ كل دقيقة وتحديث الواجهة
      if (elapsed % 60 === 0) {
        saveUser();
        renderStats();
      } else {
        // تحديث العرض في الهيدر كل 10 ثواني دون حفظ للخادم
        if (elapsed % 10 === 0) updateDashHeader();
      }
    }
  } else {
    // انتهى الوقت — نبقي isRunning=true حتى يبدأ الوضع التالي تلقائياً
    clearInterval(timerInterval);
    _pomoStartTimestamp = null;
    handleModeSwitch();
  }
}

// ── Page Visibility API: إعادة مزامنة المؤقت عند العودة للتبويب ──
document.addEventListener("visibilitychange", function () {
  if (
    document.visibilityState === "visible" &&
    isRunning &&
    _pomoStartTimestamp
  ) {
    // المؤقت كان يعمل — إعادة حساب الوقت المنقضي فعلياً
    const elapsed = Math.floor((Date.now() - _pomoStartTimestamp) / 1000);
    const newTimeLeft = Math.max(0, _pomoStartTimeLeft - elapsed);

    if (newTimeLeft === 0) {
      // انتهى الوقت بينما كان التبويب مخفياً
      clearInterval(timerInterval);
      _pomoStartTimestamp = null;

      // تسجيل الثواني الفائتة في studyLog
      if (pomoMode === "study" && user) {
        const secondsMissed = _pomoStartTimeLeft - timeLeft;
        if (secondsMissed > 0) {
          const today = new Date().toISOString().slice(0, 10);
          if (!user.data.studyLog) user.data.studyLog = {};
          user.data.studyLog[today] =
            (user.data.studyLog[today] || 0) + secondsMissed;
          if (!user.data.totalPomoSec) user.data.totalPomoSec = 0;
          user.data.totalPomoSec += secondsMissed;
        }
      }

      // نبقي isRunning=true حتى يبدأ الوضع التالي تلقائياً
      timeLeft = 0;
      updateTimerDisplay();
      handleModeSwitch();
    } else {
      // تسجيل الثواني التي فاتت أثناء الخلفية
      if (pomoMode === "study" && user) {
        const secondsMissed =
          elapsed - (_lastTickSecond >= 0 ? _lastTickSecond : 0);
        if (secondsMissed > 0) {
          const today = new Date().toISOString().slice(0, 10);
          if (!user.data.studyLog) user.data.studyLog = {};
          user.data.studyLog[today] =
            (user.data.studyLog[today] || 0) + secondsMissed;
          if (!user.data.totalPomoSec) user.data.totalPomoSec = 0;
          user.data.totalPomoSec += secondsMissed;
          saveUser();
          renderStats();
        }
      }
      timeLeft = newTimeLeft;
      updateTimerDisplay();
    }
  }
});

function handleModeSwitch() {
  playChime();
  // اهتزاز على الجوال
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (pomoMode === "study") {
    // ملاحظة: totalPomoSec يُحسب الآن كل ثانية في tick() — لا نضيف هنا مجدداً
    saveUser();
    renderStats();
    if (currentSession < config.sessions) {
      pomoMode = "shortBreak";
      timeLeft = config.break * 60;
      document.getElementById("pomoLabel").textContent = "استراحة قصيرة 🥤";
      toast("وقت استراحة قصيرة! استرح قليلاً ☕", "info");
      sendPomoNotification(
        "⏸️ استراحة قصيرة!",
        "أحسنت! خذ استراحة قصيرة قبل العودة للدراسة ☕",
      );
    } else {
      pomoMode = "longBreak";
      timeLeft = config.longBreak * 60;
      document.getElementById("pomoLabel").textContent = "استراحة طويلة ✨";
      toast("أحسنت! وقت الاستراحة الطويلة 🌟", "success");
      sendPomoNotification(
        "🎉 انتهت الدورة!",
        "أحسنت! استحققت استراحة طويلة. ارتاح جيداً 🌟",
      );
    }
  } else if (pomoMode === "shortBreak") {
    currentSession++;
    pomoMode = "study";
    timeLeft = config.study * 60;
    document.getElementById("pomoLabel").textContent = "جلسة تركيز 🎯";
    toast("عد للدراسة! يمكنك ذلك 💪", "info");
    sendPomoNotification(
      "🎯 عودة للدراسة!",
      "انتهت الاستراحة — حان وقت التركيز 💪",
    );
  } else {
    currentSession = 1;
    pomoMode = "study";
    timeLeft = config.study * 60;
    document.getElementById("pomoLabel").textContent = "جلسة تركيز 🎯";
    toast("دورة جديدة بدأت! 🚀", "success");
    sendPomoNotification(
      "🚀 دورة جديدة!",
      "استراحتك انتهت — دورة جديدة بدأت، يمكنك ذلك!",
    );
  }
  updateModeIndicator();
  updateDots();
  updateTimerDisplay();

  // تشغيل الوضع التالي تلقائياً دون توقف
  clearInterval(timerInterval);
  isRunning = true;
  _pomoStartTimestamp = Date.now();
  _pomoStartTimeLeft = timeLeft;
  _lastTickSecond = -1;
  timerInterval = setInterval(tick, 250);
  document.getElementById("startBtn").textContent = "توقف مؤقت";
}

function updateModeIndicator() {
  const isStudy = pomoMode === "study";
  document.getElementById("modeStudy").style.background = isStudy
    ? "var(--blue)"
    : "rgba(255,255,255,0.1)";
  document.getElementById("modeBreak").style.background = !isStudy
    ? "var(--green)"
    : "rgba(255,255,255,0.1)";
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60),
    s = timeLeft % 60;
  document.getElementById("pomoTimer").textContent =
    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resetPomo() {
  clearInterval(timerInterval);
  _pomoStartTimestamp = null;
  _pomoStartTimeLeft = 0;
  _lastTickSecond = -1;
  isRunning = false;
  pomoMode = "study";
  currentSession = 1;
  timeLeft = config.study * 60;
  updateTimerDisplay();
  updateDots();
  updateModeIndicator();
  document.getElementById("startBtn").textContent = "ابدأ الآن";
  document.getElementById("pomoLabel").textContent = "جلسة دراسة";
}

function updateDots() {
  const c = document.getElementById("sessionDots");
  c.innerHTML = "";
  for (let i = 1; i <= config.sessions; i++) {
    const d = document.createElement("div");
    d.style.cssText = `width:10px;height:10px;border-radius:50%;transition:all 0.4s;background:${i < currentSession ? "var(--green)" : i === currentSession ? "var(--blue)" : "rgba(255,255,255,0.12)"};${i === currentSession ? "box-shadow:0 0 10px rgba(59,130,246,0.5);transform:scale(1.2);" : ""}`;
    c.appendChild(d);
  }
}

// ============================================================
//  WEB NOTIFICATIONS (بومودورو)
// ============================================================
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendPomoNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body: body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍅</text></svg>",
      });
    } catch {}
  }
}

function playChime() {
  // وميض بصري على الشاشة عند انتهاء الوقت
  const flash = document.createElement("div");
  flash.style.cssText =
    "position:fixed;inset:0;z-index:9999;pointer-events:none;background:rgba(59,130,246,0.18);animation:pomoFlash 0.7s ease-out forwards;";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 750);
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch {}
}

// ============================================================
//  CHILL SOUNDS
// ============================================================
const SOUND_FILES = {
  rain: "rain.mp3",
  forest: "forest.mp3",
  cafe: "cafe.mp3",
};

function toggleChill(type) {
  const btn = document.getElementById(type + "Btn");

  if (chillSounds[type]) {
    const snd = chillSounds[type];
    if (snd.audio) {
      snd.audio.pause();
      snd.audio.currentTime = 0;
    } else if (snd.gain) {
      try {
        snd.gain.gain.linearRampToValueAtTime(
          0,
          getAudioCtx().currentTime + 0.4,
        );
      } catch {}
      setTimeout(() => {
        try {
          snd.source.stop();
        } catch {}
      }, 450);
    }
    delete chillSounds[type];
    btn.classList.remove("active");
    return;
  }

  const audio = new Audio(SOUND_FILES[type]);
  audio.loop = true;
  audio.volume = 0;

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        chillSounds[type] = { audio };
        btn.classList.add("active");
        let vol = 0;
        const fadeIn = setInterval(() => {
          vol = Math.min(vol + 0.05, 0.75);
          audio.volume = vol;
          if (vol >= 0.75) clearInterval(fadeIn);
        }, 60);
      })
      .catch(() => {
        audio.pause();
        chillWebAudio(type, btn);
      });
  } else {
    chillWebAudio(type, btn);
  }
}

function chillWebAudio(type, btn) {
  const ctx = getAudioCtx();
  const bufSz = 3 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, bufSz, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSz; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.loop = true;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  const entry = { source, gain };

  if (type === "rain") {
    filter.type = "bandpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.4;
    source.connect(filter);
    filter.connect(gain);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1.2);
  } else if (type === "forest") {
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 1.2;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfoG.gain.value = 250;
    lfo.frequency.value = 0.25;
    lfo.connect(lfoG);
    lfoG.connect(filter.frequency);
    lfo.start();
    source.connect(filter);
    filter.connect(gain);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 1.2);
    entry.lfo = lfo;
  } else {
    filter.type = "lowpass";
    filter.frequency.value = 400;
    let last = 0;
    for (let i = 0; i < bufSz; i++) {
      last = (last + 0.02 * data[i]) / 1.02;
      data[i] = last * 3.5;
    }
    source.connect(filter);
    filter.connect(gain);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.2);
  }

  gain.connect(ctx.destination);
  source.start();
  chillSounds[type] = entry;
  btn.classList.add("active");
  toast(
    `صوت الـ${type === "rain" ? "مطر" : type === "forest" ? "غابة" : "مقهى"} (محاكاة) — ضع ملف ${SOUND_FILES[type]} للصوت الأصلي`,
    "info",
  );
}

// ============================================================
//  CANVAS STARFIELD BACKGROUND
// ============================================================
const canvas = document.getElementById("starsCanvas");
const ctx = canvas.getContext("2d");
let stars = [];

function initStars() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  stars = [];

  createStars(350, 1.0, 0.18, 0.4);
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
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height,
    0,
    canvas.width / 2,
    canvas.height,
    canvas.height,
  );
  gradient.addColorStop(0, "#1a3a6e");
  gradient.addColorStop(0.4, "#0a1428");
  gradient.addColorStop(1, "#050810");

  ctx.fillStyle = gradient;
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

// ============================================================
//  SECTION NAV — scroll spy + smooth scroll
// ============================================================
(function () {
  var SECTIONS = [
    { id: "sec-schedule", btnId: "snav-schedule" },
    { id: "sec-tasks", btnId: "snav-tasks" },
    { id: "sec-notes", btnId: "snav-notes" },
    { id: "sec-stats", btnId: "snav-stats" },
    { id: "sec-grades", btnId: "snav-grades" },
    { id: "sec-exams", btnId: "snav-exams" },
    { id: "sec-resources", btnId: "snav-resources" },
  ];

  function scrollToSection(sectionId) {
    var el = document.getElementById(sectionId);
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: top, behavior: "smooth" });
  }
  window.scrollToSection = scrollToSection;

  function updateActiveNav() {
    var winH = window.innerHeight;
    var active = SECTIONS[0].btnId;
    SECTIONS.forEach(function (s) {
      var el = document.getElementById(s.id);
      if (!el) return;
      if (el.getBoundingClientRect().top <= winH * 0.45) active = s.btnId;
    });
    SECTIONS.forEach(function (s) {
      var btn = document.getElementById(s.btnId);
      if (btn) btn.classList.toggle("snav-active", s.btnId === active);
    });
  }

  var attached = false;
  function attachScrollSpy() {
    if (attached) return;
    attached = true;
    window.addEventListener("scroll", updateActiveNav, { passive: true });
    updateActiveNav();
    var nav = document.getElementById("sectionNav");
    if (nav) nav.classList.add("visible");
  }
  function hideNav() {
    var nav = document.getElementById("sectionNav");
    if (nav) nav.classList.remove("visible");
    attached = false;
    window.removeEventListener("scroll", updateActiveNav);
  }

  window._navAttach = attachScrollSpy;
  window._navHide = hideNav;
})();

// ============================================================
//  EXPORT SCHEDULE — PNG & PDF (pure Canvas, no html2canvas)
// ============================================================
function exportSchedule(format) {
  if (!user) return;

  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const timeSlots = [
    "08-09",
    "09-10",
    "10-11",
    "11-12",
    "استراحة",
    "14-15",
    "15-16",
    "16-17",
  ];
  const tabLabel =
    currentTab === "schedule" ? "الجدول الدراسي" : "مواعيد الفروض";

  // ---- أبعاد الـ Canvas ----
  const DPR = 2; // دقة مضاعفة للحصول على صورة واضحة
  const COL_DAY = 100; // عرض عمود اليوم
  const COL_BREAK = 52; // عمود الاستراحة أضيق
  const COL_W = 108; // عرض الأعمدة العادية
  const ROW_H = 52; // ارتفاع كل صف
  const HEADER_H = 48; // رأس الجدول
  const TITLE_H = 54; // صف العنوان
  const PADDING = 24; // padding حول الجدول
  const FOOT_H = 32; // تذييل

  const totalCols = [
    COL_DAY,
    COL_W,
    COL_W,
    COL_W,
    COL_W,
    COL_BREAK,
    COL_W,
    COL_W,
    COL_W,
  ];
  const tableW = totalCols.reduce((a, b) => a + b, 0);
  const canvasW = tableW + PADDING * 2;
  const canvasH =
    TITLE_H + HEADER_H + days.length * ROW_H + FOOT_H + PADDING * 2;

  const cv = document.createElement("canvas");
  cv.width = canvasW * DPR;
  cv.height = canvasH * DPR;
  const ctx = cv.getContext("2d");
  ctx.scale(DPR, DPR);

  // ---- ألوان ----
  const C = {
    bg: "#0d1424",
    surface: "#111827",
    border: "rgba(255,255,255,0.08)",
    text: "#f1f5f9",
    muted: "#64748b",
    cyan: "#06b6d4",
    blue: "#3b82f6",
    blueLight: "rgba(59,130,246,0.15)",
    amber: "#f59e0b",
    green: "#10b981",
    breakBg: "rgba(0,0,0,0.35)",
    dayBg: "rgba(6,182,212,0.08)",
    headerBg: "rgba(255,255,255,0.03)",
    subjectColors: {
      رياضيات: { bg: "rgba(59,130,246,0.18)", text: "#93c5fd" },
      فيزياء: { bg: "rgba(168,85,247,0.18)", text: "#d8b4fe" },
      علوم: { bg: "rgba(16,185,129,0.18)", text: "#6ee7b7" },
      عربية: { bg: "rgba(245,158,11,0.18)", text: "#fcd34d" },
      فرنسية: { bg: "rgba(239,68,68,0.18)", text: "#fca5a5" },
      إنجليزية: { bg: "rgba(14,165,233,0.18)", text: "#7dd3fc" },
      "تاريخ/جغرافيا": { bg: "rgba(234,88,12,0.18)", text: "#fdba74" },
      فلسفة: { bg: "rgba(99,102,241,0.18)", text: "#c7d2fe" },
      إسلامية: { bg: "rgba(20,184,166,0.18)", text: "#99f6e4" },
      "إعلام آلي": { bg: "rgba(6,182,212,0.18)", text: "#67e8f9" },
      تكنلوجيا: { bg: "rgba(251,191,36,0.18)", text: "#fde68a" },
    },
  };

  // ---- helpers ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function colX(colIdx) {
    let x = PADDING;
    for (let i = 0; i < colIdx; i++) x += totalCols[i];
    return x;
  }

  function drawTextRTL(text, cx, cy, maxW) {
    // قياس النص وتصغيره إذا تجاوز العرض
    let size = 12;
    ctx.font = `600 ${size}px Tajawal, Arial`;
    while (ctx.measureText(text).width > maxW - 8 && size > 8) {
      size--;
      ctx.font = `600 ${size}px Tajawal, Arial`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
  }

  // ---- خلفية الصورة ----
  ctx.fillStyle = C.bg;
  roundRect(0, 0, canvasW, canvasH, 16);
  ctx.fill();

  // ---- إطار خارجي ----
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  roundRect(PADDING / 2, PADDING / 2, canvasW - PADDING, canvasH - PADDING, 14);
  ctx.stroke();

  // ---- العنوان ----
  const titleY = PADDING + TITLE_H / 2;
  ctx.fillStyle = C.blue;
  ctx.font = `900 20px Cairo, Arial`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(`📅 ${tabLabel}`, canvasW - PADDING - 12, titleY);

  // اسم الطالب والمدرسة يسار العنوان
  ctx.fillStyle = C.muted;
  ctx.font = "400 11px Tajawal, Arial";
  ctx.textAlign = "left";
  ctx.fillText(`${user.name} — ${user.school}`, PADDING + 12, titleY - 6);

  // التاريخ
  const dateStr = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "400 10px Tajawal, Arial";
  ctx.fillText(dateStr, PADDING + 12, titleY + 8);

  // خط فاصل تحت العنوان
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, PADDING + TITLE_H);
  ctx.lineTo(canvasW - PADDING, PADDING + TITLE_H);
  ctx.stroke();

  // ---- رأس الجدول ----
  const hdrY = PADDING + TITLE_H;
  timeSlots.forEach((label, i) => {
    const ci = i + 1; // col index (0 = day col)
    const x = colX(ci);
    const w = totalCols[ci];
    const cx = x + w / 2;
    const cy = hdrY + HEADER_H / 2;

    // خلفية الهيدر
    ctx.fillStyle = i === 4 ? C.breakBg : C.headerBg;
    ctx.fillRect(x, hdrY, w, HEADER_H);

    // نص
    ctx.fillStyle = i === 4 ? C.muted : C.muted;
    ctx.font = `600 ${i === 4 ? 10 : 11}px Tajawal, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);
  });

  // خلفية عمود اليوم في الهيدر
  ctx.fillStyle = C.dayBg;
  ctx.fillRect(colX(0), hdrY, totalCols[0], HEADER_H);
  ctx.fillStyle = C.muted;
  ctx.font = "600 11px Tajawal, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("اليوم", colX(0) + totalCols[0] / 2, hdrY + HEADER_H / 2);

  // ---- صفوف الأيام ----
  days.forEach((day, dIdx) => {
    const rowY = hdrY + HEADER_H + dIdx * ROW_H;
    const rowBg = dIdx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent";

    // خلفية الصف
    ctx.fillStyle = rowBg;
    ctx.fillRect(PADDING, rowY, tableW, ROW_H);

    // خلية اليوم
    ctx.fillStyle = C.dayBg;
    ctx.fillRect(colX(0), rowY, totalCols[0], ROW_H);
    ctx.fillStyle = C.cyan;
    ctx.font = "700 12px Tajawal, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(day, colX(0) + totalCols[0] / 2, rowY + ROW_H / 2);

    // خلايا الحصص
    for (let i = 0; i < 8; i++) {
      const ci = i + 1;
      const x = colX(ci);
      const w = totalCols[ci];
      const cy = rowY + ROW_H / 2;
      const cx = x + w / 2;

      if (i === 4) {
        // استراحة
        ctx.fillStyle = C.breakBg;
        ctx.fillRect(x, rowY, w, ROW_H);
        ctx.fillStyle = C.muted;
        ctx.font = "400 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("☕", cx, cy);
        continue;
      }

      // بيانات الخلية
      const slotIdx = i;
      const key = `${currentTab}_${dIdx}_${slotIdx}`;
      const practKey = `practical_${dIdx}_${slotIdx}`;
      const practData = user.data.practicalSessions?.[practKey];
      let cellText = "";
      let isCyan = false;
      let isPract = false;

      if (practData && currentTab === "schedule") {
        cellText = `${practData.sub1} / ${practData.sub2}`;
        isCyan = true;
        isPract = true;
      } else {
        cellText = user.data[currentTab]?.[key] || "";
      }

      if (!cellText || cellText === "-") {
        // خلية فارغة — خط خفيف
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        ctx.fillRect(x + 2, rowY + 2, w - 4, ROW_H - 4);
      } else {
        // خلية بمحتوى — خلفية ملونة بـ pill صغير
        const pair = C.subjectColors[cellText.split(" / ")[0]] || {
          bg: "rgba(255,255,255,0.08)",
          text: "#cbd5e1",
        };
        const bgC = isPract ? "rgba(6,182,212,0.10)" : pair.bg;
        const txC = isPract ? C.cyan : pair.text;

        // الـ pill
        ctx.fillStyle = bgC;
        roundRect(x + 4, rowY + 6, w - 8, ROW_H - 12, 7);
        ctx.fill();

        // نص الخلية
        ctx.fillStyle = txC;
        drawTextRTL(cellText, cx, cy, w);
      }
    }

    // خط سفلي للصف
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, rowY + ROW_H);
    ctx.lineTo(canvasW - PADDING, rowY + ROW_H);
    ctx.stroke();
  });

  // ---- خطوط عمودية للجدول ----
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let ci = 0; ci <= totalCols.length; ci++) {
    const x = colX(ci);
    ctx.beginPath();
    ctx.moveTo(x, hdrY);
    ctx.lineTo(x, hdrY + HEADER_H + days.length * ROW_H);
    ctx.stroke();
  }

  // ---- التذييل ----
  const footY = canvasH - PADDING - FOOT_H / 2;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = "400 10px Tajawal, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("منصة دراسة • تم التصدير بتاريخ " + dateStr, canvasW / 2, footY);

  // ---- التصدير ----
  const fileName = `جدول-${user.name}-${currentTab === "schedule" ? "حصص" : "فروض"}`;

  if (format === "png") {
    cv.toBlob(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
    toast("✓ تم تصدير الجدول كصورة PNG", "success");
  } else if (format === "pdf") {
    if (
      typeof window.jspdf === "undefined" &&
      typeof window.jsPDF === "undefined"
    ) {
      toast("⚠️ مكتبة PDF لم تُحمَّل بعد، حاول مرة أخرى", "error");
      return;
    }
    const { jsPDF } = window.jspdf || window;
    const imgData = cv.toDataURL("image/png");
    const pxToMm = 0.264583;
    const pdfW = canvasW * pxToMm;
    const pdfH = canvasH * pxToMm;
    const doc = new jsPDF({
      orientation: pdfW > pdfH ? "landscape" : "portrait",
      unit: "mm",
      format: [pdfW, pdfH],
    });
    doc.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    doc.save(fileName + ".pdf");
    toast("✓ تم تصدير الجدول كملف PDF", "success");
  }
}

// ============================================================
//  EXPORT / IMPORT — نسخة احتياطية شاملة JSON
// ============================================================
function exportAllData() {
  if (!user) return;
  const backup = {
    exportedAt: new Date().toISOString(),
    version: "2.0",
    user: {
      name: user.name,
      email: user.email,
      school: user.school,
      data: user.data,
    },
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_${user.name}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("✓ تم تصدير النسخة الاحتياطية بنجاح", "success");
}

function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.user || !backup.user.data) {
        return toast("❌ الملف غير صالح", "error");
      }
      confirmAction(
        "سيتم استيراد البيانات واستبدال بياناتك الحالية. هل أنت متأكد؟",
        async function () {
          const importedData = backup.user.data;
          user.data = importedData;
          if (!user.data.practicalSessions) user.data.practicalSessions = {};
          if (!user.data.studyLog) user.data.studyLog = {};
          if (!user.data.grades) user.data.grades = [];
          if (!user.data.theme) user.data.theme = "blue";
          if (!user.data.examsCountdown) user.data.examsCountdown = [];
          if (!user.data.resources) user.data.resources = [];
          await saveUser();
          toast("✓ تم استيراد البيانات بنجاح! إعادة تحميل...", "success");
          setTimeout(() => window.location.reload(), 1200);
        },
      );
    } catch {
      toast("❌ حدث خطأ أثناء قراءة الملف", "error");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

// ============================================================
//  THEME
// ============================================================
const themes = {
  blue: {
    blue: "#3b82f6",
    blueGlow: "rgba(59,130,246,0.2)",
    cyan: "#06b6d4",
  },
  purple: {
    blue: "#8b5cf6",
    blueGlow: "rgba(139,92,246,0.2)",
    cyan: "#a78bfa",
  },
  green: {
    blue: "#10b981",
    blueGlow: "rgba(16,185,129,0.2)",
    cyan: "#34d399",
  },
  rose: {
    blue: "#f43f5e",
    blueGlow: "rgba(244,63,94,0.2)",
    cyan: "#fb7185",
  },
  amber: {
    blue: "#f59e0b",
    blueGlow: "rgba(245,158,11,0.2)",
    cyan: "#fbbf24",
  },
};

function applyTheme(name) {
  const t = themes[name] || themes.blue;
  document.documentElement.style.setProperty("--blue", t.blue);
  document.documentElement.style.setProperty("--blue-glow", t.blueGlow);
  document.documentElement.style.setProperty("--cyan", t.cyan);
  if (user) {
    user.data.theme = name;
    saveUser();
  }
  document.querySelectorAll(".theme-dot").forEach(function (d) {
    d.style.outline = d.dataset.theme === name ? "3px solid " + t.blue : "none";
    d.style.outlineOffset = "2px";
  });
}

// ============================================================
//  GRADES
// ============================================================
function renderGrades() {
  var sel = document.getElementById("gradeSubject");
  if (sel && sel.options.length === 1) {
    subjects
      .filter(function (s) {
        return s !== "فراغ";
      })
      .forEach(function (s) {
        var o = document.createElement("option");
        o.value = s;
        o.textContent = s;
        sel.appendChild(o);
      });
  }

  var container = document.getElementById("gradeCards");
  if (!container) return;
  var grades = user.data.grades || [];

  if (grades.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg><p>لا توجد درجات مسجلة بعد<br>أضف أول نتيجة!</p></div>';
    return;
  }

  // تجميع بالمادة
  var bySubject = {};
  grades.forEach(function (g, idx) {
    if (!bySubject[g.subject]) bySubject[g.subject] = [];
    bySubject[g.subject].push(Object.assign({}, g, { idx: idx }));
  });

  // حساب المعدل العام
  var allAvg = grades.length
    ? grades.reduce(function (s, g) {
        return s + (g.score / g.max) * 20;
      }, 0) / grades.length
    : 0;

  // إيجاد المادة الأضعف
  var subAvgs = Object.keys(bySubject).map(function (sub) {
    var arr = bySubject[sub];
    return {
      sub: sub,
      avg:
        arr.reduce(function (s, g) {
          return s + (g.score / g.max) * 20;
        }, 0) / arr.length,
    };
  });
  var weakest = subAvgs.length
    ? subAvgs.reduce(function (a, b) {
        return a.avg < b.avg ? a : b;
      })
    : null;

  // بطاقة الملخص
  var html =
    '<div style="grid-column:1/-1; background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.2); border-radius:16px; padding:18px 22px; display:flex; flex-wrap:wrap; gap:24px; align-items:center;">' +
    '<div style="text-align:center;">' +
    "<div style=\"font-family:'Cairo',sans-serif; font-size:28px; font-weight:900; color:" +
    (allAvg >= 10 ? "var(--green)" : "var(--red)") +
    ';">' +
    allAvg.toFixed(2) +
    "</div>" +
    '<div style="font-size:11px; color:var(--muted); font-weight:600; margin-top:2px;">المعدل العام / 20</div>' +
    "</div>";
  if (weakest) {
    html +=
      '<div style="text-align:center;">' +
      "<div style=\"font-family:'Cairo',sans-serif; font-size:18px; font-weight:700; color:var(--amber);\">" +
      escHtml(weakest.sub) +
      "</div>" +
      '<div style="font-size:11px; color:var(--muted); font-weight:600; margin-top:2px;">تحتاج تركيز ⚠️</div>' +
      "</div>";
  }
  html +=
    '<div style="text-align:center; margin-right:auto;">' +
    "<div style=\"font-family:'Cairo',sans-serif; font-size:22px; font-weight:700; color:var(--text);\">" +
    grades.length +
    "</div>" +
    '<div style="font-size:11px; color:var(--muted); font-weight:600; margin-top:2px;">إجمالي النتائج</div>' +
    "</div></div>";

  // بطاقة لكل مادة
  Object.keys(bySubject).forEach(function (sub) {
    var arr = bySubject[sub];
    var avg =
      arr.reduce(function (s, g) {
        return s + (g.score / g.max) * 20;
      }, 0) / arr.length;
    var pct = (avg / 20) * 100;
    var color =
      avg >= 14 ? "var(--green)" : avg >= 10 ? "var(--amber)" : "var(--red)";
    html +=
      '<div class="card" style="padding:18px 20px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
      '<span style="font-weight:700; font-size:15px;">' +
      escHtml(sub) +
      "</span>" +
      "<span style=\"font-family:'Cairo',sans-serif; font-size:20px; font-weight:900; color:" +
      color +
      ';">' +
      avg.toFixed(2) +
      "/20</span>" +
      "</div>" +
      '<div class="progress-track" style="margin-bottom:14px;"><div class="progress-fill" style="width:' +
      pct +
      "%; background:" +
      color +
      ';"></div></div>' +
      '<div style="display:flex; flex-direction:column; gap:6px;">';
    arr.forEach(function (g) {
      var gc = (g.score / g.max) * 20 >= 10 ? "var(--green)" : "var(--red)";
      html +=
        '<div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:6px 10px; background:rgba(255,255,255,0.03); border-radius:8px;">' +
        '<span style="color:var(--muted);">' +
        escHtml(g.label || "نتيجة") +
        "</span>" +
        '<div style="display:flex; align-items:center; gap:10px;">' +
        '<span style="font-weight:700; color:' +
        gc +
        ';">' +
        g.score +
        "/" +
        g.max +
        "</span>" +
        '<button onclick="removeGrade(' +
        g.idx +
        ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 6px;opacity:0.6;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">✕</button>' +
        "</div></div>";
    });
    html += "</div></div>";
  });

  container.innerHTML = html;
}

function addGrade() {
  var subject = document.getElementById("gradeSubject").value;
  var score = parseFloat(document.getElementById("gradeScore").value);
  var max = parseFloat(document.getElementById("gradeMax").value) || 20;
  var label = document.getElementById("gradeLabel").value.trim() || "نتيجة";

  if (!subject) return toast("اختر المادة", "error");
  if (isNaN(score) || score < 0 || score > max)
    return toast("الدرجة غير صحيحة", "error");

  user.data.grades.push({
    subject: subject,
    score: score,
    max: max,
    label: label,
    date: formatNow(),
  });
  saveUser();
  document.getElementById("gradeScore").value = "";
  document.getElementById("gradeLabel").value = "";
  renderGrades();
  toast("✓ تمت إضافة النتيجة", "success");
}

function removeGrade(idx) {
  confirmAction("حذف هذه النتيجة؟ لا يمكن التراجع.", function () {
    user.data.grades.splice(idx, 1);
    saveUser();
    renderGrades();
  });
}

// ============================================================
//  EXAMS COUNTDOWN
// ============================================================
function renderExams() {
  var sel = document.getElementById("examSubject");
  if (sel && sel.options.length === 1) {
    subjects
      .filter(function (s) {
        return s !== "فراغ";
      })
      .forEach(function (s) {
        var o = document.createElement("option");
        o.value = s;
        o.textContent = s;
        sel.appendChild(o);
      });
  }
  // تعيين الحد الأدنى لتاريخ اليوم
  var dateInp = document.getElementById("examDate");
  if (dateInp && !dateInp.min) {
    dateInp.min = new Date().toISOString().slice(0, 10);
  }

  var container = document.getElementById("examCards");
  if (!container) return;
  var exams = user.data.examsCountdown || [];

  // ترتيب تصاعدي بالتاريخ
  var sorted = exams
    .map(function (e, i) {
      return Object.assign({}, e, { idx: i });
    })
    .sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });

  if (sorted.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><p>لا توجد فروض مسجلة بعد<br>أضف أول موعد!</p></div>';
    return;
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  container.innerHTML = sorted
    .map(function (e) {
      var examDay = new Date(e.date);
      examDay.setHours(0, 0, 0, 0);
      var diff = Math.round((examDay - today) / (1000 * 60 * 60 * 24));
      var badge, badgeColor, cardBorder;
      if (diff < 0) {
        badge = "انتهى";
        badgeColor = "var(--muted)";
        cardBorder = "rgba(255,255,255,0.06)";
      } else if (diff === 0) {
        badge = "اليوم! 🔥";
        badgeColor = "var(--red)";
        cardBorder = "rgba(244,63,94,0.4)";
      } else if (diff <= 3) {
        badge = "باقي " + diff + " أيام ⚠️";
        badgeColor = "var(--amber)";
        cardBorder = "rgba(245,158,11,0.35)";
      } else if (diff <= 7) {
        badge = "باقي " + diff + " أيام";
        badgeColor = "var(--blue)";
        cardBorder = "rgba(59,130,246,0.3)";
      } else {
        badge = "باقي " + diff + " يوم";
        badgeColor = "var(--green)";
        cardBorder = "rgba(16,185,129,0.25)";
      }
      var dateStr = new Date(e.date).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return (
        '<div style="background:rgba(255,255,255,0.02); border:1px solid ' +
        cardBorder +
        '; border-radius:16px; padding:18px 20px; display:flex; flex-direction:column; gap:10px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">' +
        "<div>" +
        '<div style="font-weight:700; font-size:15px; margin-bottom:4px;">' +
        escHtml(e.label) +
        "</div>" +
        '<div style="font-size:12px; color:var(--muted);">' +
        escHtml(e.subject) +
        "</div>" +
        "</div>" +
        '<button onclick="removeExam(' +
        e.idx +
        ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:2px 6px;flex-shrink:0;" onmouseover="this.style.color=\'var(--red)\'" onmouseout="this.style.color=\'var(--muted)\'">✕</button>' +
        "</div>" +
        "<div style=\"font-family:'Cairo',sans-serif; font-size:22px; font-weight:900; color:" +
        badgeColor +
        ';">' +
        badge +
        "</div>" +
        '<div style="font-size:11px; color:var(--muted);">' +
        dateStr +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function addExamCountdown() {
  var subject = document.getElementById("examSubject").value;
  var label = document.getElementById("examLabel").value.trim();
  var date = document.getElementById("examDate").value;

  if (!subject) return toast("اختر المادة", "error");
  if (!label) return toast("أدخل اسم الفرض", "error");
  if (!date) return toast("اختر التاريخ", "error");

  user.data.examsCountdown.push({
    subject: subject,
    label: label,
    date: date,
  });
  saveUser();
  document.getElementById("examLabel").value = "";
  document.getElementById("examDate").value = "";
  renderExams();
  toast("✓ تمت إضافة الموعد", "success");
}

function removeExam(idx) {
  confirmAction("حذف هذا الموعد؟", function () {
    user.data.examsCountdown.splice(idx, 1);
    saveUser();
    renderExams();
  });
}

// ============================================================
//  RESOURCES
// ============================================================
function renderResources() {
  var sel = document.getElementById("resSubject");
  if (sel && sel.options.length === 1) {
    subjects
      .filter(function (s) {
        return s !== "فراغ";
      })
      .forEach(function (s) {
        var o = document.createElement("option");
        o.value = s;
        o.textContent = s;
        sel.appendChild(o);
      });
  }

  var container = document.getElementById("resourceList");
  if (!container) return;
  var resources = user.data.resources || [];

  if (resources.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg><p>لا توجد موارد مضافة بعد<br>أضف أول رابط!</p></div>';
    return;
  }

  // تجميع بالمادة
  var bySubject = {};
  resources.forEach(function (r, i) {
    if (!bySubject[r.subject]) bySubject[r.subject] = [];
    bySubject[r.subject].push(Object.assign({}, r, { idx: i }));
  });

  function getIcon(url) {
    if (!url) return "🔗";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "▶️";
    if (url.includes(".pdf")) return "📄";
    if (url.includes("drive.google.com")) return "📁";
    if (url.includes("docs.google.com")) return "📝";
    return "🔗";
  }

  var html = "";
  Object.keys(bySubject).forEach(function (sub) {
    var arr = bySubject[sub];
    html +=
      '<div style="margin-bottom:20px;">' +
      '<div style="font-size:13px; font-weight:700; color:var(--cyan); margin-bottom:10px; display:flex; align-items:center; gap:6px;">' +
      '<span style="width:6px;height:6px;border-radius:50%;background:var(--cyan);display:inline-block;"></span>' +
      escHtml(sub) +
      ' <span style="color:var(--muted); font-weight:400;">(' +
      arr.length +
      ")</span>" +
      "</div>" +
      '<div style="display:flex; flex-direction:column; gap:8px;">';
    arr.forEach(function (r) {
      html +=
        '<div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
        '<span style="font-size:18px; flex-shrink:0;">' +
        getIcon(r.url) +
        "</span>" +
        '<a href="' +
        escHtml(r.url) +
        '" target="_blank" rel="noopener noreferrer" style="flex:1; font-size:14px; color:var(--text); text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onmouseover="this.style.color=\'var(--blue)\'" onmouseout="this.style.color=\'var(--text)\'">' +
        escHtml(r.title || r.url) +
        "</a>" +
        '<button onclick="removeResource(' +
        r.idx +
        ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:2px 8px;flex-shrink:0;" onmouseover="this.style.color=\'var(--red)\'" onmouseout="this.style.color=\'var(--muted)\'">✕</button>' +
        "</div>";
    });
    html += "</div></div>";
  });

  container.innerHTML = html;
}

function addResource() {
  var subject = document.getElementById("resSubject").value;
  var title = document.getElementById("resTitle").value.trim();
  var url = document.getElementById("resUrl").value.trim();

  if (!subject) return toast("اختر المادة", "error");
  if (!url) return toast("أدخل الرابط", "error");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  user.data.resources.push({
    subject: subject,
    title: title || url,
    url: url,
  });
  saveUser();
  document.getElementById("resTitle").value = "";
  document.getElementById("resUrl").value = "";
  renderResources();
  toast("✓ تمت إضافة الرابط", "success");
}

function removeResource(idx) {
  confirmAction("حذف هذا الرابط؟", function () {
    user.data.resources.splice(idx, 1);
    saveUser();
    renderResources();
  });
}

// ============================================================
//  INIT — AUTO-LOGIN via Supabase session
// ============================================================
(async function () {
  const { data: sessionData } = await _supabase.auth.getSession();
  if (sessionData && sessionData.session) {
    const uid = sessionData.session.user.id;
    const email = sessionData.session.user.email;
    const profile = await dbLoadUser(uid);
    if (profile) {
      user = {
        id: uid,
        name: profile.name,
        school: profile.school,
        email: email,
        data: profile.data || {},
      };
      if (!user.data.practicalSessions) user.data.practicalSessions = {};
      if (!user.data.studyLog) user.data.studyLog = {};
      if (!user.data.totalPomoSec) user.data.totalPomoSec = 0;
      if (!user.data.grades) user.data.grades = [];
      if (!user.data.theme) user.data.theme = "blue";
      if (!user.data.examsCountdown) user.data.examsCountdown = [];
      if (!user.data.resources) user.data.resources = [];
      initDashboard();
    }
  }
})();

applyResponsive();

// ============================================================
//  🆕 DASHBOARD HEADER
// ============================================================
function updateDashHeader() {
  if (!user) return;
  var avatar = document.getElementById("dhAvatar");
  var dhName = document.getElementById("dhName");
  var dhSchool = document.getElementById("dhSchool");
  var dhDate = document.getElementById("dhDate");
  var dhStreak = document.getElementById("dhStreak");
  var dhTodayTasks = document.getElementById("dhTodayTasks");
  var dhTodayTime = document.getElementById("dhTodayTime");
  if (!avatar) return;

  avatar.textContent = user.name ? user.name.charAt(0) : "؟";
  dhName.textContent = "مرحباً، " + user.name + " 👋";
  dhSchool.textContent = user.school;

  var now = new Date();
  dhDate.textContent = now.toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  var todos = user.data.todos || [];
  var doneTasks = todos.filter(function (t) {
    return t.completed;
  }).length;
  dhTodayTasks.textContent = doneTasks + "/" + todos.length;

  var totalPomoSec = user.data.totalPomoSec || 0;
  var totalDays = Math.floor(totalPomoSec / 86400);
  var remSec = totalPomoSec % 86400;
  var tph = Math.floor(remSec / 3600);
  var tpm = Math.floor((remSec % 3600) / 60);
  dhTodayTime.textContent =
    totalPomoSec === 0
      ? "0 يوم و 00:00"
      : totalDays +
        " يوم و " +
        String(tph).padStart(2, "0") +
        ":" +
        String(tpm).padStart(2, "0");

  dhStreak.textContent = calcStreak();
}

function calcStreak() {
  if (!user || !user.data.studyLog) return 0;
  var log = user.data.studyLog;
  var streak = 0;
  var d = new Date();
  for (var i = 0; i < 365; i++) {
    var key = d.toISOString().slice(0, 10);
    if (log[key] && log[key] > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      d.setDate(d.getDate() - 1);
      var yKey = d.toISOString().slice(0, 10);
      if (!log[yKey] || log[yKey] === 0) break;
    } else {
      break;
    }
  }
  return streak;
}

// ============================================================
//  🆕 HEATMAP
// ============================================================
function renderHeatmap() {
  var grid = document.getElementById("heatmapGrid");
  if (!grid || !user) return;
  var log = user.data.studyLog || {};
  var values = [];
  for (var i = 0; i < 182; i++) {
    var d2 = new Date();
    d2.setDate(d2.getDate() - i);
    values.push(log[d2.toISOString().slice(0, 10)] || 0);
  }
  var maxVal = Math.max.apply(null, values.concat([1]));
  grid.innerHTML = "";
  for (var j = 181; j >= 0; j--) {
    var cellDate = new Date();
    cellDate.setDate(cellDate.getDate() - j);
    var cellKey = cellDate.toISOString().slice(0, 10);
    var sec = log[cellKey] || 0;
    var level = 0;
    if (sec > 0) {
      var ratio = sec / maxVal;
      level = ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
    }
    var cell = document.createElement("div");
    cell.className = "heatmap-cell";
    if (level > 0) cell.setAttribute("data-level", level);
    var mins = Math.floor(sec / 60);
    cell.title =
      cellDate.toLocaleDateString("ar-EG", { month: "short", day: "numeric" }) +
      (mins > 0 ? " — " + mins + " دقيقة" : "");
    grid.appendChild(cell);
  }
}

// ============================================================
//  🆕 GLOBAL SEARCH
// ============================================================
function openSearch() {
  var overlay = document.getElementById("searchOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  setTimeout(function () {
    var inp = document.getElementById("searchInput");
    if (inp) inp.focus();
  }, 50);
  renderSearchResults("");
}
function closeSearch() {
  var overlay = document.getElementById("searchOverlay");
  if (overlay) overlay.classList.remove("open");
  var inp = document.getElementById("searchInput");
  if (inp) inp.value = "";
  var res = document.getElementById("searchResults");
  if (res) res.innerHTML = "";
}
window.openSearch = openSearch;
window.closeSearch = closeSearch;

function renderSearchResults(query) {
  if (!user) return;
  var q = query.trim().toLowerCase();
  var results = [];
  (user.data.todos || []).forEach(function (t, i) {
    if (!q || t.text.toLowerCase().includes(q))
      results.push({
        type: "مهمة",
        text: t.text,
        icon: "✅",
        target: "sec-tasks",
      });
  });
  (user.data.notes || []).forEach(function (n, i) {
    var txt = typeof n === "string" ? n : n.text;
    if (!q || txt.toLowerCase().includes(q))
      results.push({
        type: "ملاحظة",
        text: txt,
        icon: "📓",
        target: "sec-notes",
      });
  });
  (user.data.resources || []).forEach(function (r, i) {
    if (
      !q ||
      (r.title || "").toLowerCase().includes(q) ||
      (r.subject || "").toLowerCase().includes(q)
    )
      results.push({
        type: "مورد",
        text: (r.title || r.url) + " — " + r.subject,
        icon: "🔗",
        target: "sec-resources",
      });
  });
  (user.data.examsCountdown || []).forEach(function (e) {
    if (
      !q ||
      e.label.toLowerCase().includes(q) ||
      (e.subject || "").toLowerCase().includes(q)
    )
      results.push({
        type: "موعد",
        text: e.label + " — " + e.subject,
        icon: "📆",
        target: "sec-exams",
      });
  });
  window._searchActions = results.slice(0, 8).map(function (r) {
    return r.target;
  });
  var container = document.getElementById("searchResults");
  if (!container) return;
  if (results.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px;">لا توجد نتائج</div>';
    return;
  }
  container.innerHTML = results
    .slice(0, 8)
    .map(function (r, idx) {
      return (
        '<div class="search-item" onclick="window._doSearch(' +
        idx +
        ')">' +
        '<span style="font-size:18px">' +
        r.icon +
        "</span>" +
        '<span style="flex:1">' +
        escHtml(r.text.substring(0, 60)) +
        "</span>" +
        '<span class="si-type">' +
        r.type +
        "</span></div>"
      );
    })
    .join("");
}
window._doSearch = function (idx) {
  var target = window._searchActions && window._searchActions[idx];
  if (target) {
    closeSearch();
    if (window.scrollToSection) scrollToSection(target);
  }
};

document.addEventListener("input", function (e) {
  if (e.target.id === "searchInput") renderSearchResults(e.target.value);
});
document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    var dash = document.getElementById("dashboard");
    if (dash && dash.style.display !== "none") openSearch();
  }
  if (e.key === "Escape") {
    var o = document.getElementById("searchOverlay");
    if (o && o.classList.contains("open")) closeSearch();
  }
});
(function () {
  var ov = document.getElementById("searchOverlay");
  if (ov)
    ov.addEventListener("click", function (e) {
      if (e.target === this) closeSearch();
    });
})();

// ============================================================
//  🆕 FOCUS MODE
// ============================================================
var _focusMode = false;
window.toggleFocusMode = function () {
  _focusMode = !_focusMode;
  document.body.classList.toggle("focus-mode", _focusMode);
  var btn = document.getElementById("focusModeToggle");
  if (_focusMode) {
    if (btn) btn.innerHTML = "✖ خروج من التركيز";
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("🎯 وضع التركيز — مؤقت بومودورو فقط", "info");
  } else {
    if (btn) btn.innerHTML = "🎯 وضع التركيز";
    toast("عدت للوضع العادي ✓", "success");
  }
};

// ============================================================
//  🆕 TASK PRIORITY
// ============================================================
var _origAddItemFn = window.addItem;
window.addItem = function (type) {
  if (type !== "todo") {
    _origAddItemFn(type);
    return;
  }
  var inp = document.getElementById("todoInp");
  var val = inp.value.trim();
  if (!val) {
    inp.focus();
    return;
  }
  var priority =
    (document.getElementById("todoPriority") || {}).value || "normal";
  user.data.todos.push({ text: val, completed: false, priority: priority });
  inp.value = "";
  saveUser();
  renderList("todo");
  inp.focus();
};

var _origRenderListFn = window.renderList;
window.renderList = function (type) {
  if (type !== "todo") {
    _origRenderListFn(type);
    return;
  }
  var list = document.getElementById("todoList");
  var items = user.data.todos || [];
  if (items.length === 0) {
    list.innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>لا توجد مهام بعد<br>أضف مهمتك الأولى!</p></div>';
    updateProgress();
    return;
  }
  var pOrder = { urgent: 0, important: 1, normal: 2 };
  var sorted = items.map(function (item, idx) {
    return { item: item, idx: idx };
  });
  sorted.sort(function (a, b) {
    return (
      (pOrder[a.item.priority || "normal"] || 2) -
      (pOrder[b.item.priority || "normal"] || 2)
    );
  });
  var pLabel = { urgent: "عاجل 🔴", important: "مهم 🟡", normal: "عادي" };
  var pClass = {
    urgent: "p-urgent",
    important: "p-important",
    normal: "p-normal",
  };
  list.innerHTML = sorted
    .map(function (s) {
      var item = s.item,
        idx = s.idx,
        p = item.priority || "normal";
      return (
        '<div class="todo-item">' +
        '<input type="checkbox" ' +
        (item.completed ? "checked" : "") +
        ' onchange="toggleComplete(' +
        idx +
        ')">' +
        '<span style="font-size:14px;flex:1;' +
        (item.completed
          ? "text-decoration:line-through;color:var(--muted);"
          : "color:var(--text);") +
        '">' +
        escHtml(item.text) +
        "</span>" +
        '<span class="task-priority ' +
        pClass[p] +
        '">' +
        pLabel[p] +
        "</span>" +
        '<button class="del-btn" onclick="removeItem(\'todo\',' +
        idx +
        ",'" +
        escHtml(item.text).substring(0, 20) +
        "')\">" +
        "✕</button>" +
        "</div>"
      );
    })
    .join("");
  updateProgress();
};

// ============================================================
//  🆕 ONBOARDING
// ============================================================
var _obStep = 0;
window.nextObStep = function (step) {
  _obStep = step;
  document.querySelectorAll(".ob-step").forEach(function (el) {
    el.classList.remove("active");
  });
  document.querySelectorAll(".ob-dot").forEach(function (el, i) {
    el.classList.toggle("active", i === step);
  });
  var el = document.getElementById("obStep" + step);
  if (el) el.classList.add("active");
  var pr = document.getElementById("obProgress");
  if (pr) pr.textContent = step + 1 + " / 4";
};
window.closeOnboarding = function () {
  var o = document.getElementById("onboardingOverlay");
  if (o) o.classList.remove("open");
  var key = user ? "onboardingDone_" + user.id : "onboardingDone";
  localStorage.setItem(key, "1");
};
function checkOnboarding() {
  var key = user ? "onboardingDone_" + user.id : "onboardingDone";
  if (!localStorage.getItem(key)) {
    var o = document.getElementById("onboardingOverlay");
    if (o) {
      o.classList.add("open");
      window.nextObStep(0);
    }
  }
}

// ============================================================
//  🆕 BACKUP REMINDER
// ============================================================
function checkBackupReminder() {
  var badge = document.getElementById("backupBadge");
  if (!badge || !user) return;
  var last = localStorage.getItem("lastBackup_" + user.id);
  if (!last) {
    badge.classList.add("visible");
    return;
  }
  if ((Date.now() - parseInt(last)) / (1000 * 60 * 60 * 24) >= 7)
    badge.classList.add("visible");
  else badge.classList.remove("visible");
}
var _origExportFn = window.exportAllData;
window.exportAllData = function () {
  _origExportFn();
  if (user) {
    localStorage.setItem("lastBackup_" + user.id, Date.now().toString());
    var badge = document.getElementById("backupBadge");
    if (badge) badge.classList.remove("visible");
  }
};

// ============================================================
//  🆕 EXAM NOTIFICATIONS
// ============================================================
function checkExamNotifications() {
  if (!user || !user.data.examsCountdown) return;
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  user.data.examsCountdown.forEach(function (e) {
    var examDate = new Date(e.date);
    examDate.setHours(0, 0, 0, 0);
    var diff = Math.round((examDate - today) / (1000 * 60 * 60 * 24));
    if (diff === 1)
      new Notification("📆 " + e.label + " — غداً!", {
        body: "فرض " + e.subject + " غداً. حظاً موفقاً! 🎯",
      });
    else if (diff === 3)
      new Notification("📅 " + e.label, {
        body: "فرض " + e.subject + " بعد 3 أيام. راجع دروسك!",
      });
  });
}

// ============================================================
//  🆕 HOOK INTO initDashboard
// ============================================================
var _origInitDB = window.initDashboard;
window.initDashboard = function () {
  _origInitDB.apply(this, arguments);
  setTimeout(function () {
    updateDashHeader();
    renderHeatmap();
    checkBackupReminder();
    checkExamNotifications();
    checkOnboarding();
    var sBtn = document.getElementById("searchBtn");
    if (sBtn) sBtn.classList.remove("hidden");
    var ft = document.getElementById("focusModeToggle");
    if (ft) ft.classList.add("visible");
    var gb = document.getElementById("guideFloatBtn");
    if (gb) gb.classList.add("visible");
    // backup reminder toast
    var last = user && localStorage.getItem("lastBackup_" + user.id);
    if (!last)
      setTimeout(function () {
        toast(
          "💡 لم تقم بنسخة احتياطية بعد! احفظ بياناتك من 'نسخة احتياطية'",
          "info",
        );
      }, 5000);
    else if ((Date.now() - parseInt(last)) / (1000 * 60 * 60 * 24) >= 7)
      setTimeout(function () {
        toast("⚠️ مرّ أسبوع على آخر نسخة احتياطية!", "info");
      }, 3000);
  }, 950);
};

var _origRS = window.renderStats;
window.renderStats = function () {
  _origRS.apply(this, arguments);
  renderHeatmap();
  updateDashHeader();
};

setInterval(function () {
  var dash = document.getElementById("dashboard");
  if (dash && dash.style.display !== "none") {
    updateDashHeader();
  }
}, 10000);

// Auto-init if already logged in
setTimeout(function () {
  var dash = document.getElementById("dashboard");
  if (dash && dash.style.display !== "none") {
    updateDashHeader();
    renderHeatmap();
    checkBackupReminder();
    var ft = document.getElementById("focusModeToggle");
    if (ft) ft.classList.add("visible");
    var sBtn = document.getElementById("searchBtn");
    if (sBtn) sBtn.classList.remove("hidden");
    var gb2 = document.getElementById("guideFloatBtn");
    if (gb2) gb2.classList.add("visible");
  }
}, 1300);

// ============================================================
//  🖨️ PRINT SCHEDULE
// ============================================================
window.printSchedule = function () {
  if (!user) return;

  var days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  var timeSlots = [
    "08-09",
    "09-10",
    "10-11",
    "11-12",
    "استراحة",
    "14-15",
    "15-16",
    "16-17",
  ];
  var tabLabel = currentTab === "schedule" ? "الجدول الدراسي" : "مواعيد الفروض";

  var DPR = 2;
  var COL_DAY = 100,
    COL_BREAK = 52,
    COL_W = 108;
  var ROW_H = 52,
    HEADER_H = 48,
    TITLE_H = 54,
    PADDING = 24,
    FOOT_H = 32;
  var totalCols = [
    COL_DAY,
    COL_W,
    COL_W,
    COL_W,
    COL_W,
    COL_BREAK,
    COL_W,
    COL_W,
    COL_W,
  ];
  var tableW = totalCols.reduce(function (a, b) {
    return a + b;
  }, 0);
  var canvasW = tableW + PADDING * 2;
  var canvasH = TITLE_H + HEADER_H + days.length * ROW_H + FOOT_H + PADDING * 2;

  var cv = document.createElement("canvas");
  cv.width = canvasW * DPR;
  cv.height = canvasH * DPR;
  var c = cv.getContext("2d");
  c.scale(DPR, DPR);

  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, canvasW, canvasH);

  var C = {
    bg: "#ffffff",
    surface: "#f8fafc",
    border: "rgba(0,0,0,0.1)",
    text: "#1e293b",
    muted: "#64748b",
    cyan: "#0284c7",
    blue: "#2563eb",
    breakBg: "rgba(0,0,0,0.06)",
    dayBg: "rgba(2,132,199,0.08)",
    headerBg: "rgba(0,0,0,0.03)",
    subjectColors: {
      رياضيات: { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" },
      فيزياء: { bg: "rgba(168,85,247,0.12)", text: "#7c3aed" },
      علوم: { bg: "rgba(16,185,129,0.12)", text: "#065f46" },
      عربية: { bg: "rgba(245,158,11,0.12)", text: "#92400e" },
      فرنسية: { bg: "rgba(239,68,68,0.12)", text: "#991b1b" },
      إنجليزية: { bg: "rgba(14,165,233,0.12)", text: "#0369a1" },
      "تاريخ/جغرافيا": { bg: "rgba(234,88,12,0.12)", text: "#9a3412" },
      فلسفة: { bg: "rgba(99,102,241,0.12)", text: "#4338ca" },
      إسلامية: { bg: "rgba(20,184,166,0.12)", text: "#0f766e" },
      "إعلام آلي": { bg: "rgba(6,182,212,0.12)", text: "#0e7490" },
      تكنلوجيا: { bg: "rgba(251,191,36,0.12)", text: "#92400e" },
    },
  };

  function roundRect(x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }
  function colX(ci) {
    var x = PADDING;
    for (var i = 0; i < ci; i++) x += totalCols[i];
    return x;
  }
  function drawText(text, cx, cy, maxW) {
    var size = 12;
    c.font = "600 " + size + "px Tajawal, Arial";
    while (c.measureText(text).width > maxW - 8 && size > 8) {
      size--;
      c.font = "600 " + size + "px Tajawal, Arial";
    }
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, cx, cy);
  }

  c.strokeStyle = "rgba(0,0,0,0.15)";
  c.lineWidth = 1;
  roundRect(PADDING / 2, PADDING / 2, canvasW - PADDING, canvasH - PADDING, 14);
  c.stroke();

  var titleY = PADDING + TITLE_H / 2;
  c.fillStyle = C.blue;
  c.font = "900 18px Cairo, Arial";
  c.textAlign = "right";
  c.textBaseline = "middle";
  c.fillText("📅 " + tabLabel, canvasW - PADDING - 12, titleY);
  c.fillStyle = C.muted;
  c.font = "400 11px Tajawal, Arial";
  c.textAlign = "left";
  c.fillText(user.name + " — " + user.school, PADDING + 12, titleY - 6);
  var dateStr = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  c.fillStyle = "rgba(0,0,0,0.4)";
  c.font = "400 10px Tajawal, Arial";
  c.fillText(dateStr, PADDING + 12, titleY + 8);
  c.strokeStyle = "rgba(0,0,0,0.08)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(PADDING, PADDING + TITLE_H);
  c.lineTo(canvasW - PADDING, PADDING + TITLE_H);
  c.stroke();

  var hdrY = PADDING + TITLE_H;
  timeSlots.forEach(function (label, i) {
    var ci = i + 1,
      x = colX(ci),
      w = totalCols[ci],
      cx = x + w / 2,
      cy = hdrY + HEADER_H / 2;
    c.fillStyle = i === 4 ? C.breakBg : C.headerBg;
    c.fillRect(x, hdrY, w, HEADER_H);
    c.fillStyle = C.muted;
    c.font = "600 " + (i === 4 ? 10 : 11) + "px Tajawal, Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label, cx, cy);
  });
  c.fillStyle = C.dayBg;
  c.fillRect(colX(0), hdrY, totalCols[0], HEADER_H);
  c.fillStyle = C.muted;
  c.font = "600 11px Tajawal, Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("اليوم", colX(0) + totalCols[0] / 2, hdrY + HEADER_H / 2);

  days.forEach(function (day, dIdx) {
    var rowY = hdrY + HEADER_H + dIdx * ROW_H;
    c.fillStyle = dIdx % 2 === 0 ? "rgba(0,0,0,0.01)" : "transparent";
    c.fillRect(PADDING, rowY, tableW, ROW_H);
    c.fillStyle = C.dayBg;
    c.fillRect(colX(0), rowY, totalCols[0], ROW_H);
    c.fillStyle = C.cyan;
    c.font = "700 12px Tajawal, Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(day, colX(0) + totalCols[0] / 2, rowY + ROW_H / 2);
    for (var i = 0; i < 8; i++) {
      var ci = i + 1,
        x = colX(ci),
        w = totalCols[ci],
        cy2 = rowY + ROW_H / 2,
        cx2 = x + w / 2;
      if (i === 4) {
        c.fillStyle = C.breakBg;
        c.fillRect(x, rowY, w, ROW_H);
        c.font = "14px Arial";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("☕", cx2, cy2);
        continue;
      }
      var key = currentTab + "_" + dIdx + "_" + i;
      var practKey = "practical_" + dIdx + "_" + i;
      var practData =
        user.data.practicalSessions && user.data.practicalSessions[practKey];
      var cellText = "",
        isPract = false;
      if (practData && currentTab === "schedule") {
        cellText = practData.sub1 + " / " + practData.sub2;
        isPract = true;
      } else {
        cellText = (user.data[currentTab] && user.data[currentTab][key]) || "";
      }
      if (!cellText || cellText === "-") {
        c.fillStyle = "rgba(0,0,0,0.01)";
        c.fillRect(x + 2, rowY + 2, w - 4, ROW_H - 4);
      } else {
        var pair = C.subjectColors[cellText.split(" / ")[0]] || {
          bg: "rgba(0,0,0,0.05)",
          text: C.text,
        };
        c.fillStyle = isPract ? "rgba(2,132,199,0.1)" : pair.bg;
        roundRect(x + 4, rowY + 6, w - 8, ROW_H - 12, 6);
        c.fill();
        c.fillStyle = isPract ? C.cyan : pair.text;
        drawText(cellText, cx2, cy2, w);
      }
    }
    c.strokeStyle = "rgba(0,0,0,0.06)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(PADDING, rowY + ROW_H);
    c.lineTo(canvasW - PADDING, rowY + ROW_H);
    c.stroke();
  });

  c.strokeStyle = "rgba(0,0,0,0.07)";
  c.lineWidth = 1;
  for (var ci = 0; ci <= totalCols.length; ci++) {
    var x2 = colX(ci);
    c.beginPath();
    c.moveTo(x2, hdrY);
    c.lineTo(x2, hdrY + HEADER_H + days.length * ROW_H);
    c.stroke();
  }

  c.fillStyle = "rgba(0,0,0,0.3)";
  c.font = "400 10px Tajawal, Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(
    "منصة دراسة • " + dateStr,
    canvasW / 2,
    canvasH - PADDING - FOOT_H / 2,
  );

  var imgData = cv.toDataURL("image/png");
  var win = window.open("", "_blank");
  if (!win) {
    toast("⚠️ تأكد من السماح بالنوافذ المنبثقة", "error");
    return;
  }
  win.document.write(
    '<!DOCTYPE html><html dir="rtl"><head><title>طباعة الجدول</title>' +
      "<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px;}" +
      "img{max-width:100%;height:auto;border-radius:8px;}" +
      "@media print{body{padding:0;}img{max-width:100%;border-radius:0;}}" +
      "</style></head><body>" +
      '<img src="' +
      imgData +
      '" onload="window.print();"/>' +
      "</body></html>",
  );
  win.document.close();
  toast("✓ تم فتح نافذة الطباعة", "success");
};
