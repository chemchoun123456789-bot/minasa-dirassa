const SUPABASE_URL = "https://yrxsmdtsjlqvvzwibsyq.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyeHNtZHRzamxxdnZ6d2lic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDk0NTIsImV4cCI6MjA5MzgyNTQ1Mn0.1atB_5xByde4i94HcIkIbEdR_0CgEuOz9jVbArLBiHM";

const _supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth:{
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

var _pendingRegData = null;
var _otpEmail = "";
var _otpAttempts = 0;
var _otpLockUntil = 0;
var _resendLockUntil = 0;
var _resendTimerInterval = null;

function showOtpScreen(email) {
  _otpEmail = email;
  _otpAttempts = 0;
  _otpLockUntil = 0;

  var regForm = document.getElementById("regForm");
  var otpForm = document.getElementById("otpForm");
  if (regForm) {
    regForm.style.display = "none";
    regForm.classList.add("hidden");
  }
  if (otpForm) {
    otpForm.style.display = "block";
    otpForm.classList.remove("hidden");
  }

  var hint = document.getElementById("otpEmailHint");
  if (hint) hint.textContent = "أرسلنا كود من 6 أرقام إلى: " + email;

  clearOtpBoxes();
  document.getElementById("otpAttemptsMsg").textContent = "";

  initOtpBoxes();

  updateResendBtn();

  var boxes = document.querySelectorAll(".otp-box");
  if (boxes[0]) boxes[0].focus();
}

function initOtpBoxes() {
  /* Clone each box to wipe any previously attached listeners (memory leak fix) */
  document.querySelectorAll(".otp-box").forEach(function (box) {
    var fresh = box.cloneNode(true);
    box.parentNode.replaceChild(fresh, box);
  });

  var boxes = document.querySelectorAll(".otp-box");
  boxes.forEach(function (box, i) {
    box.addEventListener("input", function () {
      var val = this.value.replace(/[^0-9]/g, "");
      this.value = val ? val[val.length - 1] : "";
      if (this.value) {
        this.classList.add("otp-filled");
        this.classList.remove("otp-error");
        if (i < boxes.length - 1) boxes[i + 1].focus();
      } else {
        this.classList.remove("otp-filled");
      }
    });

    box.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && !this.value && i > 0) {
        boxes[i - 1].focus();
        boxes[i - 1].value = "";
        boxes[i - 1].classList.remove("otp-filled");
      }
      if (e.key === "Enter") submitOtp();
    });

    box.addEventListener("paste", function (e) {
      e.preventDefault();
      var pasted = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/[^0-9]/g, "");
      pasted.split("").forEach(function (ch, j) {
        if (boxes[j]) {
          boxes[j].value = ch;
          boxes[j].classList.add("otp-filled");
        }
      });
      var lastFilled = Math.min(pasted.length, boxes.length - 1);
      boxes[lastFilled].focus();
    });
  });
}

function clearOtpBoxes() {
  document.querySelectorAll(".otp-box").forEach(function (b) {
    b.value = "";
    b.classList.remove("otp-filled", "otp-error");
  });
}

async function submitOtp() {
  if (Date.now() < _otpLockUntil) {
    var secs = Math.ceil((_otpLockUntil - Date.now()) / 1000);
    document.getElementById("otpAttemptsMsg").textContent =
      "انتظر " + secs + " ثانية قبل المحاولة مجدداً";
    return;
  }

  var boxes = document.querySelectorAll(".otp-box");
  var code = Array.from(boxes)
    .map(function (b) {
      return b.value;
    })
    .join("");
  if (code.length < 6) return toast("أدخل الكود كاملاً (6 أرقام)", "error");

  toast("جاري التحقق...", "info");

  var res = await _supabase.auth.verifyOtp({
    email: _otpEmail,
    token: code,
    type: "signup",
  });

  if (res.error) {
    _otpAttempts++;

    boxes.forEach(function (b) {
      b.classList.add("otp-error");
    });
    setTimeout(function () {
      boxes.forEach(function (b) {
        b.classList.remove("otp-error");
      });
    }, 500);

    if (_otpAttempts >= 5) {
      _otpLockUntil = Date.now() + 30000;
      _otpAttempts = 0;
      clearOtpBoxes();
      document.getElementById("otpAttemptsMsg").textContent =
        "تجاوزت الحد — انتظر 30 ثانية";
      var lockInterval = setInterval(function () {
        var remaining = Math.ceil((_otpLockUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(lockInterval);
          document.getElementById("otpAttemptsMsg").textContent = "";
        } else {
          document.getElementById("otpAttemptsMsg").textContent =
            "تجاوزت الحد — انتظر " + remaining + " ثانية";
        }
      }, 1000);
      return;
    }

    var remaining = 5 - _otpAttempts;
    document.getElementById("otpAttemptsMsg").textContent =
      "كود خاطئ — تبقى لك " + remaining + " محاولة";
    clearOtpBoxes();
    boxes[0].focus();
    return toast("الكود غير صحيح", "error");
  }

  toast("جاري إنشاء حسابك...", "info");

  var uid = res.data && res.data.user ? res.data.user.id : _pendingRegData.uid;
  if (!uid)
    return toast("خطأ: لم نتمكن من التحقق من الهوية، حاول مجدداً", "error");

  var pending = _pendingRegData;
  var defaultData = {
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

  var profileErr = await _supabase.from("user_profiles").insert({
    id: uid,
    name: pending.name,
    school: pending.school,
    data: defaultData,
  });

  if (profileErr.error) {
    console.error("Profile error:", profileErr.error);
    return toast("خطأ في إنشاء الملف الشخصي", "error");
  }

  user = {
    id: uid,
    name: pending.name,
    school: pending.school,
    email: pending.email,
    data: defaultData,
  };

  _pendingRegData = null;

  // إخفاء شاشة OTP
  var otpForm = document.getElementById("otpForm");
  if (otpForm) {
    otpForm.style.display = "none";
    otpForm.classList.add("hidden");
  }

  toast("أهلاً بك! تم تفعيل حسابك بنجاح 🎉", "success");
  initDashboard();
}

async function resendOtp() {
  // تحقق من مدة الانتظار (5 دقائق)
  if (Date.now() < _resendLockUntil) {
    var secs = Math.ceil((_resendLockUntil - Date.now()) / 1000);
    var mins = Math.floor(secs / 60);
    var s = secs % 60;
    toast(
      "انتظر " + mins + ":" + String(s).padStart(2, "0") + " قبل إعادة الإرسال",
      "error",
    );
    return;
  }

  toast("جاري إعادة إرسال الكود...", "info");
  var res = await _supabase.auth.resend({ type: "signup", email: _otpEmail });

  if (res.error) return toast("خطأ في الإرسال: " + res.error.message, "error");

  // تفعيل عداد 5 دقائق
  _resendLockUntil = Date.now() + 5 * 60 * 1000;
  _otpAttempts = 0;
  document.getElementById("otpAttemptsMsg").textContent = "";
  clearOtpBoxes();
  document.querySelectorAll(".otp-box")[0].focus();
  updateResendBtn();
  startResendTimer();
  toast("تم إرسال كود جديد إلى بريدك ✓", "success");
}

function updateResendBtn() {
  var btn = document.getElementById("resendOtpBtn");
  var timerEl = document.getElementById("resendTimer");
  if (!btn) return;
  var locked = Date.now() < _resendLockUntil;
  btn.style.opacity = locked ? "0.35" : "1";
  btn.style.pointerEvents = locked ? "none" : "auto";
  if (timerEl) timerEl.style.display = locked ? "block" : "none";
}

function startResendTimer() {
  if (_resendTimerInterval) clearInterval(_resendTimerInterval);
  _resendTimerInterval = setInterval(function () {
    var remaining = Math.ceil((_resendLockUntil - Date.now()) / 1000);
    var timerEl = document.getElementById("resendTimer");
    if (remaining <= 0) {
      clearInterval(_resendTimerInterval);
      updateResendBtn();
      if (timerEl) timerEl.style.display = "none";
    } else {
      var m = Math.floor(remaining / 60);
      var s = remaining % 60;
      if (timerEl)
        timerEl.textContent =
          "إعادة الإرسال بعد " + m + ":" + String(s).padStart(2, "0");
    }
  }, 1000);
}

function backToAuthChoice() {
  ["loginForm", "regForm", "otpForm"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.classList.add("hidden");
    }
  });
  var choice = document.getElementById("authChoice");
  var google = document.getElementById("googleAuthWrap");
  if (choice) choice.style.display = "flex";
  if (google) google.style.display = "block";
  _pendingRegData = null;
}

function backToRegForm() {
  var otpForm = document.getElementById("otpForm");
  var regForm = document.getElementById("regForm");
  if (otpForm) {
    otpForm.style.display = "none";
    otpForm.classList.add("hidden");
  }
  if (regForm) {
    regForm.style.display = "block";
    regForm.classList.remove("hidden");
  }
  _pendingRegData = null;
}

var DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "throwam.com",
  "trashmail.com",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "spam4.me",
  "fakeinbox.com",
  "maildrop.cc",
  "dispostable.com",
  "tempr.email",
  "discard.email",
  "getairmail.com",
  "filzmail.com",
  "mailnull.com",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "trashmail.at",
  "trashmail.io",
  "trashmail.me",
  "trashmail.net",
  "trashmail.xyz",
  "tempinbox.com",
  "throwaway.email",
  "mailtemp.net",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "10minemail.com",
  "tempinbox.co.uk",
  "mailnesia.com",
  "mailnull.com",
  "spamspot.com",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "fakedemail.com",
  "fakemail.fr",
  "fizmail.com",
  "jetable.fr.nf",
  "kasmail.com",
  "klassmaster.com",
  "klzlk.com",
  "lol.ovpn.to",
  "mt2009.com",
  "noclickemail.com",
  "no-spam.ws",
  "obobbo.com",
  "pookmail.com",
  "rppkn.com",
  "spamgob.com",
  "spaml.de",
  "speed.1s.fr",
  "tempalias.com",
  "tetempe.com",
  "throwam.com",
]);

function isDisposableEmail(email) {
  var domain = email.split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

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

let user = null;

let timerInterval = null;

let timeLeft = 25 * 60;

let isRunning = false;

let pomoMode = "study";

let currentSession = 1;

let currentTab = "schedule";

let audioCtx = null;

let chillSounds = {};

let clockTickEnabled = true;
let _clockTickEntry = null; // { audio, fadeInterval }

/* ── New Pomo Settings ── */
var autoPomoEnabled = true;
var alarmSoundEnabled = true;
var pomoAbsoluteFocusEnabled = false;
var _breakAlarmFile = "levelup-alarm.mp3";
var _studyAlarmFile = "levelup-alarm.mp3";
var _breakAlarmVol = 0.8;
var _studyAlarmVol = 0.8;

function _setPsAlarmFile(type, file) {
  if (type === "break") _breakAlarmFile = file;
  else _studyAlarmFile = file;
}
function _setPsAlarmVol(type, vol) {
  if (type === "break") _breakAlarmVol = vol;
  else _studyAlarmVol = vol;
}

function _playAlarmFile(wasStudy) {
  if (!alarmSoundEnabled) return;
  var file = wasStudy ? _studyAlarmFile : _breakAlarmFile;
  var vol = wasStudy ? _studyAlarmVol : _breakAlarmVol;
  try {
    var a = new Audio(file);
    a.volume = vol;
    a.play().catch(function () {});
  } catch (e) {}
}

function _updateSoundColState() {
  var col = document.getElementById("ps-sound-col");
  if (!col) return;
  col.classList.toggle("ps-sound-disabled", !alarmSoundEnabled);
}

function _syncPsSliders() {
  var strips = [
    { inp: "studyInp", min: 5, max: 10000, v: config.study },
    { inp: "breakInp", min: 1, max: 10000, v: config.break },
    { inp: "sessionInp", min: 1, max: 20, v: config.sessions },
    { inp: "longBreakInp", min: 1, max: 10000, v: config.longBreak },
  ];
  strips.forEach(function (s) {
    var inp = document.getElementById(s.inp);
    if (inp) inp.value = s.v;
    if (typeof window._renderNpStrip === "function")
      window._renderNpStrip(s.inp);
  });
  // Volume sliders
  var bvol = document.getElementById("breakAlarmVol");
  var svol = document.getElementById("studyAlarmVol");
  var bpct = document.getElementById("breakVolPct");
  var spct = document.getElementById("studyVolPct");
  var bPct = Math.round(_breakAlarmVol * 100);
  var sPct = Math.round(_studyAlarmVol * 100);
  if (bvol) {
    bvol.value = bPct;
    if (typeof window._updateVolSlider === "function")
      window._updateVolSlider(bvol);
  }
  if (svol) {
    svol.value = sPct;
    if (typeof window._updateVolSlider === "function")
      window._updateVolSlider(svol);
  }
  if (bpct) bpct.textContent = bPct + "%";
  if (spct) spct.textContent = sPct + "%";
  _syncDropdownLabel("break", _breakAlarmFile);
  _syncDropdownLabel("study", _studyAlarmFile);
}

var _SOUND_NAMES = {
  "levelup-alarm.mp3": "level up alarm",
  "school-alarm.mp3": "school alarm",
  "calm-alarm.mp3": "calm alarm",
  "bell.mp3": "bell alarm",
  "noisy-alarm.mp3": "noisy alarm",
  "slavery-alarm.mp3": "منبه نداء العبودية",
};

function _syncDropdownLabel(type, file) {
  var labelEl = document.getElementById(type + "SoundLabel");
  if (labelEl) labelEl.textContent = _SOUND_NAMES[file] || file;
  var list = document.getElementById(type + "SoundList");
  if (list) {
    list.querySelectorAll(".ps-dropdown-item").forEach(function (item) {
      item.classList.toggle(
        "selected",
        item.getAttribute("data-file") === file,
      );
    });
  }
}

function _enterAbsFocus() {
  var ov = document.getElementById("absFocusOverlay");
  var timerEl = document.getElementById("absFocusTimerDisp");
  var mainTimer = document.getElementById("pomoTimer");
  var labelEl = document.getElementById("absFocusLabel");
  var lbl = document.getElementById("pomoLabel");
  if (!ov) return;
  if (timerEl && mainTimer) timerEl.textContent = mainTimer.textContent;
  if (labelEl && lbl) labelEl.textContent = lbl.textContent;
  var btn = document.getElementById("absFocusPauseBtn");
  if (btn && typeof _setAbsPauseBtnState === "function") _setAbsPauseBtnState(false);
  ov.classList.add("active");
}

function _exitAbsFocus() {
  var ov = document.getElementById("absFocusOverlay");
  if (ov) ov.classList.remove("active");
}

function initPomoNewSettings() {
  try {
    var a = localStorage.getItem("pomoAutoPomodoro");
    if (a !== null) autoPomoEnabled = a !== "false";
    var b = localStorage.getItem("pomoAlarmSound");
    if (b !== null) alarmSoundEnabled = b !== "false";
    var c = localStorage.getItem("pomoAbsFocus");
    if (c !== null) pomoAbsoluteFocusEnabled = c !== "false";
    var d = localStorage.getItem("pomoBreakAlarmFile");
    if (d) _breakAlarmFile = d;
    var e = localStorage.getItem("pomoStudyAlarmFile");
    if (e) _studyAlarmFile = e;
    var f = localStorage.getItem("pomoBreakAlarmVol");
    if (f !== null) _breakAlarmVol = parseFloat(f);
    var g = localStorage.getItem("pomoStudyAlarmVol");
    if (g !== null) _studyAlarmVol = parseFloat(g);
    // Load timer config
    var st = localStorage.getItem("pomoStudyTime");
    if (st !== null) config.study = Math.max(1, parseInt(st) || 25);
    var bt = localStorage.getItem("pomoBreakTime");
    if (bt !== null) config.break = Math.max(1, parseInt(bt) || 5);
    var se = localStorage.getItem("pomoSessions");
    if (se !== null) config.sessions = Math.max(1, parseInt(se) || 4);
    var lb = localStorage.getItem("pomoLongBreak");
    if (lb !== null) config.longBreak = Math.max(1, parseInt(lb) || 20);
  } catch (err) {}

  var autoT = document.getElementById("autoPomoToggle");
  var alarmT = document.getElementById("alarmSoundToggle");
  var focusT = document.getElementById("pomoFocusModeToggle");
  if (autoT) autoT.checked = autoPomoEnabled;
  if (alarmT) alarmT.checked = alarmSoundEnabled;
  if (focusT) focusT.checked = pomoAbsoluteFocusEnabled;

  _updateSoundColState();

  // Init alarm-sound toggle listener
  if (alarmT && !alarmT._psInited) {
    alarmT._psInited = true;
    alarmT.addEventListener("change", function () {
      alarmSoundEnabled = this.checked;
      try {
        localStorage.setItem("pomoAlarmSound", String(alarmSoundEnabled));
      } catch (er) {}
      _updateSoundColState();
    });
  }

  // Init auto-pomo toggle listener — applies immediately (even while timer runs)
  if (autoT && !autoT._psInited) {
    autoT._psInited = true;
    autoT.addEventListener("change", function () {
      autoPomoEnabled = this.checked;
      try {
        localStorage.setItem("pomoAutoPomodoro", String(autoPomoEnabled));
      } catch (er) {}
    });
  }

  // Init number strips with saved/default config values
  setTimeout(function () {
    if (typeof window._renderNpStrip === "function") {
      window._renderNpStrip("studyInp");
      window._renderNpStrip("breakInp");
      window._renderNpStrip("sessionInp");
      window._renderNpStrip("longBreakInp");
    }
    // Init volume slider backgrounds
    if (typeof window._updateVolSlider === "function") {
      var bv = document.getElementById("breakAlarmVol");
      var sv = document.getElementById("studyAlarmVol");
      if (bv) {
        bv.value = Math.round(_breakAlarmVol * 100);
        window._updateVolSlider(bv);
      }
      if (sv) {
        sv.value = Math.round(_studyAlarmVol * 100);
        window._updateVolSlider(sv);
      }
    }
  }, 200);
}

function _startClockTick() {
  if (!clockTickEnabled || pomoMode !== "study") return;
  if (_clockTickEntry) return; // already running
  const audio = new Audio("clock_ticking_sound_effect_-_SILHOUETTE_GEARS.mp3");
  audio.loop = true;
  audio.volume = 0;
  // نسجّل الصوت فوراً قبل الـ promise حتى لو جاء أمر إيقاف أثناء التحميل
  _clockTickEntry = { audio: audio, fadeInterval: null };
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise
      .then(function () {
        // إذا تم إيقاف الصوت أثناء التحميل نوقفه مباشرة
        if (!_clockTickEntry || _clockTickEntry.audio !== audio) {
          audio.pause();
          audio.currentTime = 0;
          return;
        }
        let vol = 0;
        const fadeIn = setInterval(function () {
          vol = Math.min(vol + 0.06, 0.6);
          audio.volume = vol;
          if (vol >= 0.6) clearInterval(fadeIn);
        }, 60);
        _clockTickEntry.fadeInterval = fadeIn;
      })
      .catch(function (err) {
        console.warn("clock tick blocked:", err);
        _clockTickEntry = null;
      });
  }
}

