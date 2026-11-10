export type Role = 'Institute Admin' | 'Teacher' | 'Student'

export interface ClassItem {
  id: string
  name: string
  subject: string
  schedule: string
  code: string
  zoomLink: string
  createdBy: string
  isDemo: boolean
}

export interface Participant {
  name: string
  role: Role
  handRaised: boolean
  micOn: boolean
  cameraOn: boolean
}

export interface ChatMessage {
  id: string
  sender: string
  senderRole: Role
  kind: 'text' | 'photo' | 'file' | 'voice'
  text: string
  fileName?: string
  fileSize?: number
  dataUrl?: string
  time: string
  seen: boolean
}

export interface Announcement {
  id: string
  text: string
  author: string
  time: string
}

export interface LibraryItem {
  id: string
  title: string
  kind: 'PDF' | 'Note' | 'Audio' | 'Video' | 'Link'
  link?: string
  fileName?: string
  dataUrl?: string
  addedBy: string
  time: string
}

export interface AttendanceRecord {
  id: string
  date: string
  present: string[]
  markedBy: string
}

export interface Submission {
  id: string
  student: string
  text: string
  fileName?: string
  dataUrl?: string
  time: string
  status: 'received' | 'graded'
  grade: string
}

export interface Assignment {
  id: string
  title: string
  instructions: string
  due: string
  createdBy: string
  submissions: Submission[]
}

export interface Institute {
  name: string
  logoText: string
}

export interface Store {
  classes: ClassItem[]
  liveChat: Record<string, ChatMessage[]>
  afterChat: Record<string, ChatMessage[]>
  participants: Record<string, Participant[]>
  myClassIds: string[]
  institute: Institute
  announcements: Record<string, Announcement[]>
  library: Record<string, LibraryItem[]>
  attendance: Record<string, AttendanceRecord[]>
  assignments: Record<string, Assignment[]>
  /** Class ids the user marked as favourites (star) for the Chats Lists filter. */
  favourites: string[]
  /** The class the user opened most recently. */
  lastOpenedClassId: string | null
  /** After-class message count the user had seen, per class, for the Unread list. */
  viewedAfterChat: Record<string, number>
}

export const DEMO_CLASS: ClassItem = {
  id: 'demo-class',
  name: 'Demo Class',
  subject: 'Demo Subject',
  schedule: 'Demo schedule — a teacher can set the real day and time when creating a class',
  code: 'DEMO-2026',
  zoomLink: '',
  createdBy: 'Demo Teacher',
  isDemo: true,
}

const KEY = 'female-classes-v1'

/** Dummy demo names only — not real students. First names only, no phone numbers. */
const DUMMY_STUDENTS = ['Ayesha', 'Fatima', 'Zainab', 'Maryam']

function demoMsg(id: string, sender: string, senderRole: Role, text: string, time: string, seen: boolean): ChatMessage {
  return { id, sender, senderRole, kind: 'text', text, time, seen }
}

function demoParticipants(): Participant[] {
  return [
    { name: 'Demo Teacher', role: 'Teacher', handRaised: false, micOn: false, cameraOn: false },
    ...DUMMY_STUDENTS.map((name) => ({ name, role: 'Student' as Role, handRaised: false, micOn: false, cameraOn: false })),
  ]
}

/**
 * Full dummy demo seed. Every class, chat, announcement, library item,
 * attendance record and assignment here is DEMO data for testing only —
 * dummy classes and chats, not real students, teachers or classes.
 * Fresh users get this automatically; existing users can load it with
 * the "Load demo data" button (see App / Settings), which replaces the
 * current browser store with this seed while keeping them logged in.
 */
