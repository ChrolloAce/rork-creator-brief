// Client-safe UI translations for the public brief pages. The creator picks a
// language with the EN/ES toggle (cookie `sb_lang`); server pages read it via
// lib/lang.ts and brief CONTENT is machine-translated + cached via
// lib/translate.ts. This file only covers the fixed UI chrome.

export type Lang = "en" | "es";

export const LANG_COOKIE = "sb_lang";

export function normalizeLang(v: unknown): Lang {
  return v === "es" ? "es" : "en";
}

const en = {
  // Nav / sidebar / shell
  plan: "Plan",
  contentCalendar: "Content Calendar",
  calendarMeta: "What to film each day",
  onboarding: "Onboarding",
  onboardingComplete: "Complete ✓",
  startHere: "Start here",
  overview: "Overview",
  overviewMeta: "The brief",
  formats: "Formats",
  briefWord: "Brief",
  creatorGuide: "Creator guide",
  logOut: "Log out",
  builtForTeam: "Built for the team",
  goToCalendar: "Go to Calendar",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  language: "Language",

  // Overview view
  creatorBrief: "Creator Brief",
  accountSetup: "Account setup",
  platformWord: "platform",
  platformsWord: "platforms",
  coreValueProps: "Core value props",
  audienceHeading: "Who you're talking to",
  brandTagline: "Brand tagline",
  howToUseBrief: "How to use this brief",

  // Format view
  script: "Script",
  topExamples: "Top-performing examples",
  videoWord: "video",
  videosWord: "videos",
  structure: "Shot-by-shot structure",
  hooksFit: "Hooks that fit this format",
  hooksWord: "hooks",
  clickToCopy: "Click any to copy",
  copy: "Copy",
  copied: "Copied",
  copyHook: "Copy hook",
  whyItWorks: "Why it works: ",
  formatLabel: "Format",
  references: "references",
  assetsToUse: "Assets to use",
  fileWord: "file",
  filesWord: "files",
  overlayExample: "Overlay example",
  download: "Download",
  bibleVerse: "Bible verse",
  pickBackground: "Pick a background (or go random), then tap Download.",
  random: "Random",
  soundsToUse: "Sounds to use",
  soundWord: "sound",
  soundsWord: "sounds",
  openSound: "Open sound",
  copyLink: "Copy link",
  soundsHint:
    "Tap a sound to open it, then hit Use this sound in the app to record with it.",
  untitledSound: "Sound",

  // Public stats bar
  statVideos: "Videos",
  statViews: "Total Views",
  statLikes: "Total Likes",
  statComments: "Total Comments",
  statShares: "Total Shares",
  statEngagementRate: "Engagement %",
  statCommentPct: "Comment %",
  statLikePct: "Like %",
  statAvgViews: "Avg Views",

  // Content calendar
  whatToFilm: "What to film, and when",
  tapDay:
    "Tap any highlighted day to see the scripts to record. Look ahead and batch-record several at once.",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  today: "Today",
  toFilm: "To film",
  doneWord: "Done",
  doneSuffix: "done",
  allDone: "all done",
  scriptWord: "script",
  scriptsWord: "scripts",
  toFilmSuffix: "to film",
  noteLabel: "Note: ",
  openFormat: "Open format →",
  markDone: "Mark as done",
  doneCheck: "✓ Done",
  noDays: "No days scheduled yet.",
  pickDay: "Pick a highlighted day above to see the scripts.",

  // Onboarding flow
  watchVideo: "Watch video ↗",
  question: "Question",
  choose: "Choose…",
  yes: "Yes",
  back: "← Back",
  next: "Next →",
  continueArrow: "Continue →",
  enterBrief: "Enter the brief →",
  unlockBrief: "Unlock the brief →",
  unlocking: "Unlocking…",
  createAccount: "Create account",
  logIn: "Log in",
  yourName: "Your name",
  email: "Email",
  password: "Password",
  accessCode: "Access code",
  namePlaceholder: "First + last",
  emailPlaceholder: "you@email.com",
  passwordNewPlaceholder: "At least 6 characters",
  passwordPlaceholder: "Your password",
  codePlaceholder: "Code we send you",
  signedInAs: "Signed in as",
  ratingsWord: "ratings",
  gateHeading: "One last step to begin",
  gateBody:
    "Message us to officially begin. Once you reach out we'll send you your access code over WhatsApp. Enter it below to unlock the brief.",
  errEnterCode: "Enter your access code.",
  errEnterName: "Enter your name.",
  errEnterEmailPw: "Enter your email and password.",
  errWrongCode: "That code isn't right. Check with us and try again.",
  errGeneric: "Something went wrong.",
  errSignIn: "Could not sign you in.",
};

export type UIKey = keyof typeof en;