function _stopClockTick() {
  if (!_clockTickEntry) return;
  const { audio, fadeInterval } = _clockTickEntry;
  _clockTickEntry = null;
  if (fadeInterval) clearInterval(fadeInterval);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

let _clockTickSettingInited = false;
function initClockTickSetting() {
  try {
    var saved = localStorage.getItem("pomoClockTick");
    if (saved !== null) clockTickEnabled = saved !== "false";
  } catch (e) {}
  var toggle = document.getElementById("clockTickToggle");
  if (toggle) {
    toggle.checked = clockTickEnabled;
    // حارس يمنع إضافة أكثر من مستمع واحد حتى لو نودي initDashboard أكثر من مرة
    if (!_clockTickSettingInited) {
      _clockTickSettingInited = true;
      toggle.addEventListener("change", function () {
        if (isRunning) {
          // ارجع التبديل لوضعه السابق وأظهر تحذيراً
          this.checked = !this.checked;
          toast("أوقف المؤقت أولاً قبل تغيير إعداد الصوت ⚠️", "error");
          return;
        }
        clockTickEnabled = this.checked;
        try {
          localStorage.setItem("pomoClockTick", String(clockTickEnabled));
        } catch (e) {}
        if (clockTickEnabled && isRunning && pomoMode === "study") {
          _startClockTick();
        } else {
          _stopClockTick();
        }
      });
    }
  }
  // Init all new pomo settings (alarm, auto-pomo, focus mode, sounds)
  initPomoNewSettings();
}

let config = {
  study: 25,
  break: 5,
  sessions: 4,
  longBreak: 20,
};

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

async function dbSaveUser() {
  if (!user) return;
  const { error: error } = await _supabase.from("user_profiles").upsert(
    {
      id: user.id,
      name: user.name,
      school: user.school,
      data: user.data,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
    },
  );
  if (error) console.error("Save error:", error);
}

async function dbLoadUser(uid) {
  const { data: data, error: error } = await _supabase
    .from("user_profiles")
    .select("*")
    .eq("id", uid)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // no row found — حساب بدون ملف شخصي
    console.error("dbLoadUser:", error.code, error.message);
    return { __loadError: true }; // خطأ شبكة / RLS blocking
  }
  return data;
}

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

function applyResponsive() {
  const grid = document.getElementById("mainGrid");
  if (!grid) return;
  grid.style.gridTemplateColumns = window.innerWidth < 768 ? "1fr" : "1fr 1fr";
}

window.addEventListener("resize", applyResponsive);

let _googlePendingSession = null;

// ══════════════════════════════════════════════
// Google Auth — منطق موحد وموثوق
// ══════════════════════════════════════════════
var _googleAuthHandled = false;

async function _handleGoogleSession(session) {
  if (_googleAuthHandled) return;
  if (!session) return;

  const provider = session.user?.app_metadata?.provider;
  if (provider !== "google") return;

  _googleAuthHandled = true;

  try {
    const profile = await dbLoadUser(session.user.id);

    if (profile && profile.__loadError) {
      _googleAuthHandled = false;
      toast("خطأ في تحميل بياناتك، حاول مجدداً", "error");
      return;
    }

    if (profile) {
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
      // حساب جديد أو بياناته محذوفة — أظهر نافذة الإعداد
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
    console.error("خطأ في _handleGoogleSession:", err);
    _googleAuthHandled = false; // إعادة تعيين ليتمكن المستخدم من المحاولة مجدداً
    toast("حدث خطأ في تحميل البيانات، حاول مجدداً", "error");
  }
}

// 1. تحقق فوري عند تحميل الصفحة (لجلسات موجودة مسبقاً)
(async function checkGoogleSession() {
  try {
    const {
      data: { session },
    } = await _supabase.auth.getSession();
    if (!session) return;

    const provider = session.user?.app_metadata?.provider;

    if (provider === "google") {
      await _handleGoogleSession(session);
      return;
    }

    // ✅ إيميل عادي فقط — لا نسجّل خروج provider غير معروف
    if (provider === "email") {
      const profile = await dbLoadUser(session.user.id);
      if (profile && profile.__loadError) {
        toast("خطأ في تحميل بياناتك، حاول تحديث الصفحة", "error");
      } else if (profile) {
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
        await _supabase.auth.signOut();
        toast("حسابك غير مكتمل — يرجى التسجيل من جديد", "error");
      }
    }
    // provider غير معروف → لا نفعل شيء، onAuthStateChange سيتعامل معه
  } catch (err) {
    console.error("Session check error:", err);
  }
})();

// 2. مستمع Auth — يمسك OAuth redirect بعد رجوع Google
_supabase.auth.onAuthStateChange(async function (event, session) {
  try {
    // نتجاهل كل شيء إلا SIGNED_IN القادم من OAuth
    if (event !== "SIGNED_IN") return;
    if (!session) return;
    // لو المستخدم محمّل بالفعل من IIFE نتجاهل
    if (user) return;

    const provider = session.user?.app_metadata?.provider;
    if (provider !== "google") return;

    await _handleGoogleSession(session);
  } catch (err) {
    console.error("Auth state change error:", err);
  }
});

async function handleGoogleSignIn() {
  const btn = document.getElementById("googleSignInBtn");
  const inner = document.getElementById("googleBtnInner");
  const spinner = document.getElementById("googleSpinner");
  btn.disabled = true;
  inner.style.display = "none";
  spinner.style.display = "flex";
  try {
    const { error: error } = await _supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://minassa-dirasa.vercel.app",
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      toast("خطأ في الاتصال بـ Google: " + error.message, "error");
      btn.disabled = false;
      inner.style.display = "flex";
      spinner.style.display = "none";
    }
  } catch (err) {
    toast("خطأ: " + err.message, "error");
    btn.disabled = false;
    inner.style.display = "flex";
    spinner.style.display = "none";
  }
}

function openGoogleSetupModal() {
  const modal = document.getElementById("googleSetupModal");
  if (!modal) {
    console.error("googleSetupModal غير موجود في الـ DOM");
    return;
  }
  modal.style.display = "flex";
  const authArea = document.getElementById("authArea");
  if (authArea) authArea.classList.add("hidden");
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
  if (pass.length < 8)
    return toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "error");
  const session =
    _googlePendingSession || (await _supabase.auth.getSession()).data.session;
  if (!session) return toast("انتهت صلاحية الجلسة، حاول مرة أخرى", "error");
  toast("جاري إنشاء ملفك الشخصي...", "info");
  const { error: pwErr } = await _supabase.auth.updateUser({
    password: pass,
  });
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
    return toast("خطأ في إنشاء الملف الشخصي: " + profileError.message, "error");
  }
  user = {
    id: uid,
    name: name,
    school: school,
    email: session.user.email,
    data: defaultData,
  };
  _googlePendingSession = null;
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

function togglePassVis(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';

  var svg = btn.querySelector('svg');
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

var _loginAttempts = 0;
var _loginLockUntil = 0;

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
    if (isDisposableEmail(email))
      return toast(
        "الإيميلات المؤقتة غير مقبولة — أدخل بريدك الحقيقي 📧",
        "error",
      );
    if (pass.length < 8)
      return toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "error");
    toast("جاري إنشاء الحساب...", "info");
    const { data: authData, error: authError } = await _supabase.auth.signUp({
      email: email,
      password: pass,
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return toast("هذا الإيميل مسجل مسبقاً — جرّب تسجيل الدخول", "error");
      }
      return toast("خطأ: " + authError.message, "error");
    }

    // حفظ بيانات التسجيل مؤقتاً لحين التحقق من الإيميل
    _pendingRegData = {
      uid: authData.user?.id || null,
      name: name,
      school: school,
      email: email,
    };

    // إظهار شاشة كود التفعيل
    showOtpScreen(email);
  } else {
    if (Date.now() < _loginLockUntil) {
      var secs = Math.ceil((_loginLockUntil - Date.now()) / 1000);
      return toast("محاولات كثيرة. انتظر " + secs + " ثانية", "error");
    }
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("pass").value;
    toast("جاري تسجيل الدخول...", "info");
    const { data: authData, error: authError } =
      await _supabase.auth.signInWithPassword({
        email: email,
        password: pass,
      });
    if (authError) {
      _loginAttempts++;
      if (_loginAttempts >= 5) {
        _loginLockUntil = Date.now() + 30000;
        _loginAttempts = 0;
        return toast("تجاوزت الحد. انتظر 30 ثانية", "error");
      }
      if (authError.message.includes("Email not confirmed")) {
        // حساب موجود لكن غير مفعّل — أعد إرسال كود التفعيل
        await _supabase.auth.resend({ type: "signup", email: email });
        _pendingRegData = { uid: null, name: "", school: "", email: email };
        showOtpScreen(email);
        return toast("حسابك غير مفعّل — أرسلنا كود تفعيل إلى بريدك", "info");
      }
      if (authError.message.includes("Invalid login"))
        return toast("البريد الإلكتروني أو كلمة المرور غير صحيحة", "error");
      return toast("خطأ: " + authError.message, "error");
    }
    _loginAttempts = 0;
    const uid = authData.user.id;
    const profile = await dbLoadUser(uid);
    if (profile && profile.__loadError) {
      return toast(
        "خطأ في تحميل بياناتك، تحقق من اتصالك وحاول مجدداً",
        "error",
      );
    }
    if (!profile) {
      // حساب مفعّل لكن بدون ملف شخصي — حالة نادرة، نسجّل الخروج ونخبره
      await _supabase.auth.signOut();
      return toast(
        "حسابك غير مكتمل — سجّل من جديد لإتمام إنشاء ملفك الشخصي",
        "error",
      );
    }
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
  var _sp = document.getElementById("settingsPage");
  if (_sp) {
    _sp.classList.remove("sp-active");
    _sp.setAttribute("aria-hidden", "true");
  }
  var _chk = document.getElementById("hamburgerCheck");
  var _sb = document.getElementById("mainSidebar");
  var _ov = document.getElementById("sidebarOverlay");
  if (_chk) {
    _chk.checked = false;
    _chk.setAttribute("aria-expanded", "false");
  }
  if (_sb) _sb.classList.remove("open");
  if (_ov) _ov.classList.remove("active");
  document.body.classList.remove("sidebar-open");
  var _cs = document.getElementById("comingSoonPage");
  if (_cs) {
    _cs.style.display = "none";
    _cs.setAttribute("aria-hidden", "true");
  }
  var _radioHome = document.getElementById("radio-home");
  if (_radioHome) _radioHome.checked = true;
  var _mainEl = document.querySelector("main");
  if (_mainEl) _mainEl.style.display = "";
  document.querySelectorAll(".orb").forEach(function (o) {
    o.style.display = "";
  });
  var _navIds = [
    "arrowNav",
    "sectionDots",
    "sectionNav",
    "guideFloatBtn",
    "searchGroup",
    "focusModeToggle",
  ];
  _navIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.removeProperty("display");
  });
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
  var tagline = document.getElementById("landingTagline");
  if (tagline) tagline.style.display = "flex";
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
  var gw = document.getElementById("googleAuthWrap");
  if (gw) {
    gw.style.display = "block";
    gw.style.opacity = "";
    gw.style.transform = "";
  }
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