export function demoSeed(): Store {
  const quran: ClassItem = { id: 'demo-quran', name: 'Demo Quran Class', subject: 'Quran', schedule: 'Monday & Wednesday, 4 pm', code: 'DEMO-QURAN', zoomLink: '', createdBy: 'Demo Teacher', isDemo: true }
  const arabic: ClassItem = { id: 'demo-arabic', name: 'Demo Arabic Class', subject: 'Arabic', schedule: 'Tuesday & Thursday, 5 pm', code: 'DEMO-ARABIC', zoomLink: '', createdBy: 'Demo Teacher', isDemo: true }
  const tajweed: ClassItem = { id: 'demo-tajweed', name: 'Demo Tajweed Class', subject: 'Tajweed', schedule: 'Saturday, 10 am', code: 'DEMO-TAJWEED', zoomLink: '', createdBy: 'Demo Teacher', isDemo: true }
  const islamic: ClassItem = { id: 'demo-islamic', name: 'Demo Islamic Studies Class', subject: 'Islamic Studies', schedule: 'Friday, 3 pm', code: 'DEMO-ISLAMIC', zoomLink: '', createdBy: 'Demo Teacher', isDemo: true }
  const classes = [DEMO_CLASS, quran, arabic, tajweed, islamic]
  const ids = classes.map((c) => c.id)

  const afterChat: Record<string, ChatMessage[]> = {
    'demo-class': [
      demoMsg('dc-1', 'Demo Teacher', 'Teacher', 'Assalamu alaikum everyone. Tomorrow we will revise lesson 1, please bring your notes.', '09:00', true),
      demoMsg('dc-2', 'Ayesha', 'Student', 'Wa alaikum assalam. Teacher, will the homework be checked tomorrow?', '09:05', true),
      demoMsg('dc-3', 'Demo Teacher', 'Teacher', 'Yes, please complete the homework before class. Ask here if you get stuck.', '09:07', true),
      demoMsg('dc-4', 'Fatima', 'Student', 'Thank you, teacher. I have finished my homework.', '09:10', true),
    ],
    'demo-quran': [
      demoMsg('dq-1', 'Demo Teacher', 'Teacher', 'Assalamu alaikum. Today we recited Surah Al-Fatiha with tajweed. Please practise it at home.', '16:05', true),
      demoMsg('dq-2', 'Ayesha', 'Student', 'Wa alaikum assalam. Teacher, can you repeat the last ayah slowly in the next class?', '16:12', true),
      demoMsg('dq-3', 'Demo Teacher', 'Teacher', 'Yes, inshaAllah we will repeat it slowly at the start of the next class.', '16:15', true),
      demoMsg('dq-4', 'Zainab', 'Student', 'I practised today. Please check my recitation tomorrow.', '17:20', false),
      demoMsg('dq-5', 'Maryam', 'Student', 'Same here, I need help with one word in the second ayah.', '17:25', false),
      demoMsg('dq-6', 'Fatima', 'Student', 'Teacher, what is the homework for Monday?', '17:30', false),
    ],
    'demo-arabic': [
      demoMsg('da-1', 'Demo Teacher', 'Teacher', 'Assalamu alaikum. New Arabic words for this week are in the library notes. Please learn five words a day.', '17:05', true),
      demoMsg('da-2', 'Fatima', 'Student', 'Wa alaikum assalam. I have learned the first five words today.', '17:10', true),
      demoMsg('da-3', 'Ayesha', 'Student', 'Teacher, please explain the meaning of the third word again.', '17:14', true),
      demoMsg('da-4', 'Demo Teacher', 'Teacher', 'Of course. I will explain it again in the next class, and it is also written in the notes.', '17:16', true),
      demoMsg('da-5', 'Zainab', 'Student', 'Thank you, teacher. My homework is ready.', '17:20', true),
    ],
    'demo-tajweed': [
      demoMsg('dt-1', 'Demo Teacher', 'Teacher', 'Assalamu alaikum. Saturday class will focus on the rules of noon sakinah. Please listen to the practice notes first.', '10:05', true),
      demoMsg('dt-2', 'Maryam', 'Student', 'Wa alaikum assalam. I listened to the notes. One rule is still difficult for me.', '10:12', true),
      demoMsg('dt-3', 'Demo Teacher', 'Teacher', 'No problem, we will practise that rule together in class.', '10:15', false),
      demoMsg('dt-4', 'Ayesha', 'Student', 'Teacher, is the class at the same time this Saturday?', '11:00', false),
      demoMsg('dt-5', 'Fatima', 'Student', 'Yes, Saturday 10 am, inshaAllah.', '11:02', false),
    ],
    'demo-islamic': [
      demoMsg('di-1', 'Demo Teacher', 'Teacher', 'Assalamu alaikum. This Friday we will talk about good manners in daily life. Think of one example to share.', '15:05', true),
      demoMsg('di-2', 'Zainab', 'Student', 'Wa alaikum assalam. I will share an example about helping at home.', '15:10', true),
      demoMsg('di-3', 'Demo Teacher', 'Teacher', 'JazakAllah khair, that is a good example.', '15:12', true),
      demoMsg('di-4', 'Maryam', 'Student', 'Teacher, please share the lesson notes after class.', '15:20', true),
    ],
  }

  const announcements: Record<string, Announcement[]> = {}
  const announcementTexts: Record<string, [string, string]> = {
    'demo-class': ['Demo announcement: Class timing for tomorrow is confirmed. Please join on time.', 'Demo announcement: Homework for lesson 1 is due tomorrow.'],
    'demo-quran': ['Demo announcement: Quran class on Monday will start with a short revision of Surah Al-Fatiha.', 'Demo announcement: Please practise your recitation at home before Wednesday.'],
    'demo-arabic': ['Demo announcement: Arabic vocabulary test is next Thursday — only the words in the library notes.', 'Demo announcement: New Arabic notes are added to the library for this week.'],
    'demo-tajweed': ['Demo announcement: Tajweed class on Saturday will practise the rules of noon sakinah.', 'Demo announcement: Please listen to the practice notes before Saturday.'],
    'demo-islamic': ['Demo announcement: Islamic Studies class on Friday will discuss good manners in daily life.', 'Demo announcement: Lesson notes for Friday are in the library.'],
  }
  for (const c of classes) {
    announcements[c.id] = announcementTexts[c.id].map((text, i) => ({ id: `${c.id}-ann-${i + 1}`, text, author: 'Demo Teacher', time: i === 0 ? '08:00' : '08:30' }))
  }

  const library: Record<string, LibraryItem[]> = {}
  const libraryTitles: Record<string, [string, string]> = {
    'demo-class': ['Demo notes — Lesson 1 revision', 'Demo notes — Homework guide'],
    'demo-quran': ['Demo notes — Surah Al-Fatiha recitation guide', 'Demo notes — Tajweed practice points'],
    'demo-arabic': ['Demo notes — Arabic words, week 1', 'Demo notes — Arabic words, week 2'],
    'demo-tajweed': ['Demo notes — Rules of noon sakinah', 'Demo notes — Tajweed practice notes'],
    'demo-islamic': ['Demo notes — Good manners in daily life', 'Demo notes — Friday lesson summary'],
  }
  for (const c of classes) {
    library[c.id] = libraryTitles[c.id].map((title, i) => ({ id: `${c.id}-lib-${i + 1}`, title, kind: 'Note' as const, addedBy: 'Demo Teacher', time: i === 0 ? '08:00' : '08:30' }))
  }

  const attendance: Record<string, AttendanceRecord[]> = {}
  for (const c of classes) {
    attendance[c.id] = [{ id: `${c.id}-att-1`, date: '2026-11-01', present: [...DUMMY_STUDENTS], markedBy: 'Demo Teacher' }]
  }

  const assignments: Record<string, Assignment[]> = {}
  for (const c of classes) {
    assignments[c.id] = [
      {
        id: `${c.id}-asg-1`,
        title: `Demo assignment — ${c.subject} practice`,
        instructions: 'Demo assignment only. Complete the practice work and submit your answer here.',
        due: 'Friday',
        createdBy: 'Demo Teacher',
        submissions: [{ id: `${c.id}-sub-1`, student: 'Ayesha', text: 'Demo submission: I have completed the practice work.', time: '18:00', status: 'graded' as const, grade: 'A — Good work' }],
      },
    ]
  }
  // A second, open assignment in the two main demo classes.
  assignments['demo-quran'].push({ id: 'demo-quran-asg-2', title: 'Demo assignment — Recitation practice', instructions: 'Demo assignment only. Practise the recitation and submit a short note about what you practised.', due: 'Monday', createdBy: 'Demo Teacher', submissions: [] })
  assignments['demo-arabic'].push({ id: 'demo-arabic-asg-2', title: 'Demo assignment — Learn five words', instructions: 'Demo assignment only. Learn five new Arabic words and write their meanings.', due: 'Thursday', createdBy: 'Demo Teacher', submissions: [] })

  return {
    classes,
    liveChat: {
      'demo-quran': [
        demoMsg('lq-1', 'Demo Teacher', 'Teacher', 'Assalamu alaikum, welcome to the live Quran class.', '16:00', true),
        demoMsg('lq-2', 'Ayesha', 'Student', 'Wa alaikum assalam, teacher.', '16:01', true),
        demoMsg('lq-3', 'Demo Teacher', 'Teacher', 'Please keep your mic muted unless you are asked to recite.', '16:02', true),
      ],
    },
    afterChat,
    participants: Object.fromEntries(ids.map((id) => [id, demoParticipants()])),
    myClassIds: ids,
    institute: { name: 'Demo Institute', logoText: 'BC' },
    announcements,
    library,
    attendance,
    assignments,
    favourites: ['demo-quran'],
    lastOpenedClassId: null,
    // Unread: Quran (3 unread) and Tajweed (3 unread) — their viewed counts lag their message counts.
    viewedAfterChat: {
      'demo-class': 4,
      'demo-quran': 3,
      'demo-arabic': 5,
      'demo-tajweed': 2,
      'demo-islamic': 4,
    },
  }
}

function emptyStore(): Store {
  return demoSeed()
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>
      if (parsed.classes && parsed.classes.length > 0) {
        // Migrate v1 stores that predate institute/announcements/library/attendance/assignments.
        return { ...emptyStore(), ...parsed, classes: parsed.classes, myClassIds: parsed.myClassIds || ['demo-class'], favourites: parsed.favourites || [], lastOpenedClassId: parsed.lastOpenedClassId || null, viewedAfterChat: parsed.viewedAfterChat || {} }
      }
    }
  } catch {
    /* fall through to seed */
  }
  return emptyStore()
}

export function saveStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    alert('This file is too large to save in this browser. Please try a smaller photo or file (under 3 MB).')
    throw new Error('storage full')
  }
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Guest'
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