const es: Record<UIKey, string> = {
  plan: "Plan",
  contentCalendar: "Calendario de contenido",
  calendarMeta: "Qué grabar cada día",
  onboarding: "Onboarding",
  onboardingComplete: "Completado ✓",
  startHere: "Empieza aquí",
  overview: "Resumen",
  overviewMeta: "El brief",
  formats: "Formatos",
  briefWord: "Brief",
  creatorGuide: "Guía del creador",
  logOut: "Cerrar sesión",
  builtForTeam: "Hecho para el equipo",
  goToCalendar: "Ir al calendario",
  openMenu: "Abrir menú",
  closeMenu: "Cerrar menú",
  language: "Idioma",

  creatorBrief: "Brief para creadores",
  accountSetup: "Configuración de cuentas",
  platformWord: "plataforma",
  platformsWord: "plataformas",
  coreValueProps: "Propuestas de valor",
  audienceHeading: "A quién le hablas",
  brandTagline: "Eslogan de la marca",
  howToUseBrief: "Cómo usar este brief",

  script: "Guion",
  topExamples: "Ejemplos con mejor rendimiento",
  videoWord: "video",
  videosWord: "videos",
  structure: "Estructura plano por plano",
  hooksFit: "Hooks para este formato",
  hooksWord: "hooks",
  clickToCopy: "Toca uno para copiarlo",
  copy: "Copiar",
  copied: "Copiado",
  copyHook: "Copiar hook",
  whyItWorks: "Por qué funciona: ",
  formatLabel: "Formato",
  references: "referencias",
  assetsToUse: "Materiales para usar",
  fileWord: "archivo",
  filesWord: "archivos",
  overlayExample: "Ejemplo de overlay",
  download: "Descargar",
  bibleVerse: "Versículo bíblico",
  pickBackground: "Elige un fondo (o uno al azar) y toca Descargar.",
  random: "Aleatorio",
  soundsToUse: "Sonidos para usar",
  soundWord: "sonido",
  soundsWord: "sonidos",
  openSound: "Abrir sonido",
  copyLink: "Copiar link",
  soundsHint:
    "Toca un sonido para abrirlo y dale a Usar este sonido en la app para grabar con él.",
  untitledSound: "Sonido",

  statVideos: "Videos",
  statViews: "Vistas totales",
  statLikes: "Likes totales",
  statComments: "Comentarios",
  statShares: "Compartidos",
  statEngagementRate: "Interacción %",
  statCommentPct: "% comentarios",
  statLikePct: "% likes",
  statAvgViews: "Vistas promedio",

  whatToFilm: "Qué grabar y cuándo",
  tapDay:
    "Toca cualquier día resaltado para ver los guiones a grabar. Mira los próximos días y graba varios de una vez.",
  prevMonth: "Mes anterior",
  nextMonth: "Mes siguiente",
  today: "Hoy",
  toFilm: "Por grabar",
  doneWord: "Listo",
  doneSuffix: "listos",
  allDone: "todo listo",
  scriptWord: "guion",
  scriptsWord: "guiones",
  toFilmSuffix: "por grabar",
  noteLabel: "Nota: ",
  openFormat: "Abrir formato →",
  markDone: "Marcar como listo",
  doneCheck: "✓ Listo",
  noDays: "Aún no hay días programados.",
  pickDay: "Elige un día resaltado arriba para ver los guiones.",

  watchVideo: "Ver video ↗",
  question: "Pregunta",
  choose: "Elige…",
  yes: "Sí",
  back: "← Atrás",
  next: "Siguiente →",
  continueArrow: "Continuar →",
  enterBrief: "Entrar al brief →",
  unlockBrief: "Desbloquear el brief →",
  unlocking: "Desbloqueando…",
  createAccount: "Crear cuenta",
  logIn: "Iniciar sesión",
  yourName: "Tu nombre",
  email: "Email",
  password: "Contraseña",
  accessCode: "Código de acceso",
  namePlaceholder: "Nombre + apellido",
  emailPlaceholder: "tu@email.com",
  passwordNewPlaceholder: "Mínimo 6 caracteres",
  passwordPlaceholder: "Tu contraseña",
  codePlaceholder: "El código que te enviamos",
  signedInAs: "Sesión iniciada como",
  ratingsWord: "calificaciones",
  gateHeading: "Un último paso para empezar",
  gateBody:
    "Escríbenos para empezar oficialmente. Cuando nos contactes te enviaremos tu código de acceso por WhatsApp. Ingrésalo abajo para desbloquear el brief.",
  errEnterCode: "Ingresa tu código de acceso.",
  errEnterName: "Ingresa tu nombre.",
  errEnterEmailPw: "Ingresa tu email y contraseña.",
  errWrongCode: "Ese código no es correcto. Confírmalo con nosotros e intenta de nuevo.",
  errGeneric: "Algo salió mal.",
  errSignIn: "No pudimos iniciar tu sesión.",
};

const STRINGS: Record<Lang, Record<UIKey, string>> = { en, es };

export function t(lang: Lang, key: UIKey): string {
  return STRINGS[lang][key] ?? en[key];
}

// Monday-first weekday labels + month names for the calendar grid.
export const CAL_WEEKDAYS: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
};

export const CAL_MONTHS: Record<Lang, string[]> = {
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  es: [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ],
};