function initDashboard() {
  document.getElementById("authArea").classList.add("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");
  document.getElementById("exportDataBtn").classList.remove("hidden");
  document.getElementById("importDataBtn").classList.remove("hidden");
  document.getElementById("themeBar").classList.add("visible");
  document.getElementById("mainTitle").textContent = user.school;
  document.getElementById("displaySchool").textContent =
    `طالب: ${user.name}  •  ${user.school}`;
  var tagline = document.getElementById("landingTagline");
  if (tagline) tagline.style.display = "none";
  const skeleton = document.getElementById("skeletonLoader");
  if (skeleton) skeleton.classList.add("visible");
  setTimeout(function () {
    applyResponsive();
    renderTable();
    renderList("todo");
    renderList("note");
    renderStats();
    renderExams();
    renderResources();
    var _uiSettings;
    try {
      _uiSettings = JSON.parse(localStorage.getItem("dirasat_ui_settings"));
    } catch (e) {
      _uiSettings = null;
    }
    applyTheme((_uiSettings && _uiSettings.theme) || "blue");
    updateDots();
    resetPomo();
    initClockTickSetting();
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

function renderTable() {
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const body = document.getElementById("tableBody");
  body.innerHTML = "";
  const pBtn = document.getElementById("practicalSettingsBtn");
  if (pBtn) pBtn.style.display = currentTab === "schedule" ? "flex" : "none";
  const rBtn = document.getElementById("resetScheduleBtn");
  if (rBtn) rBtn.style.display = "flex";
  const printBtn = document.getElementById("printScheduleBtn");
  if (printBtn)
    printBtn.style.display = currentTab === "schedule" ? "flex" : "none";
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
  user.data.practicalSessions[key1] = {
    sub1: sub1Raw,
    sub2: sub2Raw,
  };
  if (duration === 2) {
    let next = slotIdx + 1;
    if (next === 4) next = 5;
    const key2 = `practical_${dIdx}_${next}`;
    user.data.practicalSessions[key2] = {
      sub1: sub1Raw,
      sub2: sub2Raw,
    };
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

function renderList(type) {
  const list = document.getElementById(`${type}List`);
  const items = user.data[type + "s"] || [];
  if (type === "todo") {
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="es-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
          </svg>
        </div>
        <div class="es-title">ما في مهام — خذ استراحة </div>
        <div class="es-sub">أضف مهمتك الأولى وابدأ يومك بخطوة واثقة!</div>
      </div>`;
    } else {
      list.innerHTML = items
        .map(
          (item, idx) =>
            `\n                <div class="todo-item">\n                    <input type="checkbox" ${item.completed ? "checked" : ""} onchange="toggleComplete(${idx})">\n                    <span style="font-size:13.5px; font-family:var(--font-body); flex:1; ${item.completed ? "text-decoration:line-through; color:var(--muted); opacity:0.65;" : "color:var(--text);"}">${escHtml(item.text)}</span>\n                    <button class="todo-del-btn" onclick="removeItem('todo',${idx},'${escHtml(item.text).substring(0, 20)}')" aria-label="حذف المهمة"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>\n                </div>\n            `,
        )
        .join("");
    }
    updateProgress();
  } else {
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <div class="es-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </div>
        <div class="es-title">صفحتك نظيفة </div>
        <div class="es-sub">سجّل أفكارك وملاحظاتك الدراسية — كل فكرة تستحق أن تُحفظ!</div>
      </div>`;
    } else {
      list.innerHTML = items
        .map(
          (item, idx) =>
            `\n                <div class="note-card">\n                    <button class="glass-del-btn" onclick="removeItem('note',${idx},'ملاحظة')" aria-label="حذف الملاحظة" style="position:absolute;top:12px;left:12px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>\n                    <p>${escHtml(typeof item === "string" ? item : item.text)}</p>\n                    <time>${typeof item === "object" && item.date ? item.date : ""}</time>\n                </div>\n            `,
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

function sanitizeUrl(url) {
  if (!url) return "#";
  var trimmed = url.trim().toLowerCase();
  var blocked = ["javascript:", "data:", "vbscript:", "blob:"];
  for (var i = 0; i < blocked.length; i++) {
    if (trimmed.startsWith(blocked[i])) return "#";
  }
  return url;
}

function addItem(type) {
  const inp = document.getElementById(`${type}Inp`);
  const val = inp.value.trim();
  if (!val) {
    inp.focus();
    return;
  }
  if (type === "todo") {
    user.data.todos.push({
      text: val,
      completed: false,
    });
  } else {
    user.data.notes.push({
      text: val,
      date: formatNow(),
    });
  }
  inp.value = "";
  saveUser();
  renderList(type);
  inp.focus();
}

function toggleComplete(idx) {
  var wasCompleted = user.data.todos[idx].completed;
  user.data.todos[idx].completed = !wasCompleted;
  saveUser();
  // Fire confetti only when marking as DONE
  if (!wasCompleted) {
    var cb = document.querySelector(
      '#todoList input[type="checkbox"]:nth-of-type(' + (idx + 1) + ")",
    );
    var rect = cb
      ? cb.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
    triggerConfetti(rect.left + 8, rect.top + 8);
  }
  renderList("todo");
}

function triggerConfetti(cx, cy) {
  var colors = [
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#f43f5e",
    "#a78bfa",
    "#06b6d4",
    "#10b981",
  ];
  var count = 14;
  for (var i = 0; i < count; i++) {
    (function (i) {
      var p = document.createElement("div");
      p.className = "confetti-particle";
      var angle = (i / count) * 2 * Math.PI;
      var dist = 40 + Math.random() * 55;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist - 20;
      p.style.cssText = [
        "left:" + (cx - 3.5) + "px",
        "top:" + (cy - 3.5) + "px",
        "background:" + colors[i % colors.length],
        "--dx:" + dx.toFixed(1) + "px",
        "--dy:" + dy.toFixed(1) + "px",
        "animation-delay:" + (Math.random() * 0.08).toFixed(3) + "s",
      ].join(";");
      document.body.appendChild(p);
      setTimeout(function () {
        p.remove();
      }, 800);
    })(i);
  }
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

function renderStats() {
  /* قسم الإحصائيات محذوف نهائياً */
}
var _pomoSettingsSnapshot = null;

function togglePomoSettings() {
  var panel = document.getElementById("pomoSettings");
  var isOpening = !panel.classList.contains("open");
  panel.classList.toggle("open");

  if (isOpening) {
    _pomoSettingsSnapshot = {
      study: config.study,
      breakTime: config.break,
      sessions: config.sessions,
      longBreak: config.longBreak,
      clockTick: clockTickEnabled,
      autoPomo: autoPomoEnabled,
      alarmSound: alarmSoundEnabled,
      absFocus: pomoAbsoluteFocusEnabled,
      breakAlarmFile: _breakAlarmFile,
      studyAlarmFile: _studyAlarmFile,
      breakAlarmVol: _breakAlarmVol,
      studyAlarmVol: _studyAlarmVol,
    };
    // Sync all sliders/values/dropdowns with live config
    _syncPsSliders();
    // Sync new toggles
    var autoT = document.getElementById("autoPomoToggle");
    var alarmT = document.getElementById("alarmSoundToggle");
    var focusT = document.getElementById("pomoFocusModeToggle");
    if (autoT) autoT.checked = autoPomoEnabled;
    if (alarmT) alarmT.checked = alarmSoundEnabled;
    if (focusT) focusT.checked = pomoAbsoluteFocusEnabled;
    _updateSoundColState();
  }
}

function cancelPomoSettings() {
  if (_pomoSettingsSnapshot) {
    clockTickEnabled = _pomoSettingsSnapshot.clockTick;
    try {
      localStorage.setItem("pomoClockTick", String(clockTickEnabled));
    } catch (e) {}
    var toggle = document.getElementById("clockTickToggle");
    if (toggle) toggle.checked = clockTickEnabled;

    // Restore new settings
    autoPomoEnabled = _pomoSettingsSnapshot.autoPomo;
    alarmSoundEnabled = _pomoSettingsSnapshot.alarmSound;
    pomoAbsoluteFocusEnabled = _pomoSettingsSnapshot.absFocus;
    _breakAlarmFile = _pomoSettingsSnapshot.breakAlarmFile;
    _studyAlarmFile = _pomoSettingsSnapshot.studyAlarmFile;
    _breakAlarmVol = _pomoSettingsSnapshot.breakAlarmVol;
    _studyAlarmVol = _pomoSettingsSnapshot.studyAlarmVol;

    var autoT = document.getElementById("autoPomoToggle");
    var alarmT = document.getElementById("alarmSoundToggle");
    var focusT = document.getElementById("pomoFocusModeToggle");
    if (autoT) autoT.checked = autoPomoEnabled;
    if (alarmT) alarmT.checked = alarmSoundEnabled;
    if (focusT) focusT.checked = pomoAbsoluteFocusEnabled;
    _updateSoundColState();
    _syncPsSliders();

    _pomoSettingsSnapshot = null;
  }
  document.getElementById("pomoSettings").classList.remove("open");
  toast("تم إلغاء الإعدادات — لم يُحفظ أي تغيير", "cancel");
}

function _showPomoNextSessionNotice() {
  var existing = document.getElementById("pomoNextSessionNotice");
  if (existing) existing.remove();
  var notice = document.createElement("p");
  notice.id = "pomoNextSessionNotice";
  notice.textContent =
    "✓ التغييرات ستُطبَّق على الجلسة القادمة فقط — جلستك الحالية لن تتأثر";
  notice.style.cssText =
    "font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #f59e0b;" +
    "border-radius:8px;padding:8px 12px;text-align:center;margin-top:10px;" +
    "transition:opacity 0.5s;opacity:1;";
  var settingsForm =
    document.querySelector("#pomoSettings .pomo-settings-form") ||
    document.querySelector("#pomoSettings");
  if (settingsForm) settingsForm.appendChild(notice);
  setTimeout(function () {
    notice.style.opacity = "0";
    setTimeout(function () {
      if (notice.parentNode) notice.remove();
    }, 500);
  }, 3500);
}

function savePomoSettings() {
  if (isRunning) {
    toast("اضغط إلغاء أولاً ثم أوقف المؤقت قبل تغيير الإعدادات ⚠️", "error");
    return;
  }

  var timerInProgress = timeLeft > 0 && timeLeft < config.study * 60;
  var savedTimeLeft = timeLeft;

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

  // Save new settings
  autoPomoEnabled = document.getElementById("autoPomoToggle")?.checked ?? true;
  alarmSoundEnabled =
    document.getElementById("alarmSoundToggle")?.checked ?? true;
  pomoAbsoluteFocusEnabled =
    document.getElementById("pomoFocusModeToggle")?.checked ?? false;
  try {
    localStorage.setItem("pomoAutoPomodoro", String(autoPomoEnabled));
    localStorage.setItem("pomoAlarmSound", String(alarmSoundEnabled));
    localStorage.setItem("pomoAbsFocus", String(pomoAbsoluteFocusEnabled));
    localStorage.setItem("pomoBreakAlarmFile", _breakAlarmFile);
    localStorage.setItem("pomoStudyAlarmFile", _studyAlarmFile);
    localStorage.setItem("pomoBreakAlarmVol", String(_breakAlarmVol));
    localStorage.setItem("pomoStudyAlarmVol", String(_studyAlarmVol));
    // Save timer config
    localStorage.setItem("pomoStudyTime", String(config.study));
    localStorage.setItem("pomoBreakTime", String(config.break));
    localStorage.setItem("pomoSessions", String(config.sessions));
    localStorage.setItem("pomoLongBreak", String(config.longBreak));
  } catch (e) {}
  _updateSoundColState();

  if (timerInProgress) {
    timeLeft = savedTimeLeft;
    updateTimerDisplay();
    updateDots();
    togglePomoSettings();
    _showPomoNextSessionNotice();
    toast("تم تحديث الإعدادات ✓", "success");
  } else {
    resetPomo();
    togglePomoSettings();
    toast("تم تحديث الإعدادات ✓", "success");
  }
}

let _pomoStartTimestamp = null;

let _pomoStartTimeLeft = 0;

let _lastTickSecond = -1;

function toggleTimer() {
  if (isRunning) {
    const elapsed = _pomoStartTimestamp
      ? Math.floor((Date.now() - _pomoStartTimestamp) / 1e3)
      : 0;
    timeLeft = Math.max(0, _pomoStartTimeLeft - elapsed);
    clearInterval(timerInterval);
    _pomoStartTimestamp = null;
    _stopClockTick();
    document.getElementById("startBtnInner").textContent = "استئناف";
    // Sync abs focus pause button
    var absPauseBtn = document.getElementById("absFocusPauseBtn");
    if (absPauseBtn && typeof _setAbsPauseBtnState === "function") _setAbsPauseBtnState(true);
  } else {
    requestNotificationPermission();
    _pomoStartTimestamp = Date.now();
    _pomoStartTimeLeft = timeLeft;
    _lastTickSecond = -1;
    timerInterval = setInterval(tick, 250);
    _startClockTick();
    document.getElementById("startBtnInner").textContent = "توقف مؤقت";
    // Activate abs focus when manually starting a study session
    if (pomoMode === "study" && pomoAbsoluteFocusEnabled) {
      _enterAbsFocus();
    }
    // Sync abs focus pause button
    var absPauseBtn = document.getElementById("absFocusPauseBtn");
    if (absPauseBtn && typeof _setAbsPauseBtnState === "function") _setAbsPauseBtnState(false);
  }
  isRunning = !isRunning;
}

function tick() {
  if (!_pomoStartTimestamp) return;
  const elapsed = Math.floor((Date.now() - _pomoStartTimestamp) / 1e3);
  const newTimeLeft = Math.max(0, _pomoStartTimeLeft - elapsed);
  const currentSecond = elapsed;
  if (currentSecond === _lastTickSecond) return;
  _lastTickSecond = currentSecond;
  timeLeft = newTimeLeft;
  updateTimerDisplay();
  if (newTimeLeft > 0) {
    if (pomoMode === "study" && user) {
      const today = new Date().toISOString().slice(0, 10);
      if (!user.data.studyLog) user.data.studyLog = {};
      user.data.studyLog[today] = (user.data.studyLog[today] || 0) + 1;
      if (!user.data.totalPomoSec) user.data.totalPomoSec = 0;
      user.data.totalPomoSec += 1;
      if (elapsed % 60 === 0) {
        saveUser();
        renderStats();
      } else {
        if (elapsed % 10 === 0) updateDashHeader();
      }
    }
  } else {
    clearInterval(timerInterval);
    _pomoStartTimestamp = null;
    handleModeSwitch();
  }
}

document.addEventListener("visibilitychange", function () {
  if (
    document.visibilityState === "visible" &&
    isRunning &&
    _pomoStartTimestamp
  ) {
    const elapsed = Math.floor((Date.now() - _pomoStartTimestamp) / 1e3);
    const newTimeLeft = Math.max(0, _pomoStartTimeLeft - elapsed);
    if (newTimeLeft === 0) {
      clearInterval(timerInterval);
      _pomoStartTimestamp = null;
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
      timeLeft = 0;
      updateTimerDisplay();
      handleModeSwitch();
    } else {
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
  var wasStudy = pomoMode === "study";

  // Flash visual always; file alarm when enabled
  playChime();
  if (alarmSoundEnabled) _playAlarmFile(wasStudy);
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  if (pomoMode === "study") {
    saveUser();
    renderStats();
    if (currentSession < config.sessions) {
      pomoMode = "shortBreak";
      timeLeft = config.break * 60;
      document.getElementById("pomoLabel").innerHTML =
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> استراحة قصيرة';
      toast("وقت استراحة قصيرة! استرح قليلاً ☕", "info");
      sendPomoNotification(
        "⏸️ استراحة قصيرة!",
        "أحسنت! خذ استراحة قصيرة قبل العودة للدراسة ☕",
      );
    } else {
      pomoMode = "longBreak";
      timeLeft = config.longBreak * 60;
      document.getElementById("pomoLabel").innerHTML =
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> استراحة طويلة';
      toast("أحسنت! وقت الاستراحة الطويلة 🌟", "success");
      sendPomoNotification(
        "🎉 انتهت الدورة!",
        "أحسنت! استحققت استراحة طويلة. ارتاح جيداً 🌟",
      );
    }
    // Exit absolute focus when study ends
    _exitAbsFocus();
  } else if (pomoMode === "shortBreak") {
    currentSession++;
    pomoMode = "study";
    timeLeft = config.study * 60;
    document.getElementById("pomoLabel").innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> جلسة تركيز';
    toast("عد للدراسة! يمكنك ذلك 💪", "info");
    sendPomoNotification(
      "🎯 عودة للدراسة!",
      "انتهت الاستراحة — حان وقت التركيز 💪",
    );
  } else {
    currentSession = 1;
    pomoMode = "study";
    timeLeft = config.study * 60;
    document.getElementById("pomoLabel").innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> جلسة تركيز';
    toast("دورة جديدة بدأت! 🚀", "success");
    sendPomoNotification(
      "🚀 دورة جديدة!",
      "استراحتك انتهت — دورة جديدة بدأت، يمكنك ذلك!",
    );
  }
  updateModeIndicator();
  updateDots();
  updateTimerDisplay();
  clearInterval(timerInterval);

  // Auto-pomodoro: when break ends, auto-start only if enabled
  if (pomoMode !== "study" || autoPomoEnabled) {
    isRunning = true;
    _pomoStartTimestamp = Date.now();
    _pomoStartTimeLeft = timeLeft;
    _lastTickSecond = -1;
    timerInterval = setInterval(tick, 250);
    if (pomoMode === "study") {
      _startClockTick();
      // Absolute focus mode: activate when study begins
      if (pomoAbsoluteFocusEnabled) _enterAbsFocus();
    } else {
      _stopClockTick();
    }
    document.getElementById("startBtnInner").textContent = "توقف مؤقت";
  } else {
    // autoPomodoro OFF and it's study time — wait for user
    isRunning = false;
    _pomoStartTimestamp = null;
    _stopClockTick();
    document.getElementById("startBtnInner").textContent = "ابدأ الآن";
    toast("الاستراحة انتهت — اضغط 'ابدأ الآن' للبدء 🎯", "info");
  }
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
  const display = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  document.getElementById("pomoTimer").textContent = display;
  // Sync absolute focus overlay
  var absTim = document.getElementById("absFocusTimerDisp");
  if (absTim) absTim.textContent = display;
  var absLbl = document.getElementById("absFocusLabel");
  var mainLbl = document.getElementById("pomoLabel");
  if (absLbl && mainLbl) absLbl.textContent = mainLbl.textContent;
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
  _stopClockTick();
  updateTimerDisplay();
  updateDots();
  updateModeIndicator();
  document.getElementById("startBtnInner").textContent = "ابدأ الآن";
  document.getElementById("pomoLabel").innerHTML =
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> جلسة دراسة';
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
  // Visual flash only — actual audio is handled by _playAlarmFile() in handleModeSwitch
  const flash = document.createElement("div");
  flash.style.cssText =
    "position:fixed;inset:0;z-index:9999;pointer-events:none;background:rgba(59,130,246,0.18);animation:pomoFlash 0.7s ease-out forwards;";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 750);
}

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
        chillSounds[type] = {
          audio: audio,
        };
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
  const entry = {
    source: source,
    gain: gain,
  };
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

const canvas = document.getElementById("starsCanvas");

const ctx = canvas.getContext("2d");

let stars = [];

function initStars() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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
  // خلفية سوداء أساسية
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // توهج أزرق في المنتصف الأسفل — أقوى من السابق
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

(function () {
  var SECTIONS = [
    {
      id: "sec-schedule",
      btnId: "snav-schedule",
    },
    {
      id: "sec-pomodoro",
      btnId: "snav-pomodoro",
    },
    {
      id: "sec-tasks",
      btnId: "snav-tasks",
    },
    {
      id: "sec-notes",
      btnId: "snav-combined-info",
    },

    {
      id: "sec-exams",
      btnId: "snav-combined-grades",
    },
  ];
  function scrollToSection(sectionId) {
    var el = document.getElementById(sectionId);
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({
      top: top,
      behavior: "smooth",
    });
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
    window.addEventListener("scroll", updateActiveNav, {
      passive: true,
    });
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

function exportSchedule(format, mode) {
  if (!user) return;
  if (format === "png" && !mode) {
    showPngExportModal();
    return;
  }
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
  const DPR = 2;
  const COL_DAY = 100;
  const COL_BREAK = 52;
  const COL_W = 108;
  const ROW_H = 52;
  const HEADER_H = 48;
  const TITLE_H = 54;
  const PADDING = 24;
  const FOOT_H = 32;
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
  const C =
    mode === "light"
      ? {
          bg: "#ffffff",
          surface: "#f8fafc",
          border: "rgba(0,0,0,0.08)",
          text: "#1e293b",
          muted: "#94a3b8",
          cyan: "#0891b2",
          blue: "#2563eb",
          blueLight: "rgba(59,130,246,0.1)",
          amber: "#d97706",
          green: "#059669",
          breakBg: "rgba(0,0,0,0.05)",
          dayBg: "rgba(6,182,212,0.07)",
          headerBg: "rgba(0,0,0,0.02)",
          outerStroke: "rgba(0,0,0,0.1)",
          dateFill: "rgba(0,0,0,0.4)",
          dividerStroke: "rgba(0,0,0,0.08)",
          rowAltBg: "rgba(0,0,0,0.015)",
          emptyCell: "rgba(0,0,0,0.02)",
          fallbackCellBg: "rgba(0,0,0,0.06)",
          fallbackCellText: "#475569",
          rowDivider: "rgba(0,0,0,0.06)",
          colDivider: "rgba(0,0,0,0.08)",
          footerFill: "rgba(0,0,0,0.35)",
          subjectColors: {
            رياضيات: { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" },
            فيزياء: { bg: "rgba(168,85,247,0.12)", text: "#7c3aed" },
            علوم: { bg: "rgba(16,185,129,0.12)", text: "#065f46" },
            عربية: { bg: "rgba(245,158,11,0.12)", text: "#92400e" },
            فرنسية: { bg: "rgba(239,68,68,0.12)", text: "#991b1b" },
            إنجليزية: { bg: "rgba(14,165,233,0.12)", text: "#0369a1" },
            "تاريخ/جغرافيا": { bg: "rgba(234,88,12,0.12)", text: "#9a3412" },
            فلسفة: { bg: "rgba(99,102,241,0.12)", text: "#3730a3" },
            إسلامية: { bg: "rgba(20,184,166,0.12)", text: "#115e59" },
            "إعلام آلي": { bg: "rgba(6,182,212,0.12)", text: "#155e75" },
            تكنلوجيا: { bg: "rgba(251,191,36,0.12)", text: "#78350f" },
          },
        }
      : {
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
          outerStroke: "rgba(255,255,255,0.1)",
          dateFill: "rgba(255,255,255,0.3)",
          dividerStroke: "rgba(255,255,255,0.07)",
          rowAltBg: "rgba(255,255,255,0.01)",
          emptyCell: "rgba(255,255,255,0.02)",
          fallbackCellBg: "rgba(255,255,255,0.08)",
          fallbackCellText: "#cbd5e1",
          rowDivider: "rgba(255,255,255,0.04)",
          colDivider: "rgba(255,255,255,0.05)",
          footerFill: "rgba(255,255,255,0.18)",
          subjectColors: {
            رياضيات: {
              bg: "rgba(59,130,246,0.18)",
              text: "#93c5fd",
            },
            فيزياء: {
              bg: "rgba(168,85,247,0.18)",
              text: "#d8b4fe",
            },
            علوم: {
              bg: "rgba(16,185,129,0.18)",
              text: "#6ee7b7",
            },
            عربية: {
              bg: "rgba(245,158,11,0.18)",
              text: "#fcd34d",
            },
            فرنسية: {
              bg: "rgba(239,68,68,0.18)",
              text: "#fca5a5",
            },
            إنجليزية: {
              bg: "rgba(14,165,233,0.18)",
              text: "#7dd3fc",
            },
            "تاريخ/جغرافيا": {
              bg: "rgba(234,88,12,0.18)",
              text: "#fdba74",
            },
            فلسفة: {
              bg: "rgba(99,102,241,0.18)",
              text: "#c7d2fe",
            },
            إسلامية: {
              bg: "rgba(20,184,166,0.18)",
              text: "#99f6e4",
            },
            "إعلام آلي": {
              bg: "rgba(6,182,212,0.18)",
              text: "#67e8f9",
            },
            تكنلوجيا: {
              bg: "rgba(251,191,36,0.18)",
              text: "#fde68a",
            },
          },
        };
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
  ctx.fillStyle = C.bg;
  roundRect(0, 0, canvasW, canvasH, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  roundRect(PADDING / 2, PADDING / 2, canvasW - PADDING, canvasH - PADDING, 14);
  ctx.stroke();
  const titleY = PADDING + TITLE_H / 2;
  ctx.fillStyle = C.blue;
  ctx.font = `900 20px Cairo, Arial`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(`📅 ${tabLabel}`, canvasW - PADDING - 12, titleY);
  ctx.fillStyle = C.muted;
  ctx.font = "400 11px Tajawal, Arial";
  ctx.textAlign = "left";
  ctx.fillText(`${user.name} — ${user.school}`, PADDING + 12, titleY - 6);
  const dateStr = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "400 10px Tajawal, Arial";
  ctx.fillText(dateStr, PADDING + 12, titleY + 8);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, PADDING + TITLE_H);
  ctx.lineTo(canvasW - PADDING, PADDING + TITLE_H);
  ctx.stroke();
  const hdrY = PADDING + TITLE_H;
  timeSlots.forEach((label, i) => {
    const ci = i + 1;
    const x = colX(ci);
    const w = totalCols[ci];
    const cx = x + w / 2;
    const cy = hdrY + HEADER_H / 2;
    ctx.fillStyle = i === 4 ? C.breakBg : C.headerBg;
    ctx.fillRect(x, hdrY, w, HEADER_H);
    ctx.fillStyle = i === 4 ? C.muted : C.muted;
    ctx.font = `600 ${i === 4 ? 10 : 11}px Tajawal, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);
  });
  ctx.fillStyle = C.dayBg;
  ctx.fillRect(colX(0), hdrY, totalCols[0], HEADER_H);
  ctx.fillStyle = C.muted;
  ctx.font = "600 11px Tajawal, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("اليوم", colX(0) + totalCols[0] / 2, hdrY + HEADER_H / 2);
  days.forEach((day, dIdx) => {
    const rowY = hdrY + HEADER_H + dIdx * ROW_H;
    const rowBg = dIdx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent";
    ctx.fillStyle = rowBg;
    ctx.fillRect(PADDING, rowY, tableW, ROW_H);
    ctx.fillStyle = C.dayBg;
    ctx.fillRect(colX(0), rowY, totalCols[0], ROW_H);
    ctx.fillStyle = C.cyan;
    ctx.font = "700 12px Tajawal, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(day, colX(0) + totalCols[0] / 2, rowY + ROW_H / 2);
    for (let i = 0; i < 8; i++) {
      const ci = i + 1;
      const x = colX(ci);
      const w = totalCols[ci];
      const cy = rowY + ROW_H / 2;
      const cx = x + w / 2;
      if (i === 4) {
        ctx.fillStyle = C.breakBg;
        ctx.fillRect(x, rowY, w, ROW_H);
        ctx.fillStyle = C.muted;
        ctx.font = "400 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("☕", cx, cy);
        continue;
      }
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
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        ctx.fillRect(x + 2, rowY + 2, w - 4, ROW_H - 4);
      } else {
        const pair = C.subjectColors[cellText.split(" / ")[0]] || {
          bg: "rgba(255,255,255,0.08)",
          text: "#cbd5e1",
        };
        const bgC = isPract ? "rgba(6,182,212,0.10)" : pair.bg;
        const txC = isPract ? C.cyan : pair.text;
        ctx.fillStyle = bgC;
        roundRect(x + 4, rowY + 6, w - 8, ROW_H - 12, 7);
        ctx.fill();
        ctx.fillStyle = txC;
        drawTextRTL(cellText, cx, cy, w);
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, rowY + ROW_H);
    ctx.lineTo(canvasW - PADDING, rowY + ROW_H);
    ctx.stroke();
  });
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let ci = 0; ci <= totalCols.length; ci++) {
    const x = colX(ci);
    ctx.beginPath();
    ctx.moveTo(x, hdrY);
    ctx.lineTo(x, hdrY + HEADER_H + days.length * ROW_H);
    ctx.stroke();
  }
  const footY = canvasH - PADDING - FOOT_H / 2;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = "400 10px Tajawal, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("منصة دراسة • تم التصدير بتاريخ " + dateStr, canvasW / 2, footY);
  const fileName = `جدول-${user.name}-${currentTab === "schedule" ? "حصص" : "فروض"}`;
  if (format === "png") {
    cv.toBlob(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2e3);
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
    const { jsPDF: jsPDF } = window.jspdf || window;
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

function showPngExportModal() {
  var modal = document.getElementById("pngExportModal");
  if (!modal) return;
  modal.classList.add("open");
  // Generate small preview canvases
  setTimeout(function () {
    ["dark", "light"].forEach(function (mode) {
      var img = document.getElementById("pngPreview_" + mode);
      if (!img) return;
      var preview = _buildSchedulePreview(mode);
      img.src = preview;
    });
  }, 80);
}

function closePngExportModal() {
  var modal = document.getElementById("pngExportModal");
  if (modal) modal.classList.remove("open");
}

function confirmPngExport() {
  var selected = document.querySelector('input[name="pngMode"]:checked');
  if (!selected) return;
  closePngExportModal();
  exportSchedule("png", selected.value);
}

function _buildSchedulePreview(mode) {
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
  var DPR = 1;
  var COL_DAY = 54,
    COL_BREAK = 28,
    COL_W = 58;
  var ROW_H = 28,
    HEADER_H = 26,
    TITLE_H = 30,
    PADDING = 12,
    FOOT_H = 18;
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
  var ctx = cv.getContext("2d");
  ctx.scale(DPR, DPR);
  var C =
    mode === "light"
      ? {
          bg: "#ffffff",
          text: "#1e293b",
          muted: "#94a3b8",
          cyan: "#0891b2",
          blue: "#2563eb",
          breakBg: "rgba(0,0,0,0.05)",
          dayBg: "rgba(6,182,212,0.07)",
          headerBg: "rgba(0,0,0,0.02)",
          subjectColors: {
            رياضيات: { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" },
            فيزياء: { bg: "rgba(168,85,247,0.12)", text: "#7c3aed" },
            علوم: { bg: "rgba(16,185,129,0.12)", text: "#065f46" },
            عربية: { bg: "rgba(245,158,11,0.12)", text: "#92400e" },
            فرنسية: { bg: "rgba(239,68,68,0.12)", text: "#991b1b" },
            إنجليزية: { bg: "rgba(14,165,233,0.12)", text: "#0369a1" },
            "تاريخ/جغرافيا": { bg: "rgba(234,88,12,0.12)", text: "#9a3412" },
            فلسفة: { bg: "rgba(99,102,241,0.12)", text: "#3730a3" },
            إسلامية: { bg: "rgba(20,184,166,0.12)", text: "#115e59" },
            "إعلام آلي": { bg: "rgba(6,182,212,0.12)", text: "#155e75" },
            تكنلوجيا: { bg: "rgba(251,191,36,0.12)", text: "#78350f" },
          },
        }
      : {
          bg: "#0d1424",
          text: "#f1f5f9",
          muted: "#64748b",
          cyan: "#06b6d4",
          blue: "#3b82f6",
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
  function rr(x, y, w, h, r) {
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
  function colX(ci) {
    var x = PADDING;
    for (var i = 0; i < ci; i++) x += totalCols[i];
    return x;
  }
  function drawTxt(text, cx, cy, maxW) {
    var size = 7;
    ctx.font = "600 " + size + "px Tajawal,Arial";
    while (ctx.measureText(text).width > maxW - 4 && size > 5) {
      size--;
      ctx.font = "600 " + size + "px Tajawal,Arial";
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
  }
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.strokeStyle =
    mode === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.5;
  rr(PADDING / 2, PADDING / 2, canvasW - PADDING, canvasH - PADDING, 8);
  ctx.stroke();
  var titleY = PADDING + TITLE_H / 2;
  ctx.fillStyle = C.blue;
  ctx.font = "700 9px Cairo,Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "📅 " +
      (user
        ? currentTab === "schedule"
          ? "الجدول الدراسي"
          : "مواعيد الفروض"
        : "الجدول الدراسي"),
    canvasW - PADDING - 6,
    titleY,
  );
  ctx.fillStyle = C.muted;
  ctx.font = "400 6px Tajawal,Arial";
  ctx.textAlign = "left";
  ctx.fillText(
    user ? user.name + " — " + user.school : "منصة دراسة",
    PADDING + 6,
    titleY - 3,
  );
  var hdrY = PADDING + TITLE_H;
  timeSlots.forEach(function (label, i) {
    var ci = i + 1,
      x = colX(ci),
      w = totalCols[ci],
      cx2 = x + w / 2,
      cy2 = hdrY + HEADER_H / 2;
    ctx.fillStyle = i === 4 ? C.breakBg : C.headerBg;
    ctx.fillRect(x, hdrY, w, HEADER_H);
    ctx.fillStyle = C.muted;
    ctx.font = "600 " + (i === 4 ? 5 : 6) + "px Tajawal,Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx2, cy2);
  });
  ctx.fillStyle = C.dayBg;
  ctx.fillRect(colX(0), hdrY, totalCols[0], HEADER_H);
  ctx.fillStyle = C.muted;
  ctx.font = "600 6px Tajawal,Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("اليوم", colX(0) + totalCols[0] / 2, hdrY + HEADER_H / 2);
  days.forEach(function (day, dIdx) {
    var rowY = hdrY + HEADER_H + dIdx * ROW_H;
    ctx.fillStyle = C.dayBg;
    ctx.fillRect(colX(0), rowY, totalCols[0], ROW_H);
    ctx.fillStyle = C.cyan;
    ctx.font = "700 6px Tajawal,Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(day, colX(0) + totalCols[0] / 2, rowY + ROW_H / 2);
    for (var i = 0; i < 8; i++) {
      var ci = i + 1,
        x = colX(ci),
        w = totalCols[ci],
        cy2 = rowY + ROW_H / 2,
        cx2 = x + w / 2;
      if (i === 4) {
        ctx.fillStyle = C.breakBg;
        ctx.fillRect(x, rowY, w, ROW_H);
        continue;
      }
      var key = (currentTab || "schedule") + "_" + dIdx + "_" + i;
      var cellText =
        user && user.data && user.data[currentTab || "schedule"]
          ? user.data[currentTab || "schedule"][key] || ""
          : "";
      if (!cellText || cellText === "-") {
        ctx.fillStyle = "rgba(128,128,128,0.03)";
        ctx.fillRect(x + 2, rowY + 2, w - 4, ROW_H - 4);
      } else {
        var pair = C.subjectColors[cellText] || {
          bg: "rgba(128,128,128,0.1)",
          text: C.text,
        };
        ctx.fillStyle = pair.bg;
        rr(x + 3, rowY + 4, w - 6, ROW_H - 8, 4);
        ctx.fill();
        ctx.fillStyle = pair.text;
        drawTxt(cellText, cx2, cy2, w);
      }
    }
    ctx.strokeStyle =
      mode === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PADDING, rowY + ROW_H);
    ctx.lineTo(canvasW - PADDING, rowY + ROW_H);
    ctx.stroke();
  });
  ctx.fillStyle =
    mode === "light" ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.18)";
  ctx.font = "400 5px Tajawal,Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("منصة دراسة", canvasW / 2, canvasH - PADDING - FOOT_H / 2);
  return cv.toDataURL("image/png");
}

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
  document.querySelectorAll(".theme-dot").forEach(function (d) {
    d.style.outline = d.dataset.theme === name ? "3px solid " + t.blue : "none";
    d.style.outlineOffset = "2px";
  });
}

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
  var dateInp = document.getElementById("examDate");
  if (dateInp && !dateInp.min) {
    dateInp.min = new Date().toISOString().slice(0, 10);
  }
  var container = document.getElementById("examCards");
  if (!container) return;
  var exams = user.data.examsCountdown || [];
  var sorted = exams
    .map(function (e, i) {
      return Object.assign({}, e, {
        idx: i,
      });
    })
    .sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });
  if (sorted.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1;">' +
      '<div class="es-icon-wrap">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' +
      "</div>" +
      '<div class="es-title">لا توجد فروض قادمة </div>' +
      '<div class="es-sub">أضف مواعيد فروضك وامتحاناتك لتبقى على استعداد دائم!</div>' +
      "</div>";
    return;
  }
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  container.innerHTML = sorted
    .map(function (e) {
      var examDay = new Date(e.date);
      examDay.setHours(0, 0, 0, 0);
      var diff = Math.round((examDay - today) / (1e3 * 60 * 60 * 24));
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
        ')" class="glass-del-btn" aria-label="حذف" style="flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
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
      '<div class="empty-state">' +
      '<div class="es-icon-wrap">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>' +
      "</div>" +
      '<div class="es-title">لا توجد موارد مضافة </div>' +
      '<div class="es-sub">أضف روابط الدروس والفيديوهات والمراجع المفيدة!</div>' +
      "</div>";
    return;
  }
  var bySubject = {};
  resources.forEach(function (r, i) {
    if (!bySubject[r.subject]) bySubject[r.subject] = [];
    bySubject[r.subject].push(
      Object.assign({}, r, {
        idx: i,
      }),
    );
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
        escHtml(sanitizeUrl(r.url)) +
        '" target="_blank" rel="noopener noreferrer" style="flex:1; font-size:14px; color:var(--text); text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onmouseover="this.style.color=\'var(--blue)\'" onmouseout="this.style.color=\'var(--text)\'">' +
        escHtml(r.title || r.url) +
        "</a>" +
        '<button onclick="removeResource(' +
        r.idx +
        ')" class="glass-del-btn" aria-label="حذف" style="flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
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
  var lowerUrl = url.toLowerCase();
  if (
    lowerUrl.startsWith("javascript:") ||
    lowerUrl.startsWith("data:") ||
    lowerUrl.startsWith("vbscript:")
  ) {
    return toast("رابط غير مسموح به", "error");
  }
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
      cellDate.toLocaleDateString("ar-EG", {
        month: "short",
        day: "numeric",
      }) + (mins > 0 ? " — " + mins + " دقيقة" : "");
    grid.appendChild(cell);
  }
}

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
    container.innerHTML = '<div class="no-search-results">No results</div>';
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

var _focusMode = false;

window.toggleFocusMode = function () {
  _focusMode = !_focusMode;
  document.body.classList.toggle("focus-mode", _focusMode);
  var btn = document.getElementById("focusModeToggle");
  if (_focusMode) {
    if (btn) btn.innerHTML = "✖ خروج من التركيز";
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    toast("🎯 وضع التركيز — مؤقت بومودورو فقط", "info");
  } else {
    if (btn) btn.innerHTML = "🎯 وضع التركيز";
    toast("عدت للوضع العادي ✓", "success");
  }
};

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
  user.data.todos.push({
    text: val,
    completed: false,
    priority: priority,
  });
  inp.value = "";
  saveUser();
  renderList("todo");
  inp.focus();
};

// renderList("todo") is now fully handled by the MIT feature below (Feature 5).
// The base renderList for other types is preserved via _prevRenderList chain there.

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

function checkBackupReminder() {
  var badge = document.getElementById("backupBadge");
  if (!badge || !user) return;
  var last = localStorage.getItem("lastBackup_" + user.id);
  if (!last) {
    badge.classList.add("visible");
    return;
  }
  if ((Date.now() - parseInt(last)) / (1e3 * 60 * 60 * 24) >= 7)
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

function checkExamNotifications() {
  if (!user || !user.data.examsCountdown) return;
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  user.data.examsCountdown.forEach(function (e) {
    var examDate = new Date(e.date);
    examDate.setHours(0, 0, 0, 0);
    var diff = Math.round((examDate - today) / (1e3 * 60 * 60 * 24));
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
    var last = user && localStorage.getItem("lastBackup_" + user.id);
    if (!last)
      setTimeout(function () {
        toast(
          "💡 لم تقم بنسخة احتياطية بعد! احفظ بياناتك من 'نسخة احتياطية'",
          "info",
        );
      }, 5e3);
    else if ((Date.now() - parseInt(last)) / (1e3 * 60 * 60 * 24) >= 7)
      setTimeout(function () {
        toast("⚠️ مرّ أسبوع على آخر نسخة احتياطية!", "info");
      }, 3e3);
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
}, 1e4);

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

window.openPrintModeModal = function () {
  var modal = document.getElementById("printModeModal");
  if (modal) modal.classList.add("ptm-active");
};
window.closePrintModeModal = function () {
  var modal = document.getElementById("printModeModal");
  if (modal) modal.classList.remove("ptm-active");
};
window.confirmPrintMode = function () {
  var sel = document.querySelector('input[name="ptm-radio"]:checked');
  var mode = sel ? sel.value : "eco-ink";
  closePrintModeModal();
  printSchedule(mode);
};
window.printSchedule = function (mode) {
  mode = mode || "eco-ink";
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
      رياضيات: {
        bg: "rgba(59,130,246,0.12)",
        text: "#1d4ed8",
      },
      فيزياء: {
        bg: "rgba(168,85,247,0.12)",
        text: "#7c3aed",
      },
      علوم: {
        bg: "rgba(16,185,129,0.12)",
        text: "#065f46",
      },
      عربية: {
        bg: "rgba(245,158,11,0.12)",
        text: "#92400e",
      },
      فرنسية: {
        bg: "rgba(239,68,68,0.12)",
        text: "#991b1b",
      },
      إنجليزية: {
        bg: "rgba(14,165,233,0.12)",
        text: "#0369a1",
      },
      "تاريخ/جغرافيا": {
        bg: "rgba(234,88,12,0.12)",
        text: "#9a3412",
      },
      فلسفة: {
        bg: "rgba(99,102,241,0.12)",
        text: "#4338ca",
      },
      إسلامية: {
        bg: "rgba(20,184,166,0.12)",
        text: "#0f766e",
      },
      "إعلام آلي": {
        bg: "rgba(6,182,212,0.12)",
        text: "#0e7490",
      },
      تكنلوجيا: {
        bg: "rgba(251,191,36,0.12)",
        text: "#92400e",
      },
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
  var base = "*{margin:0;padding:0;box-sizing:border-box;}";
  var scissors =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>' +
    '<line x1="20" y1="4" x2="8.12" y2="15.88"/>' +
    '<line x1="14.47" y1="14.48" x2="20" y2="20"/>' +
    '<line x1="8.12" y1="8.12" x2="12" y2="12"/>' +
    "</svg>";
  if (mode === "eco-paper") {
    win.document.write(
      '<!DOCTYPE html><html dir="rtl"><head><title>طباعة الجدول</title>' +
        "<style>" +
        base +
        "body{background:#fff;display:flex;flex-direction:column;align-items:center;padding:14px 16px 0;}" +
        "img{max-width:100%;height:auto;display:block;}" +
        ".cut{width:100%;display:flex;align-items:center;gap:8px;margin:10px 0;direction:ltr;}" +
        ".cut-dash{flex:1;border:none;border-top:2px dashed #bbb;}" +
        "@media print{body{padding:6px;}img{max-width:100%;}}" +
        "</style></head><body>" +
        '<img src="' +
        imgData +
        '"/>' +
        '<div class="cut">' +
        scissors +
        '<div class="cut-dash"></div>' +
        "</div>" +
        '<img src="' +
        imgData +
        '" onload="window.print();"/>' +
        "</body></html>",
    );
  } else if (mode === "hq") {
    win.document.write(
      '<!DOCTYPE html><html dir="rtl"><head><title>طباعة الجدول</title>' +
        "<style>" +
        base +
        "@page{size:A4 landscape;margin:0;}" +
        "body{background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:0;}" +
        "img{width:100%;height:auto;display:block;}" +
        "@media print{html,body{width:100%;height:100%;margin:0;padding:0;}img{width:100%;height:auto;}}" +
        "</style></head><body>" +
        '<img src="' +
        imgData +
        '" onload="window.print();"/>' +
        "</body></html>",
    );
  } else {
    win.document.write(
      '<!DOCTYPE html><html dir="rtl"><head><title>طباعة الجدول</title>' +
        "<style>" +
        base +
        "body{background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px;}" +
        "img{max-width:100%;height:auto;border-radius:8px;}" +
        "@media print{body{padding:0;}img{max-width:100%;border-radius:0;}}" +
        "</style></head><body>" +
        '<img src="' +
        imgData +
        '" onload="window.print();"/>' +
        "</body></html>",
    );
  }
  win.document.close();
  toast("✓ تم فتح نافذة الطباعة", "success");
};

window.setMIT = function (idx) {
  if (!user || !user.data || !user.data.todos) return;
  var todos = user.data.todos;
  // Toggle: if already MIT, un-set it; otherwise set new one
  var isAlreadyMIT = !!todos[idx].isMIT;
  todos.forEach(function (t) {
    t.isMIT = false;
  });
  if (!isAlreadyMIT) todos[idx].isMIT = true;
  saveUser();
  renderList("todo");
  if (!isAlreadyMIT) {
    toast(
      '⭐ "' + todos[idx].text.substring(0, 22) + '" أصبحت أولوية اليوم!',
      "success",
    );
  }
};

function updateMITBanner(mitItem) {
  var banner = document.getElementById("mitBanner");
  var bannerText = document.getElementById("mitBannerText");
  if (!banner || !bannerText) return;
  if (mitItem) {
    bannerText.textContent = mitItem.text;
    banner.classList.add("visible");
  } else {
    banner.classList.remove("visible");
  }
}

// Override renderList("todo") to support MIT
var _prevRenderList = window.renderList;
window.renderList = function (type) {
  if (type !== "todo") {
    _prevRenderList(type);
    return;
  }

  var list = document.getElementById("todoList");
  var items = user.data.todos || [];

  if (items.length === 0) {
    updateMITBanner(null);
    list.innerHTML =
      '<div class="empty-state">' +
      '<div class="es-icon-wrap">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>' +
      "</svg>" +
      "</div>" +
      '<div class="es-title">ما في مهام — خذ استراحة </div>' +
      '<div class="es-sub">أضف مهمتك الأولى وابدأ يومك بخطوة واثقة!</div>' +
      "</div>";
    if (typeof updateProgress === "function") updateProgress();
    return;
  }

  // Find MIT item
  var mitItem = null;
  items.forEach(function (t) {
    if (t.isMIT) mitItem = t;
  });
  updateMITBanner(mitItem);

  var pOrder = { urgent: 0, important: 1, normal: 2 };
  var sorted = items.map(function (item, idx) {
    return { item: item, idx: idx };
  });

  sorted.sort(function (a, b) {
    // MIT always first
    if (a.item.isMIT && !b.item.isMIT) return -1;
    if (!a.item.isMIT && b.item.isMIT) return 1;
    return (
      pOrder[a.item.priority || "normal"] -
      pOrder[b.item.priority || "normal"]
    );
  });

  var pLabel = { urgent: "عاجل", important: "مهم", normal: "عادي" };
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
      var isMIT = !!item.isMIT;
      return (
        '<div class="todo-item' +
        (isMIT ? " mit-item" : "") +
        '">' +
        // Crown / star button
        '<button class="mit-crown-btn' +
        (isMIT ? " active" : "") +
        '" onclick="setMIT(' +
        idx +
        ')" ' +
        'aria-label="' +
        (isMIT ? "إلغاء أولوية اليوم" : "تعيين كأولوية اليوم") +
        '" ' +
        'title="' +
        (isMIT ? "إلغاء أولوية اليوم" : "أولوية اليوم ⭐") +
        '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="' +
        (isMIT ? "#f59e0b" : "none") +
        '" ' +
        'stroke="' +
        (isMIT ? "#f59e0b" : "currentColor") +
        '" stroke-width="2" aria-hidden="true">' +
        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
        "</svg>" +
        "</button>" +
        // Checkbox
        '<input type="checkbox" ' +
        (item.completed ? "checked" : "") +
        ' onchange="toggleComplete(' +
        idx +
        ')">' +
        // Text
        '<span style="font-size:13.5px;flex:1;font-family:var(--font-body);' +
        (item.completed
          ? "text-decoration:line-through;color:var(--muted);opacity:0.65;"
          : "color:var(--text);") +
        (isMIT && !item.completed
          ? "font-weight:600;color:var(--text-secondary);"
          : "") +
        '">' +
        escHtml(item.text) +
        "</span>" +
        // Priority badge
        '<span class="task-priority ' +
        pClass[p] +
        '">' +
        pLabel[p] +
        "</span>" +
        // Delete
        '<button class="todo-del-btn" onclick="removeItem(\'todo\',' +
        idx +
        ",'" +
        escHtml(item.text).substring(0, 20) +
        '\')" aria-label="حذف المهمة">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        "</button>" +
        "</div>"
      );
    })
    .join("");

  if (typeof updateProgress === "function") updateProgress();
};

/* 50 Tips in 5 categories  */
var BO_CATEGORIES = [
  {
    id: 0,
    name: "الجسم",
    color: "#f43f5e",
    tips: [
      "اشرب كوباً كاملاً من الماء الآن — الجفاف الخفيف يقلل التركيز بنسبة تصل إلى 20% وفق دراسة جامعة إيست لندن.",
      "قم وتمدد لمدة دقيقتين — الجلوس الطويل يضغط على الأقراص الفقرية ويقلل تدفق الدم للدماغ.",
      "افعل 10 قفزات خفيفة أو 20 ثنية للركبة — التمرين القصير يرفع مستوى BDNF الذي يحسّن الذاكرة فوراً.",
      "دلّك رقبتك وكتفيك لمدة 60 ثانية — توتر العضلات يصرف انتباهك دون أن تدرك ذلك.",
      "تأكد من وضعية جلوسك: ظهر مستقيم، قدمان على الأرض، الشاشة بمستوى العينين — وضعية سيئة تعني تعباً مبكراً.",
      "تناول قطعة من المكسرات أو فاكهة — الكربوهيدرات المعقدة تمد الدماغ بطاقة مستقرة دون انهيار سكري.",
      "افتح النافذة أو اخرج لـ 60 ثانية — الهواء النقي يرفع الأكسجين في الدم ويحسّن اليقظة الذهنية.",
      "اغسل وجهك بماء بارد — يحفّز عصب الحيد مما يخفض معدل ضربات القلب ويجدد التركيز بشكل فوري.",
      "اضبط درجة حرارة الغرفة بين 20-22 درجة — الغرف الحارة تقلل الكفاءة المعرفية وفق دراسات ناسا.",
      "تجنب الدراسة على السرير — دماغك يربطه بالنوم ويُصعب الدخول في وضع التركيز، استخدم كرسياً ومكتباً.",
    ],
  },
  {
    id: 1,
    name: "الدماغ",
    color: "#8b5cf6",
    tips: [
      "أغمض عينيك 60 ثانية وفكر في ما درسته للتو — إعادة الاسترجاع تثبّت الذاكرة أكثر من القراءة مجدداً بنسبة 50%.",
      "اكتب 3 أشياء تعلمتها في الجلسة الماضية بكلماتك الخاصة — التعليم الذاتي أقوى تقنيات الحفظ.",
      "ضع هدفاً واحداً واضحاً للجلسة القادمة قبل أن تبدأ — الغموض أكبر سارق للتركيز.",
      "فترات الاستراحة ضرورية لا ترف — الدماغ يثبّت المعلومات أثناء الراحة عبر الشبكة الافتراضية الداخلية.",
      "تجنب السوشيال ميديا الآن — 5 دقائق منها تحتاج 23 دقيقة لاستعادة التركيز الكامل بعدها وفق دراسة UC Irvine.",
      "إذا كنت تحفظ نصاً، اكتبه من الذاكرة بدل قراءته — الاسترجاع النشط أقوى 3 مرات من المراجعة السلبية.",
      "النوم الكافي يضاعف كفاءة الحفظ — إذا كنت تنام أقل من 7 ساعات أنت تخسر نصف ما تتعلمه.",
      "جرّب تغيير موضع دراستك أحياناً — البيئات المتعددة تقوّي الروابط العصبية المرتبطة بالمعلومة.",
      "اشرح ما درسته لشخص وهمي أو سجّله صوتياً — تقنية فاينمان تكشف الثغرات وتُعمّق الفهم.",
      "إذا شعرت بالإرهاق قسّم المادة لأجزاء أصغر — الدماغ يتعلم بشكل أفضل على جلسات قصيرة متعددة.",
    ],
  },
  {
    id: 2,
    name: "العيون",
    color: "#06b6d4",
    tips: [
      "قاعدة 20-20-20: كل 20 دقيقة انظر لشيء على بُعد 20 قدماً لمدة 20 ثانية — تقلل إجهاد العين 30%.",
      "حدّق في أبعد نقطة تراها من النافذة لمدة 30 ثانية — يُرخّي عضلة العدسة المجهدة من التحديق القريب.",
      "اطرف عيونيك سريعاً 15 مرة متتالية — الشاشات تقلل الطرفة لثلث معدلها الطبيعي مما يجفف العيون.",
      "اضبط سطوع الشاشة بحيث يساوي إضاءة الغرفة — التباين الزائد يُرهق عضلات القزحية باستمرار.",
      "فعّل الوضع الليلي دائماً بعد الغروب — الضوء الأزرق يثبط الميلاتونين ويؤخر النوم بساعتين.",
      "أبعد الشاشة مسافة ذراع كاملة (50-70 سم) — القرب الزائد أكبر أسباب إجهاد العين الرقمي.",
      "ضع الشاشة بحيث تنظر إليها من الأعلى قليلاً لا من الأسفل — يقلل توتر عضلات الرقبة والعين معاً.",
      "أغمض عيونيك 30 ثانية كاملة الآن — المرطبة الطبيعية للعين هي الغمز وهو أقل مما نظن أثناء الشاشة.",
      "استخدم إضاءة خلفية غير مباشرة خلف الشاشة — تقلل التباين الحاد وتريح العيون في جلسات الليل.",
      "إذا ارتديت نظارات نظّفها الآن — الزجاج الغبار يجبر عينيك على الضغط أكثر لترى بوضوح.",
    ],
  },
  {
    id: 3,
    name: "التنفس",
    color: "#10b981",
    tips: [
      "تنفس 4-7-8: شهيق 4 ثوان، احبس 7 ثوان، زفير 8 ثوان — ثبت علمياً لتخفيض الكورتيزول فوراً.",
      "التنفس البطني: تأكد أن بطنك يرتفع عند الشهيق لا صدرك — يُفعّل الجهاز العصبي السمبتاوي ويهدئ الجسم.",
      "تنفس الصندوق: شهيق 4، احبس 4، زفير 4، احبس 4 — تستخدمه قوات نخبة الجيش لإدارة الضغط.",
      "6 أنفاس عميقة متتالية تغير كيمياء دمك — يرتفع الأكسجين وينخفض ثاني أكسيد الكربون مما يصفّي الذهن.",
      "الزفير الطويل أهم من الشهيق — يُفعّل العصب الحائر ويخفض ضربات القلب ويهدئ الجهاز العصبي تلقائياً.",
      "تنفس بالتناوب من المنخرين: أغلق منخراً وتنفس من الآخر — يوازن نصفي الدماغ الأيمن والأيسر.",
      "تنفس بوتيّو: تنفس هادئ جداً لدرجة تكاد لا تشعر به — يُعلم دماغك تحمّل ثاني أكسيد الكربون ويحسّن الأداء.",
      "الأنف لا الفم دائماً — التنفس الأنفي يُرطّب الهواء ويُنتج أكسيد النيتريك الذي يوسّع الأوعية الدموية.",
      "الأنفاس السريعة السطحية تُفاقم القلق — أبطّأ تنفسك إلى 6 أنفاس في الدقيقة لحالة ذهنية مثالية.",
      "ضع يدك على قلبك وتنفس ببطء مع تذكّر شيء تشعر بالامتنان له — يُزامن الدماغ مع القلب ويصفّي التفكير.",
    ],
  },
  {
    id: 4,
    name: "التحفيز",
    color: "#f59e0b",
    tips: [
      "أنجزت جلسة كاملة — هذا يعني أن لديك من الإرادة ما يكفي، والإرادة عضلة تتقوى بالاستخدام المنتظم.",
      "تذكر سبباً واحداً عميقاً لدراستك اليوم — الهدف الشخصي الواضح يرفع الأداء بنسبة 58% وفق علم الدافعية.",
      "التقدم الصغير المتراكم يتفوق على الجهد الضخم المتقطع دائماً — أنت تبني عادة وهذا أقوى من الإلهام.",
      "قارن نفسك بنسختك من الأمس فقط لا بالآخرين — المقارنة الخارجية تقتل الدافعية على المدى البعيد.",
      "الشعور بعدم الرغبة في الدراسة طبيعي تماماً — ابدأ لمدة دقيقتين فقط والدماغ يدخل وضع التركيز تلقائياً.",
      "احتفل بأي إنجاز صغير بشكل داخلي — الدوبامين يُنتَج عند تحقيق أهداف صغيرة ويبني زخم الاستمرار.",
      "الصعوبة التي تشعر بها تعني أنك تنمو فعلاً — الدماغ يبني روابط عصبية جديدة تحت الضغط المعتدل.",
      "لا أحد يشعر بالجاهزية الكاملة — العمل يسبق الإلهام دائماً وليس العكس، ابدأ الآن.",
      "تخيّل نسختك بعد سنة من الاتساق اليومي — هذه الصورة أقوى محرك للسلوك على المدى البعيد.",
      "الاستراحة التي تأخذها الآن ليست تقصيراً — هي استثمار في الجلسة القادمة، والراحة جزء من الأداء العالي.",
    ],
  },
];

var _boActiveCat = 0;
var _boActiveTip = 0;
var _bpBreathRAF = null;
var _bpBreathPhase = 0;
var _bpLastPhase = 0;
var _bpPhaseMs = 4000;
var _bpCDTimer = null;
var _bpAutoTimer = null;
var _bpIsLong = false;
var _bpPanelOpen = false;

var BP_PHASES = [
  { label: "شهيق", ms: 4000, from: 0, to: 1 },
  { label: "احبس", ms: 3000, from: 1, to: 1 },
  { label: "زفير", ms: 5000, from: 1, to: 0 },
  { label: "ارتاح", ms: 1000, from: 0, to: 0 },
];
var BP_CIRC = 314.2; // 2π×50

function bpUpdateRing(pct) {
  var el = document.getElementById("bpRingProgress");
  if (el) el.style.strokeDashoffset = (BP_CIRC * (1 - pct)).toFixed(2);
}
function bpUpdateFace(pct) {
  var mouth = document.getElementById("bpMouthPath");
  if (mouth) {
    var yCtrl = (29 + pct * 5).toFixed(1);
    mouth.setAttribute("d", "M 13 26 Q 20 " + yCtrl + " 27 26");
  }
  var face = document.getElementById("bpFaceWrap");
  if (face) face.style.transform = "scale(" + (1 + pct * 0.07).toFixed(3) + ")";
}
function bpSetLabel(txt) {
  var el = document.getElementById("bpBreathLabel");
  if (!el) return;
  el.style.opacity = "0";
  setTimeout(function () {
    el.textContent = txt;
    el.style.opacity = "1";
  }, 200);
}
function bpBreathFrame(now) {
  var phase = BP_PHASES[_bpBreathPhase];
  var t = Math.min((now - _bpLastPhase) / phase.ms, 1);
  var eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  var pct = phase.from + (phase.to - phase.from) * eased;
  bpUpdateRing(Math.max(0, Math.min(1, pct)));
  bpUpdateFace(Math.max(0, Math.min(1, pct)));
  if (t >= 1) {
    _bpBreathPhase = (_bpBreathPhase + 1) % BP_PHASES.length;
    _bpLastPhase = now;
    bpSetLabel(BP_PHASES[_bpBreathPhase].label);
  }
  _bpBreathRAF = requestAnimationFrame(bpBreathFrame);
}
function bpStartBreath() {
  bpStopBreath();
  _bpBreathPhase = 0;
  _bpLastPhase = performance.now();
  bpSetLabel(BP_PHASES[0].label);
  _bpBreathRAF = requestAnimationFrame(bpBreathFrame);
}
function bpStopBreath() {
  if (_bpBreathRAF) {
    cancelAnimationFrame(_bpBreathRAF);
    _bpBreathRAF = null;
  }
}

function bpHexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ].join(",");
}
function bpRenderDots() {
  var wrap = document.getElementById("bpTipDots");
  if (!wrap) return;
  var len = BO_CATEGORIES[_boActiveCat].tips.length;
  var html = "";
  for (var i = 0; i < len; i++) {
    html +=
      '<div class="bp-tip-dot' +
      (i === _boActiveTip ? " active" : "") +
      '" onclick="bpGoToTip(' +
      i +
      ')"></div>';
  }
  wrap.innerHTML = html;
}
function bpRenderTabs() {
  document.querySelectorAll(".bp-cat-tab").forEach(function (tab) {
    var cat = parseInt(tab.getAttribute("data-cat"), 10);
    var active = cat === _boActiveCat;
    var color = BO_CATEGORIES[cat].color;
    var rgb = bpHexToRgb(color);
    tab.classList.toggle("active", active);
    tab.querySelector(".bp-cat-icon").style.color = active ? color : "";
    tab.querySelector(".bp-cat-name").style.color = active ? color : "";
    tab.style.background = active ? "rgba(" + rgb + ",0.1)" : "";
    tab.style.borderColor = active ? "rgba(" + rgb + ",0.28)" : "";
    tab.style.boxShadow = active ? "0 4px 14px rgba(" + rgb + ",0.1)" : "";
  });
  var card = document.getElementById("bpTipCard");
  if (card) {
    var rgb2 = bpHexToRgb(BO_CATEGORIES[_boActiveCat].color);
    card.style.setProperty("--bp-cat-color", BO_CATEGORIES[_boActiveCat].color);
    card.style.borderColor = "rgba(" + rgb2 + ",0.14)";
    // top-line color via before pseudo - update via data attribute
    card.setAttribute("data-cat-color", BO_CATEGORIES[_boActiveCat].color);
  }
}
function bpSetTip(idx, dir) {
  var tips = BO_CATEGORIES[_boActiveCat].tips;
  _boActiveTip = ((idx % tips.length) + tips.length) % tips.length;
  var textEl = document.getElementById("bpTipText");
  var numEl = document.getElementById("bpTipNum");
  if (!textEl) return;
  textEl.classList.remove("entering", "leaving", "prev");
  void textEl.offsetWidth;
  textEl.classList.add("leaving");
  if (dir < 0) textEl.classList.add("prev");
  setTimeout(function () {
    textEl.classList.remove("leaving", "prev");
    textEl.textContent = tips[_boActiveTip];
    if (numEl)
      numEl.textContent =
        String(_boActiveTip + 1).padStart(2, "0") + "/" + tips.length;
    void textEl.offsetWidth;
    textEl.classList.add("entering");
    if (dir < 0) textEl.classList.add("prev");
    setTimeout(function () {
      textEl.classList.remove("entering", "prev");
    }, 340);
    bpRenderDots();
  }, 230);
}
window.bpNavTip = function (d) {
  bpSetTip(_boActiveTip + d, d);
};
window.bpGoToTip = function (i) {
  bpSetTip(i, i > _boActiveTip ? 1 : -1);
};
window.bpSelectCat = function (cat) {
  _boActiveCat = cat;
  _boActiveTip = 0;
  bpRenderTabs();
  bpSetTip(0, 1);
};

function bpBuildPanel() {
  var pomoCard = document.getElementById("pomoLabel");
  if (!pomoCard) return;
  var card = pomoCard.closest(".card");
  if (!card) return;

  // Ensure panel element exists inside the pomo card
  var panel = document.getElementById("breakTipsPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "breakTipsPanel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "نصائح الاستراحة");
    card.appendChild(panel);
  }

  var isLong = _bpIsLong;
  panel.innerHTML =
    // SVG defs
    '<svg width="0" height="0" style="position:absolute">' +
    "<defs>" +
    '<linearGradient id="bpBreathGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#3b82f6"/>' +
    '<stop offset="50%" stop-color="#818cf8"/>' +
    '<stop offset="100%" stop-color="#06b6d4"/>' +
    "</linearGradient>" +
    "</defs>" +
    "</svg>" +
    // Top bar
    '<div class="bp-topbar">' +
    '<div class="bp-mode-pill">' +
    '<div class="bp-mode-dot"></div>' +
    '<span class="bp-mode-text">' +
    (isLong ? "استراحة طويلة" : "استراحة قصيرة") +
    "</span>" +
    "</div>" +
    '<div class="bp-countdown">' +
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
    '<span class="bp-countdown-val" id="bpCDVal">--:--</span>' +
    "</div>" +
    "</div>" +
    // Breathing
    '<div class="bp-breath-section">' +
    '<div class="bp-ring-outer">' +
    '<svg class="bp-ring-svg" viewBox="0 0 108 108">' +
    '<circle class="bp-ring-track" cx="54" cy="54" r="50"/>' +
    '<circle class="bp-ring-progress" id="bpRingProgress" cx="54" cy="54" r="50"/>' +
    "</svg>" +
    '<div class="bp-face-wrap" id="bpFaceWrap">' +
    '<svg class="bp-face-svg" viewBox="0 0 40 40" fill="none">' +
    '<ellipse class="bp-eye left"  cx="13" cy="15" rx="2.6" ry="3"   fill="white" fill-opacity="0.9"/>' +
    '<ellipse class="bp-eye left"  cx="13.6" cy="15.5" rx="1.3" ry="1.6" fill="#1e3a8a"/>' +
    '<ellipse class="bp-eye right" cx="27" cy="15" rx="2.6" ry="3"   fill="white" fill-opacity="0.9"/>' +
    '<ellipse class="bp-eye right" cx="27.6" cy="15.5" rx="1.3" ry="1.6" fill="#1e3a8a"/>' +
    '<ellipse cx="9"  cy="22" rx="3.5" ry="2.2" fill="#f87171" fill-opacity="0.2"/>' +
    '<ellipse cx="31" cy="22" rx="3.5" ry="2.2" fill="#f87171" fill-opacity="0.2"/>' +
    '<path id="bpMouthPath" d="M 13 26 Q 20 30 27 26" stroke="white" stroke-opacity="0.88" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
    "</svg>" +
    "</div>" +
    "</div>" +
    '<div class="bp-breath-label" id="bpBreathLabel">شهيق</div>' +
    "</div>" +
    '<div class="bp-divider"></div>' +
    // Tips
    '<div class="bp-tips-section">' +
    '<div class="bp-cat-tabs" id="bpCatTabs">' +
    BO_CATEGORIES.map(function (cat) {
      return (
        '<button class="bp-cat-tab' +
        (cat.id === 0 ? " active" : "") +
        '" data-cat="' +
        cat.id +
        '" onclick="bpSelectCat(' +
        cat.id +
        ')" aria-label="' +
        cat.name +
        '">' +
        '<svg class="bp-cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        (cat.id === 0
          ? '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
          : cat.id === 1
            ? '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.04-4.79A2.5 2.5 0 0 1 4 11a2.5 2.5 0 0 1 .7-5.47A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.04-4.79A2.5 2.5 0 0 0 20 11a2.5 2.5 0 0 0-.7-5.47A2.5 2.5 0 0 0 14.5 2z"/>'
            : cat.id === 2
              ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
              : cat.id === 3
                ? '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'
                : '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>') +
        "</svg>" +
        '<span class="bp-cat-name">' +
        cat.name +
        "</span>" +
        "</button>"
      );
    }).join("") +
    "</div>" +
    '<div class="bp-tip-area">' +
    '<div class="bp-tip-card" id="bpTipCard">' +
    '<span class="bp-tip-num" id="bpTipNum">01/10</span>' +
    '<div class="bp-tip-text-wrap">' +
    '<p class="bp-tip-text entering" id="bpTipText">جاري التحميل...</p>' +
    "</div>" +
    "</div>" +
    '<div class="bp-tip-nav">' +
    '<button class="bp-nav-btn" onclick="bpNavTip(-1)" aria-label="السابق">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>' +
    "</button>" +
    '<div class="bp-tip-dots" id="bpTipDots"></div>' +
    '<button class="bp-nav-btn" onclick="bpNavTip(1)" aria-label="التالي">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>' +
    "</button>" +
    "</div>" +
    "</div>" +
    "</div>" +
    // Skip btn
    '<button class="bp-skip-btn" onclick="bpSkipAdvices()">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>' +
    "SKIP THIS BREAK ADVICES" +
    "</button>";
}

function bpStartCD() {
  bpStopCD();
  function tick() {
    var el = document.getElementById("bpCDVal");
    if (!el) return;
    var m = Math.floor(timeLeft / 60),
      s = timeLeft % 60;
    el.textContent =
      String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  tick();
  _bpCDTimer = setInterval(tick, 500);
}
function bpStopCD() {
  if (_bpCDTimer) {
    clearInterval(_bpCDTimer);
    _bpCDTimer = null;
  }
}
function bpStartAutoRotate() {
  bpStopAutoRotate();
  _bpAutoTimer = setInterval(function () {
    bpNavTip(1);
  }, 13000);
}
function bpStopAutoRotate() {
  if (_bpAutoTimer) {
    clearInterval(_bpAutoTimer);
    _bpAutoTimer = null;
  }
}

function bpOpenPanel() {
  _bpPanelOpen = true;
  bpBuildPanel();
  // Set first tip randomly
  _boActiveCat = 0;
  _boActiveTip = Math.floor(Math.random() * 10);
  bpRenderTabs();
  bpSetTip(_boActiveTip, 1);
  bpRenderDots();
  var panel = document.getElementById("breakTipsPanel");
  if (panel) {
    panel.classList.add("open");
    setTimeout(function () {
      bpStartBreath();
    }, 100);
  }
  bpStartCD();
  bpStartAutoRotate();
}
function bpClosePanel() {
  _bpPanelOpen = false;
  var panel = document.getElementById("breakTipsPanel");
  if (panel) panel.classList.remove("open");
  bpStopBreath();
  bpStopCD();
  bpStopAutoRotate();
}

function showBreakModal(isLong) {
  _bpIsLong = isLong;
  var modal = document.getElementById("breakAcceptModal");
  if (!modal) return;
  var badge = document.getElementById("bamBadge");
  if (badge) badge.textContent = isLong ? "استراحة طويلة" : "استراحة قصيرة";
  modal.classList.add("open");
}
function hideBreakModal() {
  var modal = document.getElementById("breakAcceptModal");
  if (modal) modal.classList.remove("open");
}

window.boAccept = function () {
  hideBreakModal();
  bpOpenPanel();
};
window.boDecline = function () {
  hideBreakModal();
};

/* ══════════════════════════════════════════════
   Mouse-tracking Glow — Danger Card (static card)
   ══════════════════════════════════════════════ */
(function () {
  function initDangerTilt() {
    var card = document.querySelector(".sp-danger-card");
    if (!card) return;

    card.addEventListener("mousemove", function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var px = (x / rect.width) * 100;
      var py = (y / rect.height) * 100;
      card.style.setProperty("--danger-glow-x", px + "%");
      card.style.setProperty("--danger-glow-y", py + "%");
    });

    card.addEventListener("mouseleave", function () {
      card.style.removeProperty("--danger-glow-x");
      card.style.removeProperty("--danger-glow-y");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDangerTilt);
  } else {
    initDangerTilt();
  }
})();
window.bpSkipAdvices = function () {
  bpClosePanel();
  toast("Back to normal break — enjoy your rest!", "info");
};
var _origHandleModeSwitch = window.handleModeSwitch;
window.handleModeSwitch = function () {
  var wasStudy = pomoMode === "study";
  _origHandleModeSwitch.apply(this, arguments);
  if (wasStudy && (pomoMode === "shortBreak" || pomoMode === "longBreak")) {
    bpClosePanel();
    showBreakModal(pomoMode === "longBreak");
  } else {
    hideBreakModal();
    bpClosePanel();
  }
};

/* ══════════════════════════════════════════════
   Pomodoro Ring Visual — Circular Progress
   ══════════════════════════════════════════════ */
(function () {
  var CIRC = 2 * Math.PI * 115;

  function updatePomoRing() {
    var ring = document.getElementById("pomoRingProgress");
    if (!ring) return;
    var totalTime =
      pomoMode === "study"
        ? config.study * 60
        : pomoMode === "shortBreak"
          ? config.break * 60
          : config.longBreak * 60;
    if (totalTime <= 0) return;
    var offset = CIRC * (1 - Math.max(0, timeLeft) / totalTime);
    ring.style.strokeDashoffset = offset;
  }

  function syncCardMode() {
    var card = document.querySelector(".pomo-ultra");
    if (!card) return;
    card.classList.toggle("is-break", pomoMode !== "study");
    card.classList.toggle("is-short-break", pomoMode === "shortBreak");
    card.classList.toggle("is-long-break", pomoMode === "longBreak");
  }

  function syncRunState() {
    var card = document.querySelector(".pomo-ultra");
    if (!card) return;
    card.classList.toggle("is-running", isRunning);
  }

  var _origUTD = window.updateTimerDisplay;
  window.updateTimerDisplay = function () {
    _origUTD.apply(this, arguments);
    updatePomoRing();
  };

  var _origUMI = window.updateModeIndicator;
  window.updateModeIndicator = function () {
    _origUMI.apply(this, arguments);
    syncCardMode();
    updatePomoRing();
  };

  var _origTT = window.toggleTimer;
  window.toggleTimer = function () {
    _origTT.apply(this, arguments);
    syncRunState();
  };

  var _origHMS2 = window.handleModeSwitch;
  window.handleModeSwitch = function () {
    _origHMS2.apply(this, arguments);
    syncRunState();
    syncCardMode();
  };

  var _origRP = window.resetPomo;
  window.resetPomo = function () {
    _origRP.apply(this, arguments);
    updatePomoRing();
    syncCardMode();
    syncRunState();
  };
})();
var _origResetPomo = window.resetPomo;
window.resetPomo = function () {
  _origResetPomo.apply(this, arguments);
  hideBreakModal();
  bpClosePanel();
};

/* ══════════════════════════════════════════════
   Cookie Consent
   ══════════════════════════════════════════════ */
(function () {
  var CC_KEY = "cookieConsent";
  var _ccTimer = null;
  var _ccSeconds = 15;
  var _ccInterval = null;

  function ccLoadGA() {
    if (window._gaLoaded) return;
    window._gaLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    // ← ضع هنا معرّف Google Analytics الخاص بك بدلاً من G-XXXXXXXXXX
    s.src = "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX";
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", "G-XXXXXXXXXX");
  }

  function ccHide() {
    var el = document.getElementById("cookieConsent");
    if (!el) return;
    el.classList.remove("cc-visible");
    clearTimeout(_ccTimer);
    clearInterval(_ccInterval);
  }

  window.ccAccept = function () {
    localStorage.setItem(CC_KEY, "accepted");
    ccHide();
    ccLoadGA();
  };

  window.ccReject = function () {
    localStorage.setItem(CC_KEY, "rejected");
    ccHide();
  };

  function ccStartCountdown() {
    var secsEl = document.getElementById("ccSecs");
    _ccSeconds = 15;
    _ccInterval = setInterval(function () {
      _ccSeconds--;
      if (secsEl) secsEl.textContent = _ccSeconds;
      if (_ccSeconds <= 0) {
        clearInterval(_ccInterval);
        // بعد 15 ثانية بدون تفاعل: أوقف الـ animation فقط — الإشعار يبقى ظاهراً
        var bar = document.getElementById("ccTimerBar");
        if (bar) bar.style.display = "none";
        var counter = document.getElementById("ccCounter");
        if (counter) counter.style.display = "none";
      }
    }, 1000);
  }

  function ccShow() {
    var existing = localStorage.getItem(CC_KEY);
    if (existing) {
      if (existing === "accepted") ccLoadGA();
      return;
    }
    // فقط عند وجود authArea (صفحة الدخول)
    var authArea = document.getElementById("authArea");
    if (!authArea || authArea.classList.contains("hidden")) return;

    var el = document.getElementById("cookieConsent");
    if (!el) return;

    // تأخير بسيط للدخول
    setTimeout(function () {
      el.classList.add("cc-visible");
      ccStartCountdown();
    }, 800);
  }

  // شغّل عند تحميل الصفحة
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ccShow);
  } else {
    ccShow();
  }

  // راقب تغيير حالة auth (لو authArea ظهر لاحقاً)
  var _origShowAuth = null;
  var _authObserver = new MutationObserver(function () {
    var existing = localStorage.getItem(CC_KEY);
    if (existing) return;
    var authArea = document.getElementById("authArea");
    var banner = document.getElementById("cookieConsent");
    if (!authArea || !banner) return;
    if (
      !authArea.classList.contains("hidden") &&
      !banner.classList.contains("cc-visible")
    ) {
      banner.classList.add("cc-visible");
      ccStartCountdown();
    }
  });

  var authEl = document.getElementById("authArea");
  if (authEl) {
    _authObserver.observe(authEl, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }
})();

/* ══════════════════════════════════════════════
   Delete User Data — Danger Zone
   ══════════════════════════════════════════════ */
function openDeleteConfirm() {
  var modal = document.getElementById("confirmDeleteModal");
  if (modal) modal.classList.add("cdm-open");
}

function closeDeleteConfirm() {
  var modal = document.getElementById("confirmDeleteModal");
  if (modal) modal.classList.remove("cdm-open");
  // reset button state
  var btn = document.getElementById("cdmConfirmBtn");
  var spin = document.getElementById("cdmSpinner");
  var icon = document.getElementById("cdmTrashIcon");
  var label = document.getElementById("cdmBtnLabel");
  if (btn) btn.disabled = false;
  if (spin) spin.style.display = "none";
  if (icon) icon.style.display = "inline-block";
  if (label) label.textContent = "نعم، احذف بياناتي";
}

async function executeDeleteUserData() {
  var btn = document.getElementById("cdmConfirmBtn");
  var spin = document.getElementById("cdmSpinner");
  var icon = document.getElementById("cdmTrashIcon");
  var label = document.getElementById("cdmBtnLabel");

  // Show loading state
  if (btn) btn.disabled = true;
  if (spin) spin.style.display = "inline-block";
  if (icon) icon.style.display = "none";
  if (label) label.textContent = "جارِ الحذف...";

  try {
    var sessionRes = await _supabase.auth.getSession();
    var currentUser =
      sessionRes && sessionRes.data && sessionRes.data.session
        ? sessionRes.data.session.user
        : null;

    if (!currentUser) {
      if (typeof toast === "function")
        toast("لم يتم التعرف على حسابك. يرجى تسجيل الدخول أولاً.", "error");
      closeDeleteConfirm();
      return;
    }

    // Call Edge Function to delete user completely (profile + auth)
    var accessToken = sessionRes.data.session
      ? sessionRes.data.session.access_token
      : null;

    var deleteRes = await fetch(SUPABASE_URL + "/functions/v1/swift-endpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
    });

    if (!deleteRes.ok) {
      var deleteJson = await deleteRes.json().catch(function () {
        return {};
      });
      if (typeof toast === "function")
        toast(
          "حدث خطأ أثناء الحذف: " + (deleteJson.error || "خطأ غير معروف"),
          "error",
        );
      closeDeleteConfirm();
      return;
    }
    var deleteJson = await deleteRes.json();

    // Sign out locally after full deletion
    await _supabase.auth.signOut();

    closeDeleteConfirm();
    if (typeof toast === "function") toast("تم حذف بياناتك بنجاح.", "success");

    // Redirect to home after short delay
    setTimeout(function () {
      window.location.reload();
    }, 1800);
  } catch (err) {
    if (typeof toast === "function")
      toast("خطأ غير متوقع: " + (err.message || err), "error");
    closeDeleteConfirm();
  }
}

/* ══════════════════════════════════════════════
   Custom Select System — Premium Dark UI
   Replaces all native <select class="inp"> with
   a beautiful centered dark-blue dropdown panel.
   ══════════════════════════════════════════════ */
(function () {
  "use strict";

  var overlay = null;
  var activeNative = null;
  var activeTrigger = null;

  /* ── Build singleton overlay ── */
  function buildOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.id = "cs-overlay";
    overlay.innerHTML =
      '<div id="cs-panel">' +
      '<div id="cs-search-wrap" style="display:none">' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">' +
      '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
      "</svg>" +
      '<input id="cs-search" type="text" placeholder="بحث..." autocomplete="off"/>' +
      "</div>" +
      '<div id="cs-list"></div>' +
      "</div>";

    document.body.appendChild(overlay);

    /* Close on backdrop click */
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeOverlay();
    });

    /* Close on Escape */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && activeNative) closeOverlay();
    });

    /* Search filter */
    document.getElementById("cs-search").addEventListener("input", function () {
      filterList(this.value.trim());
    });
  }

  /* ── Filter visible items ── */
  function filterList(q) {
    var lq = q.toLowerCase();
    var items = document.querySelectorAll("#cs-list .cs-item");
    var groups = document.querySelectorAll("#cs-list .cs-group");

    items.forEach(function (item) {
      var match = !q || item.textContent.toLowerCase().indexOf(lq) !== -1;
      item.style.display = match ? "" : "none";
    });

    groups.forEach(function (group) {
      var hasVisible = [].some.call(
        group.querySelectorAll(".cs-item"),
        function (i) {
          return i.style.display !== "none";
        },
      );
      group.style.display = hasVisible ? "" : "none";
    });
  }

  /* ── Open overlay ── */
  function openOverlay(triggerEl, nativeSelect) {
    buildOverlay();

    /* Deactivate previous trigger */
    if (activeTrigger) activeTrigger.classList.remove("cs-active");

    activeNative = nativeSelect;
    activeTrigger = triggerEl;
    triggerEl.classList.add("cs-active");
    triggerEl.setAttribute("aria-expanded", "true");

    var list = document.getElementById("cs-list");
    var searchWrap = document.getElementById("cs-search-wrap");
    var searchInput = document.getElementById("cs-search");

    list.innerHTML = "";
    searchInput.value = "";

    /* Show search only when there are many options */
    var totalOpts = nativeSelect.options.length;
    searchWrap.style.display = totalOpts > 6 ? "flex" : "none";

    /* Build list items from native select children */
    [].forEach.call(nativeSelect.children, function (child) {
      if (child.tagName === "OPTGROUP") {
        var grpEl = document.createElement("div");
        grpEl.className = "cs-group";

        var grpLabel = document.createElement("div");
        grpLabel.className = "cs-group-label";
        grpLabel.textContent = child.label;
        grpEl.appendChild(grpLabel);

        [].forEach.call(child.children, function (opt) {
          grpEl.appendChild(buildItem(opt, nativeSelect, triggerEl));
        });

        list.appendChild(grpEl);
      } else {
        if (list.children.length > 0) {
          /* tiny divider between placeholder and real items */
          if (!child.value && list.children.length === 0) {
            var div = document.createElement("div");
            div.className = "cs-divider";
            list.appendChild(div);
          }
        }
        list.appendChild(buildItem(child, nativeSelect, triggerEl));
      }
    });

    /* Highlight current value */
    highlightSelected(nativeSelect.value);

    overlay.classList.add("cs-open");
    document.body.style.overflow = "hidden";

    /* Auto-focus search if shown */
    if (searchWrap.style.display !== "none") {
      setTimeout(function () {
        searchInput.focus();
      }, 120);
    }
  }

  /* ── Build a single item ── */
  function buildItem(opt, nativeSelect, triggerEl) {
    var item = document.createElement("div");
    item.className = "cs-item" + (!opt.value ? " cs-placeholder" : "");
    item.dataset.value = opt.value;
    item.textContent = opt.textContent;

    item.addEventListener("click", function () {
      /* Update native select */
      nativeSelect.value = opt.value;

      /* Update trigger label */
      syncTriggerLabel(triggerEl, nativeSelect);

      /* Fire change event so existing handlers run */
      var evt = new Event("change", { bubbles: true });
      nativeSelect.dispatchEvent(evt);

      /* Also call inline onchange if present (belt + suspenders) */
      if (typeof nativeSelect.onchange === "function") {
        try {
          nativeSelect.onchange();
        } catch (e) {}
      }

      closeOverlay();
    });

    return item;
  }

  /* ── Highlight selected item ── */
  function highlightSelected(value) {
    [].forEach.call(
      document.querySelectorAll("#cs-list .cs-item"),
      function (item) {
        item.classList.toggle(
          "cs-selected",
          item.dataset.value === value && value !== "",
        );
      },
    );
  }

  /* ── Sync trigger label to native select's current value ── */
  function syncTriggerLabel(triggerEl, nativeSelect) {
    var label = triggerEl.querySelector(".cs-trigger-label");
    if (!label) return;
    var sel = nativeSelect.options[nativeSelect.selectedIndex];
    if (sel) {
      label.textContent = sel.textContent;
      label.classList.toggle("cs-has-value", !!sel.value);
    }
  }

  /* ── Close overlay ── */
  function closeOverlay() {
    if (activeTrigger) {
      activeTrigger.classList.remove("cs-active");
      activeTrigger.setAttribute("aria-expanded", "false");
    }
    if (overlay) overlay.classList.remove("cs-open");
    document.body.style.overflow = "";
    activeNative = null;
    activeTrigger = null;
  }

  /* ── Initialize one native select ── */
  function initSelect(nativeSelect) {
    if (nativeSelect.dataset.csInit) return;
    nativeSelect.dataset.csInit = "1";

    /* ── Wrapper (inherits layout from native select) ── */
    var wrapper = document.createElement("div");
    wrapper.className = "cs-wrapper";

    /* Transfer layout-critical inline styles to wrapper */
    var s = nativeSelect.style;
    if (s.flex) wrapper.style.flex = s.flex;
    if (s.minWidth) wrapper.style.minWidth = s.minWidth;
    if (s.maxWidth) wrapper.style.maxWidth = s.maxWidth;
    if (s.marginTop) wrapper.style.marginTop = s.marginTop;
    if (s.width && s.width !== "100%") wrapper.style.width = s.width;

    /* ── Trigger ── */
    var trigger = document.createElement("div");
    trigger.className = "cs-trigger inp";
    trigger.setAttribute("tabindex", "0");
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    /* Apply padding from native select */
    var padding = s.padding || "12px 16px";
    trigger.style.padding = padding;

    /* ── Label ── */
    var label = document.createElement("span");
    label.className = "cs-trigger-label";

    var selIdx = nativeSelect.selectedIndex;
    var selOpt = nativeSelect.options[selIdx];
    if (selOpt) {
      label.textContent = selOpt.textContent;
      if (selOpt.value) label.classList.add("cs-has-value");
    }

    /* ── Arrow ── */
    var arrow = document.createElement("span");
    arrow.className = "cs-arrow";
    arrow.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="6 9 12 15 18 9"/>' +
      "</svg>";

    trigger.appendChild(label);
    trigger.appendChild(arrow);

    /* ── Hide native select ── */
    nativeSelect.style.cssText =
      "position:absolute;opacity:0;height:0;width:0;pointer-events:none;overflow:hidden;";

    /* ── Insert wrapper before native select ── */
    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
    wrapper.appendChild(trigger);
    wrapper.appendChild(nativeSelect);

    /* ── Store refs for programmatic sync ── */
    nativeSelect._csTrigger = trigger;
    nativeSelect._csLabel = label;

    /* ── Events ── */
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (activeNative === nativeSelect) {
        closeOverlay();
      } else {
        openOverlay(trigger, nativeSelect);
      }
    });

    trigger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (activeNative === nativeSelect) {
          closeOverlay();
        } else {
          openOverlay(trigger, nativeSelect);
        }
      }
    });

    /* Watch for options added dynamically (subjects loaded later) */
    var optObs = new MutationObserver(function () {
      /* Re-sync label if selected option text changed */
      var curr = nativeSelect.options[nativeSelect.selectedIndex];
      if (curr) {
        label.textContent = curr.textContent;
        label.classList.toggle("cs-has-value", !!curr.value);
      }
    });
    optObs.observe(nativeSelect, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /* ── Patch HTMLSelectElement.value setter for programmatic changes ── */
  (function () {
    try {
      var proto = HTMLSelectElement.prototype;
      var origDesc = Object.getOwnPropertyDescriptor(proto, "value");
      if (!origDesc || !origDesc.set) return;

      Object.defineProperty(proto, "value", {
        get: origDesc.get,
        set: function (v) {
          origDesc.set.call(this, v);
          if (this._csLabel) {
            var sel = this.options[this.selectedIndex];
            if (sel) {
              this._csLabel.textContent = sel.textContent;
              this._csLabel.classList.toggle("cs-has-value", !!sel.value);
            }
          }
        },
        configurable: true,
        enumerable: origDesc.enumerable,
      });
    } catch (err) {
      /* fail silently */
    }
  })();

  /* ── Init all selects + watch for dynamically added ones ── */
  function initAll() {
    document.querySelectorAll("select.inp").forEach(initSelect);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  /* Watch for selects added to DOM later */
  var domObs = new MutationObserver(function (mutations) {
    mutations.forEach(function (mut) {
      [].forEach.call(mut.addedNodes, function (node) {
        if (!node || node.nodeType !== 1) return;
        if (node.matches && node.matches("select.inp")) initSelect(node);
        if (node.querySelectorAll) {
          node.querySelectorAll("select.inp").forEach(initSelect);
        }
      });
    });
  });

  if (document.body) {
    domObs.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      domObs.observe(document.body, { childList: true, subtree: true });
    });
  }

  /* Expose for external use */
  window.csInitAll = initAll;
})();
