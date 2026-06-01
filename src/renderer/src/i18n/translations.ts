export type Lang = 'en' | 'ar'
export type Dir = 'ltr' | 'rtl'

/** The full set of UI strings — one entry per language. */
export interface Strings {
  appName: string
  placeholder: string
  fetch: string
  fetching: string
  extracting: string
  qualitiesHint: string
  audioLabel: string
  downloading: string
  processing: string
  saved: string
  openFolder: string
  downloadFailed: string
  /** Label of the language toggle: shows the language it switches TO. */
  switchLang: string
  ready: string
  // Navigation / pages
  navHistory: string
  navSettings: string
  navHome: string
  historyTitle: string
  historyEmpty: string
  clear: string
  settingsTitle: string
  language: string
  appearance: string
  themeLight: string
  themeDark: string
  downloadLocation: string
  changePath: string
}

export const translations: Record<Lang, Strings> = {
  en: {
    appName: 'Universal Media Downloader',
    placeholder: 'Paste link from YouTube, TikTok...',
    fetch: 'Fetch',
    fetching: 'Fetching…',
    extracting: 'Reading link…',
    qualitiesHint: 'Choose a quality to download',
    audioLabel: 'MP3 Audio',
    downloading: 'Downloading',
    processing: 'Processing…',
    saved: 'Download complete',
    openFolder: 'Open Folder',
    downloadFailed: 'Download failed',
    switchLang: 'العربية',
    ready: 'Ready',
    navHistory: 'History',
    navSettings: 'Settings',
    navHome: 'Home',
    historyTitle: 'Downloads History',
    historyEmpty: 'No downloads yet',
    clear: 'Clear',
    settingsTitle: 'Settings',
    language: 'Language',
    appearance: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    downloadLocation: 'Download Location',
    changePath: 'Change Path'
  },
  ar: {
    appName: 'مُنزّل الوسائط الشامل',
    placeholder: 'أدخل أو الصق الرابط هنا...',
    fetch: 'جلب',
    fetching: 'جارٍ الجلب…',
    extracting: 'جارٍ قراءة الرابط…',
    qualitiesHint: 'اختر الجودة للتنزيل',
    audioLabel: 'صوت MP3',
    downloading: 'جارٍ التنزيل',
    processing: 'جارٍ المعالجة…',
    saved: 'اكتمل التنزيل',
    openFolder: 'فتح المجلد',
    downloadFailed: 'فشل التنزيل',
    switchLang: 'English',
    ready: 'جاهز',
    navHistory: 'السجل',
    navSettings: 'الإعدادات',
    navHome: 'الرئيسية',
    historyTitle: 'سجل التنزيلات',
    historyEmpty: 'لا توجد تنزيلات بعد',
    clear: 'مسح',
    settingsTitle: 'الإعدادات',
    language: 'اللغة',
    appearance: 'المظهر',
    themeLight: 'فاتح',
    themeDark: 'داكن',
    downloadLocation: 'موقع التنزيل',
    changePath: 'تعديل الموقع'
  }
}
