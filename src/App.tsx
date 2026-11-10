import React, { useEffect, useRef, useState } from 'react'
import {
  Announcement, Assignment, ChatMessage, ClassItem, LibraryItem, Participant, Role, Store,
  demoSeed, firstName, loadStore, newId, saveStore, timeNow, todayStr,
} from './lib/store'
import { Settings, loadSettings, saveSettings } from './lib/settings'
import { checkRemoteReachable, dbConfigured, dbModeLabel, loadRemoteState, saveRemoteState } from './lib/db'
import { CORNER_FLOWER_IMAGE, FRONT_PAGE_IMAGE } from './lib/assets'

interface User { name: string; email: string; role: Role }

const SESSION_KEY = 'banat-session-v1'
const MAX_FILE_MB = 8

function readFileAsDataUrl(file: File, done: (dataUrl: string) => void) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    alert(`Please choose a file under ${MAX_FILE_MB} MB.`)
    return
  }
  const reader = new FileReader()
  reader.onload = () => done(String(reader.result))
  reader.readAsDataURL(file)
}

function CornerFlower() {
  return (
    <span className="corner-flower" aria-hidden="true">
      <img src={CORNER_FLOWER_IMAGE} alt="" />
    </span>
  )
}

const EMOJIS = ['😊', '😍', '👍', '🤲', '🌹', '📖', '🕌', '✨', '💐', '🎉', '🙂', '😄', '🤗', '📚', '✏️', '🌙']

function ChatPanel({ messages, user, onSend, onViewed, showReadReceipts, showFirstNames }: {
  messages: ChatMessage[]
  user: User
  onSend: (m: Omit<ChatMessage, 'id' | 'time' | 'seen'>) => void
  onViewed: () => void
  showReadReceipts: boolean
  showFirstNames: boolean
}) {
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [showEmoji, setShowEmoji] = useState(false)
  const [voiceNote, setVoiceNote] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const voiceInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { onViewed() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const sendText = () => {
    if (!text.trim()) return
    onSend({ sender: user.name, senderRole: user.role, kind: 'text', text: text.trim() })
    setText('')
    setShowEmoji(false)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, kind: 'photo' | 'file') => {
    const file = e.target.files?.[0]
    if (!file) return
    readFileAsDataUrl(file, (dataUrl) => {
      onSend({ sender: user.name, senderRole: user.role, kind, text: kind === 'photo' ? 'Shared a photo' : `Shared a file: ${file.name}`, fileName: file.name, fileSize: file.size, dataUrl })
    })
    e.target.value = ''
  }

  const handleVoiceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    readFileAsDataUrl(file, (dataUrl) => {
      onSend({ sender: user.name, senderRole: user.role, kind: 'voice', text: 'Voice note', fileName: file.name, fileSize: file.size, dataUrl })
      setVoiceNote('')
    })
    e.target.value = ''
  }

  const pickVoiceFile = () => {
    voiceInputRef.current?.click()
  }

  // Fallback: sending a voice note must always stay possible.
  // It only appears when real recording actually failed — never as the
  // first response to tapping the mic. If the browser blocked the mic,
  // explain how to allow it and let the user choose a recording with a
  // tap, instead of opening the picker by itself.
  const openVoiceFallback = (reason: 'denied' | 'unavailable') => {
    if (reason === 'denied') {
      setVoiceNote("Microphone is blocked for this site — please allow microphone access in your browser settings, then tap the mic again to record. Or choose a recording below and it will be sent as a voice note.")
    } else {
      setVoiceNote("Recording isn't available here — choose a recording and it will be sent as a voice note instead.")
      pickVoiceFile()
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setRecSeconds(0)
  }

  const toggleRecord = async () => {
    if (recording) { stopRecording(); return }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        openVoiceFallback('unavailable')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Pick a recording format this browser supports (Safari needs mp4).
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/webm;codecs=opus'].find((t) => {
        try { return MediaRecorder.isTypeSupported(t) } catch { return false }
      })
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => onSend({ sender: user.name, senderRole: user.role, kind: 'voice', text: 'Voice note', dataUrl: String(reader.result) })
        reader.readAsDataURL(blob)
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000)
    } catch (err) {
      // Permission denied/blocked: explain, don't auto-open the picker.
      // Any other failure (no mic, in use, etc.): fall back to picking a file.
      const name = err instanceof DOMException ? err.name : ''
      openVoiceFallback(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }

  return (
    <div>
      <div className="chatbox">
        {messages.length === 0 && <p style={{ color: '#8d6e63', textAlign: 'center' }}>No messages yet. Send the first message below.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.sender === user.name ? 'mine' : ''}`}>
            <div className="meta">{showFirstNames ? `${m.sender} · ${m.senderRole}` : m.senderRole}</div>
            <div>{m.text}</div>
            {m.kind === 'photo' && m.dataUrl && <img src={m.dataUrl} alt="Shared photo" />}
            {m.kind === 'voice' && m.dataUrl && <audio controls src={m.dataUrl} />}
            {m.kind === 'file' && m.dataUrl && (
              <div><a href={m.dataUrl} download={m.fileName}>Download {m.fileName}</a> ({Math.round((m.fileSize || 0) / 1024)} KB)</div>
            )}
            <div className="msg-foot">
              <span>{m.time}</span>
              {showReadReceipts && m.sender === user.name && <span className={`ticks ${m.seen ? 'seen' : ''}`}>{m.seen ? '✓✓' : '✓'}</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {recording && (
        <div className="voice-note">
          ● Recording… {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, '0')} — tap the mic again to stop and send.
        </div>
      )}
      {voiceNote && (
        <div className="voice-note">
          {voiceNote}
          <div style={{ marginTop: 8 }}>
            <button className="btn small" onClick={pickVoiceFile}>Choose a recording instead</button>
          </div>
        </div>
      )}
      <div className="chat-inputbar">
        <button className="iconbtn" onClick={() => setShowEmoji(!showEmoji)} title="Emoji">😊</button>
        <label className="iconbtn" title="Attach a photo or file">📎<input type="file" hidden onChange={(e) => handleFile(e, 'file')} /></label>
        <label className="iconbtn" title="Take a photo with the camera">📷<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFile(e, 'photo')} /></label>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…" aria-label="Write a message"
          onKeyDown={(e) => { if (e.key === 'Enter') sendText() }} />
        <input ref={voiceInputRef} type="file" accept="audio/*" hidden onChange={handleVoiceFile} />
        <button className={`iconbtn ${recording ? 'recording' : ''}`} onClick={toggleRecord} title={recording ? 'Stop voice note' : 'Record a voice note'}>{recording ? '⏹' : '🎤'}</button>
        <button className="iconbtn send" onClick={sendText} title="Send message">➤</button>
      </div>
      {showEmoji && (
        <div className="emoji-picker">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setText((prev) => prev + e)}>{e}</button>
          ))}
        </div>
      )}
      <p style={{ fontSize: 13, color: '#8d6e63' }}>{showReadReceipts ? '✓ = delivered. ✓✓ = seen. Seen ticks update when another class member opens this chat.' : 'Read receipts are turned off in Settings, so no ticks are shown.'}</p>
    </div>
  )
}

type Tab = 'live' | 'chat' | 'announcements' | 'library' | 'attendance' | 'assignments'

function ClassView({ cls, user, store, setStore, onBack, settings }: {
  cls: ClassItem; user: User; store: Store
  setStore: (u: Store | ((s: Store) => Store)) => void; onBack: () => void; settings: Settings
}) {
  const canManage = user.role !== 'Student'
  const [tab, setTab] = useState<Tab>('live')
  const [joinedVideo, setJoinedVideo] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [micOn, setMicOn] = useState(!settings.micMutedOnJoin)
  const [annText, setAnnText] = useState('')
  const [libTitle, setLibTitle] = useState('')
  const [libKind, setLibKind] = useState<LibraryItem['kind']>('PDF')
  const [libLink, setLibLink] = useState('')
  const [attDate, setAttDate] = useState(todayStr())
  const [attPresent, setAttPresent] = useState<string[]>([])
  const [rosterName, setRosterName] = useState('')
  const [asgTitle, setAsgTitle] = useState('')
  const [asgInstructions, setAsgInstructions] = useState('')
  const [asgDue, setAsgDue] = useState('')
  const [subText, setSubText] = useState<Record<string, string>>({})
  const [gradeText, setGradeText] = useState<Record<string, string>>({})

  const participants = store.participants[cls.id] || []
  const liveMessages = store.liveChat[cls.id] || []
  const afterMessages = store.afterChat[cls.id] || []
  const announcements = store.announcements[cls.id] || []
  const library = store.library[cls.id] || []
  const attendance = store.attendance[cls.id] || []
  const assignments = store.assignments[cls.id] || []
  const students = participants.filter((p) => p.role === 'Student')

  const jitsiRoom = `BanatConnectClass${cls.id}`
  const jitsiUrl = `https://meet.jit.si/${jitsiRoom}`

  useEffect(() => {
    setStore((prev) => {
      const list = prev.participants[cls.id] || []
      if (list.some((p) => p.name === user.name)) return prev
      return { ...prev, participants: { ...prev.participants, [cls.id]: [...list, { name: user.name, role: user.role, handRaised: false, micOn: false, cameraOn: false }] } }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls.id])

  const patch = (fn: (s: Store) => Store) => setStore(fn)

  const toggleHand = () => {
    const next = !handRaised
    setHandRaised(next)
    patch((s) => ({ ...s, participants: { ...s.participants, [cls.id]: (s.participants[cls.id] || []).map((p) => p.name === user.name ? { ...p, handRaised: next } : p) } }))
  }
  const toggleMic = () => {
    const next = !micOn
    setMicOn(next)
    patch((s) => ({ ...s, participants: { ...s.participants, [cls.id]: (s.participants[cls.id] || []).map((p) => p.name === user.name ? { ...p, micOn: next } : p) } }))
  }

  const sendTo = (bucket: 'liveChat' | 'afterChat') => (m: Omit<ChatMessage, 'id' | 'time' | 'seen'>) => {
    patch((s) => {
      const next = [...(s[bucket][cls.id] || []), { ...m, id: newId(), time: timeNow(), seen: false }]
      const viewed = bucket === 'afterChat' ? { ...(s.viewedAfterChat || {}), [cls.id]: next.length } : (s.viewedAfterChat || {})
      return { ...s, [bucket]: { ...s[bucket], [cls.id]: next }, viewedAfterChat: viewed }
    })
  }
  const markViewed = (bucket: 'liveChat' | 'afterChat') => () => {
    patch((s) => {
      const list = s[bucket][cls.id] || []
      const next: Store = { ...s, [bucket]: { ...s[bucket], [cls.id]: settings.readReceipts ? list.map((m) => m.sender !== user.name ? { ...m, seen: true } : m) : list } }
      if (bucket === 'afterChat') next.viewedAfterChat = { ...(s.viewedAfterChat || {}), [cls.id]: list.length }
      return next
    })
  }
  const postAnnouncement = () => {
    if (!annText.trim()) return
    const a: Announcement = { id: newId(), text: annText.trim(), author: user.name, time: timeNow() }
    patch((s) => ({ ...s, announcements: { ...s.announcements, [cls.id]: [a, ...(s.announcements[cls.id] || [])] } }))
    setAnnText('')
  }
  const addLibraryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !libTitle.trim()) { alert('Please enter a title first, then choose a file.'); return }
    readFileAsDataUrl(file, (dataUrl) => {
      const item: LibraryItem = { id: newId(), title: libTitle.trim(), kind: libKind, fileName: file.name, dataUrl, addedBy: user.name, time: timeNow() }
      patch((s) => ({ ...s, library: { ...s.library, [cls.id]: [item, ...(s.library[cls.id] || [])] } }))
      setLibTitle('')
      setLibLink('')
    })
    e.target.value = ''
  }
  const addLibraryLink = () => {
    if (!libTitle.trim() || !libLink.trim()) { alert('Please enter a title and a link.'); return }
    const item: LibraryItem = { id: newId(), title: libTitle.trim(), kind: libKind, link: libLink.trim(), addedBy: user.name, time: timeNow() }
    patch((s) => ({ ...s, library: { ...s.library, [cls.id]: [item, ...(s.library[cls.id] || [])] } }))
    setLibTitle('')
    setLibLink('')
  }
  const addRosterStudent = () => {
    const n = firstName(rosterName)
    if (!n || n === 'Guest') return
    patch((s) => {
      const list = s.participants[cls.id] || []
      if (list.some((p) => p.name === n)) return s
      return { ...s, participants: { ...s.participants, [cls.id]: [...list, { name: n, role: 'Student', handRaised: false, micOn: false, cameraOn: false }] } }
    })
    setRosterName('')
  }
  const saveAttendance = () => {
    const rec = { id: newId(), date: attDate, present: attPresent, markedBy: user.name }
    patch((s) => ({ ...s, attendance: { ...s.attendance, [cls.id]: [rec, ...(s.attendance[cls.id] || [])] } }))
    alert(`Attendance saved for ${attDate}: ${attPresent.length} present.`)
  }
  const createAssignment = () => {
    if (!asgTitle.trim()) { alert('Please enter an assignment title.'); return }
    const a: Assignment = { id: newId(), title: asgTitle.trim(), instructions: asgInstructions.trim(), due: asgDue.trim(), createdBy: user.name, submissions: [] }
    patch((s) => ({ ...s, assignments: { ...s.assignments, [cls.id]: [a, ...(s.assignments[cls.id] || [])] } }))
    setAsgTitle('')
    setAsgInstructions('')
    setAsgDue('')
  }
  const submitAssignment = (asgId: string, file?: File) => {
    const text = (subText[asgId] || '').trim()
    if (!text && !file) { alert('Please write your answer or attach a file.'); return }
    const finish = (dataUrl?: string, fileName?: string) => {
      patch((s) => ({
        ...s, assignments: {
          ...s.assignments, [cls.id]: (s.assignments[cls.id] || []).map((a) => a.id === asgId
            ? { ...a, submissions: [...a.submissions, { id: newId(), student: user.name, text, fileName, dataUrl, time: timeNow(), status: 'received' as const, grade: '' }] } : a),
        },
      }))
      setSubText((prev) => ({ ...prev, [asgId]: '' }))
    }
    if (file) readFileAsDataUrl(file, (dataUrl) => finish(dataUrl, file.name)); else finish()
  }
  const gradeSubmission = (asgId: string, subId: string) => {
    const grade = (gradeText[subId] || '').trim()
    patch((s) => ({
      ...s, assignments: {
        ...s.assignments, [cls.id]: (s.assignments[cls.id] || []).map((a) => a.id === asgId
          ? { ...a, submissions: a.submissions.map((sub) => sub.id === subId ? { ...sub, status: sub.status === 'graded' ? 'received' as const : 'graded' as const, grade } : sub) } : a),
      },
    }))
  }

  return (
    <div className="card" style={{ position: 'relative' }}>
      <CornerFlower />
      <button className="btn secondary small" onClick={onBack}>← Back to classes</button>
      <h2 style={{ marginTop: 12 }}>{cls.name}</h2>
      <p>{cls.subject} · {cls.schedule}</p>
      <p><span className="pill">Code: {cls.code}</span>{cls.isDemo && <span className="pill warn">DEMO class — not a real class</span>}</p>

      <div className="tabstrip">
        {(['live', 'chat', 'announcements', 'library', 'attendance', 'assignments'] as Tab[]).map((tb) => (
          <button key={tb} className={`btn small ${tab === tb ? '' : 'secondary'}`} onClick={() => setTab(tb)}>
            {tb === 'live' ? 'Live class' : tb === 'chat' ? 'After-class chat' : tb.charAt(0).toUpperCase() + tb.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'live' && (
        <div>
          <h3>Live class — video room</h3>
          <p style={{ fontSize: 13, color: '#8d6e63' }}>Teacher and students join the same video room here. Allow camera and mic when the browser asks. No phone number is needed.</p>
          {!joinedVideo ? (
            <div>
              <div className="video"><div className="off"><div style={{ fontSize: 40 }}>🎥</div><p>Video room is ready — tap Start video to join.</p></div></div>
              <button className="btn" onClick={() => setJoinedVideo(true)}>Start video</button>
              <p><a href={jitsiUrl} target="_blank" rel="noreferrer">Open video room in a new tab</a></p>
            </div>
          ) : (
            <div>
              <div className="video">
                <iframe src={jitsiUrl} allow="camera; microphone; fullscreen; display-capture" title={`Live video room — ${cls.name}`} />
              </div>
              <div className="controls">
                <button className="btn small" onClick={toggleMic}>{micOn ? 'Mute mic' : 'Unmute mic'}</button>
                <button className="btn small" onClick={toggleHand}>{handRaised ? '✋ Lower hand' : '✋ Raise hand'}</button>
                <button className="btn small danger" onClick={() => setJoinedVideo(false)}>Leave video</button>
              </div>
              <p><a href={jitsiUrl} target="_blank" rel="noreferrer">Open video room in a new tab</a></p>
              <p style={{ fontSize: 13, color: '#8d6e63' }}>If the video does not appear inside the app, use the new-tab link — it opens the same room.</p>
            </div>
          )}
          <h3>Participants ({settings.showFirstNames ? 'first name only' : 'role only — names hidden in Settings'}, no phone numbers</h3>
          {participants.length === 0 ? <p style={{ color: '#8d6e63' }}>No one yet.</p> : participants.map((p: Participant) => (
            <div key={p.name} className="row" style={{ padding: '6px 0', borderTop: '1px solid #f0e8d8' }}>
              <strong>{settings.showFirstNames ? p.name : p.role}</strong> <span>({p.role})</span>
              {p.handRaised && <span className="pill">✋ Hand raised</span>}
              <span className="pill">{p.micOn ? '🎤 Mic on' : '🔇 Muted'}</span>
            </div>
          ))}
          <h3>In-class chat</h3>
          <ChatPanel messages={liveMessages} user={user} onSend={sendTo('liveChat')} onViewed={markViewed('liveChat')} showReadReceipts={settings.readReceipts} showFirstNames={settings.showFirstNames} />
        </div>
      )}

      {tab === 'chat' && (
        <div>
          <h3>After-class chat — no phone numbers</h3>
          <p style={{ fontSize: 13, color: '#8d6e63' }}>For questions and messages after the class ends. Text, photos, voice notes and files. No phone number is shown or needed.</p>
          <ChatPanel messages={afterMessages} user={user} onSend={sendTo('afterChat')} onViewed={markViewed('afterChat')} showReadReceipts={settings.readReceipts} showFirstNames={settings.showFirstNames} />
        </div>
      )}

      {tab === 'announcements' && (
        <div>
          <h3>Announcements</h3>
          {canManage && (
            <div>
              <textarea value={annText} onChange={(e) => setAnnText(e.target.value)} placeholder="Write an announcement for this class…" />
              <button className="btn small" onClick={postAnnouncement}>Post announcement</button>
            </div>
          )}
          {announcements.length === 0 ? <p style={{ color: '#8d6e63' }}>No announcements yet.</p> : announcements.map((a: Announcement) => (
            <div key={a.id} className="classrow"><strong>{a.text}</strong><br /><span style={{ color: '#8d6e63', fontSize: 13 }}>By {a.author} · {a.time}</span></div>
          ))}
        </div>
      )}

      {tab === 'library' && (
        <div>
          <h3>Digital Library</h3>
          <p style={{ fontSize: 13, color: '#8d6e63' }}>Books, PDFs, notes, audio and video for this class. Uploaded files up to {MAX_FILE_MB} MB each.</p>
          {canManage && (
            <div>
              <label>Title</label>
              <input type="text" value={libTitle} onChange={(e) => setLibTitle(e.target.value)} placeholder="e.g. Lesson notes — Week 1" />
              <label>Type</label>
              <div className="row">
                {(['PDF', 'Note', 'Audio', 'Video', 'Link'] as LibraryItem['kind'][]).map((k) => (
                  <button key={k} className={`btn small ${libKind === k ? '' : 'secondary'}`} onClick={() => setLibKind(k)}>{k}</button>
                ))}
              </div>
              <label>Link (optional — for a video / audio / PDF link)</label>
              <input type="url" value={libLink} onChange={(e) => setLibLink(e.target.value)} placeholder="https://…" />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn small" onClick={addLibraryLink}>Add link</button>
                <label className="btn secondary small" style={{ padding: '7px 12px', borderRadius: 8, fontWeight: 700 }}>
                  📤 Upload file <input type="file" hidden onChange={addLibraryFile} />
                </label>
              </div>
            </div>
          )}
          {library.length === 0 ? <p style={{ color: '#8d6e63' }}>Library is empty for this class.</p> : library.map((item: LibraryItem) => (
            <div key={item.id} className="classrow">
              <strong>{item.title}</strong> <span className="pill">{item.kind}</span><br />
              <span style={{ color: '#8d6e63', fontSize: 13 }}>Added by {item.addedBy} · {item.time}</span>
              <div>
                {item.dataUrl && <a className="btn small" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 6 }} href={item.dataUrl} download={item.fileName}>Download / open</a>}
                {item.link && <a className="btn small" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 6 }} href={item.link} target="_blank" rel="noreferrer">Open link</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          <h3>Attendance</h3>
          {canManage && (
            <div>
              <label>Date</label>
              <input type="text" value={attDate} onChange={(e) => setAttDate(e.target.value)} placeholder="YYYY-MM-DD" />
              <div className="row" style={{ marginTop: 8 }}>
                <input type="text" value={rosterName} onChange={(e) => setRosterName(e.target.value)} placeholder="Add a student first name to the roster" style={{ flex: 1, minWidth: 180 }} />
                <button className="btn small" onClick={addRosterStudent}>Add student</button>
              </div>
              {students.length === 0 ? <p style={{ color: '#8d6e63' }}>No students on the roster yet. Students appear here after they join with the class code, or add a name above.</p> :
                students.map((s) => (
                  <label key={s.name} style={{ display: 'flex', gap: 8, fontWeight: 400, margin: '8px 0' }}>
                    <input type="checkbox" checked={attPresent.includes(s.name)} onChange={(e) => setAttPresent(e.target.checked ? [...attPresent, s.name] : attPresent.filter((n) => n !== s.name))} />
                    {s.name} — present?
                  </label>
                ))}
              <button className="btn small" onClick={saveAttendance}>Save attendance</button>
            </div>
          )}
          <h3>Saved attendance</h3>
          {attendance.length === 0 ? <p style={{ color: '#8d6e63' }}>No attendance saved yet.</p> : attendance.map((r) => (
            <div key={r.id} className="classrow"><strong>{r.date}</strong> — {r.present.length} present<br /><span style={{ color: '#8d6e63', fontSize: 13 }}>{r.present.join(', ') || 'Nobody marked present'} · Marked by {r.markedBy}</span></div>
          ))}
        </div>
      )}

      {tab === 'assignments' && (
        <div>
          <h3>Assignments</h3>
          {canManage && (
            <div>
              <label>Assignment title</label>
              <input type="text" value={asgTitle} onChange={(e) => setAsgTitle(e.target.value)} placeholder="e.g. Read lesson 1 and write 5 lines" />
              <label>Instructions</label>
              <textarea value={asgInstructions} onChange={(e) => setAsgInstructions(e.target.value)} placeholder="What should students do?" />
              <label>Due (optional)</label>
              <input type="text" value={asgDue} onChange={(e) => setAsgDue(e.target.value)} placeholder="e.g. Friday" />
              <button className="btn small" onClick={createAssignment}>Create assignment</button>
            </div>
          )}
          {assignments.length === 0 ? <p style={{ color: '#8d6e63' }}>No assignments yet.</p> : assignments.map((a: Assignment) => (
            <div key={a.id} className="classrow">
              <strong>{a.title}</strong>{a.due && <span> · Due: {a.due}</span>}<br />
              <span style={{ color: '#8d6e63', fontSize: 13 }}>{a.instructions} · By {a.createdBy}</span>
              {user.role === 'Student' && (
                <div style={{ marginTop: 8 }}>
                  <textarea value={subText[a.id] || ''} onChange={(e) => setSubText((prev) => ({ ...prev, [a.id]: e.target.value }))} placeholder="Write your answer here…" />
                  <div className="row">
                    <button className="btn small" onClick={() => submitAssignment(a.id)}>Submit answer</button>
                    <label className="btn secondary small" style={{ padding: '7px 12px', borderRadius: 8, fontWeight: 700 }}>
                      📎 Attach file &amp; submit <input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) submitAssignment(a.id, f); e.target.value = '' }} />
                    </label>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <strong>Submissions ({a.submissions.length})</strong>
                {a.submissions.length === 0 ? <p style={{ color: '#8d6e63' }}>No submissions yet.</p> : a.submissions.map((sub) => (
                  <div key={sub.id} style={{ borderTop: '1px solid #f0e8d8', padding: '8px 0' }}>
                    <strong>{sub.student}</strong> · {sub.time} · <span className="pill">{sub.status}</span>{sub.grade && <span> · Grade: {sub.grade}</span>}<br />
                    <span>{sub.text}</span>
                    {sub.dataUrl && <div><a href={sub.dataUrl} download={sub.fileName}>Download {sub.fileName}</a></div>}
                    {canManage && (
                      <div className="row" style={{ marginTop: 6 }}>
                        <input type="text" value={gradeText[sub.id] ?? sub.grade} onChange={(e) => setGradeText((prev) => ({ ...prev, [sub.id]: e.target.value }))} placeholder="Grade / note, e.g. A, Good" style={{ flex: 1, minWidth: 140 }} />
                        <button className="btn small" onClick={() => gradeSubmission(a.id, sub.id)}>{sub.status === 'graded' ? 'Mark as received' : 'Mark graded'}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Screen = 'front' | 'login' | 'home' | 'class' | 'settings'
type SyncStatus = 'checking' | 'connected' | 'local' | 'unreachable'
type ListFilter = 'all' | 'unread' | 'favourites' | 'live'

function loadSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as User
    if (u && u.name && u.email && u.role) return u
    return null
  } catch {
    return null
  }
}

export default function App() {
  const [store, setStoreState] = useState<Store>(() => loadStore())
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings())
  const [user, setUser] = useState<User | null>(() => loadSession())
  const [screen, setScreen] = useState<Screen>('front')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(dbConfigured() ? 'checking' : 'local')
  const [currentClassId, setCurrentClassId] = useState<string | null>(null)
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [mainTab, setMainTab] = useState<'chats' | 'calls'>('chats')
  const [moreOpen, setMoreOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [form, setForm] = useState({ name: '', subject: '', schedule: '', code: '' })
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginRole, setLoginRole] = useState<Role>('Student')
  const [loginError, setLoginError] = useState('')
  const [instituteName, setInstituteName] = useState(store.institute.name)
  const remoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canManage = user?.role !== 'Student'

  // Startup: if Supabase is configured, pull the shared state once.
  useEffect(() => {
    if (!dbConfigured()) { setSyncStatus('local'); return }
    let cancelled = false
    checkRemoteReachable().then(async (ok) => {
      if (cancelled) return
      if (!ok) { setSyncStatus('unreachable'); return }
      const remote = await loadRemoteState()
      if (cancelled) return
      if (remote) {
        setStoreState(remote)
        try { saveStore(remote) } catch { /* ignore */ }
        setSyncStatus('connected')
      } else {
        // No shared state yet — seed it from this device's demo data.
        const local = loadStore()
        const pushed = await saveRemoteState(local)
        setSyncStatus(pushed ? 'connected' : 'unreachable')
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setStore = (updater: Store | ((s: Store) => Store)) => {
    setStoreState((prev) => {
      const next = typeof updater === 'function' ? (updater as (s: Store) => Store)(prev) : updater
      try { saveStore(next) } catch { /* saveStore already alerted */ }
      if (dbConfigured() && syncStatus !== 'local') {
        if (remoteTimer.current) clearTimeout(remoteTimer.current)
        remoteTimer.current = setTimeout(() => {
          saveRemoteState(next).then((ok) => { if (!ok) setSyncStatus('unreachable') })
        }, 1500)
      }
      return next
    })
  }

  const changeSettings = (s: Settings) => { setSettingsState(s); saveSettings(s) }

  const logout = () => {
    try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
    setUser(null)
    setScreen('login')
  }

  const enterAs = (name: string, email: string, role: Role) => {
    const cleanName = firstName(name)
    if (!cleanName || cleanName === 'Guest') { setLoginError('Please enter your first name.'); return false }
    if (!email.includes('@')) { setLoginError('Please enter a valid email address.'); return false }
    const u: User = { name: cleanName, email: email.trim(), role }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)) } catch { /* ignore */ }
    setUser(u)
    setLoginError('')
    setStore((s) => {
      const ids = s.classes.filter((c) => c.isDemo).map((c) => c.id)
      return { ...s, myClassIds: Array.from(new Set([...s.myClassIds, ...ids])) }
    })
    setScreen('home')
    return true
  }

  const enterDemo = (role: Role, demoName: string, demoEmail: string) => {
    enterAs(demoName, demoEmail, role)
  }

  const createClass = () => {
    if (!form.name.trim() || !form.subject.trim()) { alert('Please enter a class name and subject.'); return }
    const newCode = form.code.trim().toUpperCase() || `CLASS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    if (store.classes.some((c) => c.code.toUpperCase() === newCode)) { alert('That access code is already used. Please choose a different code.'); return }
    const cls: ClassItem = { id: newId(), name: form.name.trim(), subject: form.subject.trim(), schedule: form.schedule.trim() || 'Schedule not set yet', code: newCode, zoomLink: '', createdBy: user?.name || 'Teacher', isDemo: false }
    setStore((s) => ({ ...s, classes: [...s.classes, cls], myClassIds: [...s.myClassIds, cls.id] }))
    setForm({ name: '', subject: '', schedule: '', code: '' })
    openClass(cls.id)
  }

  const joinByCode = () => {
    const found = store.classes.find((c) => c.code.toUpperCase() === joinCode.trim().toUpperCase())
    if (!found) { alert('That access code was not found.'); return }
    setStore((s) => ({ ...s, myClassIds: s.myClassIds.includes(found.id) ? s.myClassIds : [...s.myClassIds, found.id] }))
    openClass(found.id)
  }

  const myClasses = store.classes.filter((c) => store.myClassIds.includes(c.id))
  const currentClass = store.classes.find((c) => c.id === currentClassId) || null

  const openClass = (id: string) => {
    setCurrentClassId(id)
    setStore((s) => ({ ...s, lastOpenedClassId: id }))
    setScreen('class')
  }
  const loadDemoData = () => {
    if (!window.confirm('Load demo data? This replaces the current classes and chats with the demo classes and dummy chats. Your login stays the same.')) return
    setStore(demoSeed())
    setMoreOpen(false)
    setMainTab('chats')
    setListFilter('all')
    setScreen('home')
  }
  const toggleFavourite = (id: string) => {
    setStore((s) => {
      const favs = s.favourites || []
      return { ...s, favourites: favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id] }
    })
  }
  const unreadCount = (c: ClassItem) => {
    const msgs = store.afterChat[c.id] || []
    const viewed = (store.viewedAfterChat || {})[c.id] || 0
    return Math.max(0, msgs.length - viewed)
  }
  const filteredChatClasses = (list: ClassItem[]) => {
    if (listFilter === 'unread') return list.filter((c) => unreadCount(c) > 0)
    if (listFilter === 'favourites') return list.filter((c) => (store.favourites || []).includes(c.id))
    return list
  }
  const lastAfterMessage = (c: ClassItem) => {
    const msgs = store.afterChat[c.id] || []
    return msgs.length > 0 ? msgs[msgs.length - 1] : null
  }

  const syncBanner = () => {
    if (syncStatus === 'checking') return <div className="syncnote">Checking shared database…</div>
    if (syncStatus === 'connected') return <div className="syncnote ok">✓ {dbModeLabel()} — messages and classes sync across devices.</div>
    if (syncStatus === 'unreachable') return <div className="syncnote">⚠ Shared database is configured but could not be reached — saving on this device only for now.</div>
    return (
      <div className="syncnote">
        <strong>Temporary local mode:</strong> Supabase is not connected yet, so data saves only in this browser and does not sync to another device.
        To turn sync on, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (see README.md).
      </div>
    )
  }

  if (screen === 'front') {
    return (
      <div className="frontpage">
        <img src={FRONT_PAGE_IMAGE} alt="Banat Connect — Bismillah" />
        <button className="btn" onClick={() => setScreen(user ? 'home' : 'login')}>Continue</button>
      </div>
    )
  }

  return (
    <div>
      <header className="top" style={{ position: 'relative' }}>
        <CornerFlower />
        <div className="wrap" style={{ padding: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <div className="avatar" style={{ background: '#fff', color: '#4e342e' }}>BC</div>
              <div>
                <h1 style={{ margin: 0 }}>Banat Connect</h1>
                <p>{user ? `Hello, ${user.name} (${user.role}) · ${store.institute.name}` : `${store.institute.name} — private, female-only learning portal.`}</p>
              </div>
            </div>
            <div className="row">
              <button className="btn small" style={{ background: '#fff', color: '#4e342e' }} onClick={() => setScreen('settings')}>⚙ Settings</button>
              {user && <button className="btn small danger" onClick={logout}>Logout</button>}
            </div>
          </div>
        </div>
      </header>
      <div className="wrap" style={{ position: 'relative' }}>
        <CornerFlower />

        {screen === 'login' && (
          <div className="card" style={{ position: 'relative' }}>
            <CornerFlower />
            <h2>Sign in with email</h2>
            <p>Female-only access. Only first names are shown to other participants. No phone number is needed — ever.</p>
            <p><strong>Free to use for female students.</strong> No payment is needed.</p>
            <div className="privacy">
              <strong>Private, always:</strong> no phone numbers · first names only · camera off, mic muted when you join.
            </div>
            <label>Full name</label>
            <input type="text" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="e.g. Ayesha" />
            <label>Email address</label>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="e.g. ayesha@example.com" />
            <label>I am a:</label>
            <div className="row">
              <button className={`btn small ${loginRole === 'Student' ? '' : 'secondary'}`} onClick={() => setLoginRole('Student')}>Student</button>
              <button className={`btn small ${loginRole === 'Teacher' ? '' : 'secondary'}`} onClick={() => setLoginRole('Teacher')}>Teacher</button>
            </div>
            {loginError && <p className="error">{loginError}</p>}
            <button className="btn" onClick={() => enterAs(loginName, loginEmail, loginRole)}>Sign in</button>
            <div className="demo" style={{ marginTop: 14 }}>
              <strong>Demo — tap one to enter directly (code DEMO-2026):</strong>
              <div className="settings-list" style={{ marginTop: 10 }}>
                <button className="settings-row link-row" onClick={() => enterDemo('Teacher', 'Demo Teacher', 'demo.teacher@banatconnect.demo')}>
                  <span><strong>▶ Demo Teacher</strong><br /><span style={{ color: '#8d6e63', fontSize: 14 }}>Teacher · demo.teacher@banatconnect.demo</span></span><span>›</span>
                </button>
                <button className="settings-row link-row" onClick={() => enterDemo('Student', 'Demo Student', 'demo.student@banatconnect.demo')}>
                  <span><strong>▶ Demo Student</strong><br /><span style={{ color: '#8d6e63', fontSize: 14 }}>Student · demo.student@banatconnect.demo</span></span><span>›</span>
                </button>
              </div>
              <p>Demo logins open the clearly-labelled demo classes — demo only, not real classes, teachers or students.</p>
            </div>
            {syncBanner()}
          </div>
        )}

        {screen === 'home' && user && (
          <div style={{ position: 'relative' }}>
            <CornerFlower />
            {syncBanner()}
            <div className="wa-tabs">
              <button className={mainTab === 'chats' ? 'active' : ''} onClick={() => setMainTab('chats')}>Chats</button>
              <button className={mainTab === 'calls' ? 'active' : ''} onClick={() => setMainTab('calls')}>Calls</button>
            </div>
            {mainTab === 'chats' && (
              <div>
                <div className="filterpills">
                  <button className={listFilter === 'all' ? 'active' : ''} onClick={() => setListFilter('all')}>All ({myClasses.length})</button>
                  <button className={listFilter === 'unread' ? 'active' : ''} onClick={() => setListFilter('unread')}>Unread ({myClasses.reduce((n, c) => n + unreadCount(c), 0)})</button>
                  <button className={listFilter === 'favourites' ? 'active' : ''} onClick={() => setListFilter('favourites')}>⭐ Favourites ({(store.favourites || []).length})</button>
                  <button className={listFilter === 'live' ? 'active' : ''} onClick={() => setListFilter('live')}>🔴 Live ({myClasses.length})</button>
                </div>
                {filteredChatClasses(myClasses).length === 0 ? (
                  <p style={{ color: '#8d6e63' }}>
                    {listFilter === 'unread' ? 'No unread chats yet.' : listFilter === 'favourites' ? 'No favourites yet — tap ☆ on a class row to add it to Favourites.' : 'No classes yet. Join one with a code under More below, or create one (teachers).'}
                  </p>
                ) : (
                  <div className="chatlist">
                    {filteredChatClasses(myClasses).map((c) => {
                      const last = lastAfterMessage(c)
                      const unread = unreadCount(c)
                      return (
                        <div key={c.id} className="classrow" onClick={() => openClass(c.id)} style={{ cursor: 'pointer' }}>
                          <div className="avatar">{c.name.charAt(0).toUpperCase()}</div>
                          <div className="chat-meta">
                            <strong>{c.name}</strong>{c.isDemo && <span className="pill warn">DEMO</span>}{unread > 0 && <span className="pill" style={{ background: '#6d4c41', color: '#fff' }}>{unread} unread</span>}<br />
                            <span className="sub">{c.subject} · {c.schedule}</span><br />
                            <span style={{ color: '#8d6e63', fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last ? `${last.sender}: ${last.text}` : 'No messages yet.'}</span>
                          </div>
                          <span style={{ color: '#8d6e63', fontSize: 13, whiteSpace: 'nowrap' }}>{last ? last.time : ''}</span>
                          <button className="starbtn" aria-label="Favourite this class" onClick={(e) => { e.stopPropagation(); toggleFavourite(c.id) }}>{(store.favourites || []).includes(c.id) ? '★' : '☆'}</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {mainTab === 'calls' && (
              <div>
                <p style={{ color: '#8d6e63', fontSize: 14 }}>Join a class live room. This is <strong>not a phone call</strong> — tapping Join opens that class video room inside Banat Connect. No phone numbers are used or shown.</p>
                <div className="chatlist">
                  {myClasses.length === 0 ? <p style={{ color: '#8d6e63', padding: 12 }}>No classes yet. Join one with a code under More below, or create one (teachers).</p> :
                    myClasses.map((c) => (
                      <div key={c.id} className="classrow">
                        <div className="avatar">{c.name.charAt(0).toUpperCase()}</div>
                        <div className="chat-meta">
                          <strong>{c.name}</strong>{c.isDemo && <span className="pill warn">DEMO</span>}<br />
                          <span className="sub">{c.subject} · {c.schedule}</span><br />
                          <span style={{ color: '#8d6e63', fontSize: 13 }}>Code: {c.code}</span>
                        </div>
                        <button className="btn small" onClick={() => openClass(c.id)}>📹 Join</button>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div className="settings-list" style={{ marginTop: 14 }}>
              <button className="settings-row link-row" onClick={() => setMoreOpen(!moreOpen)}>
                <span><strong>⋮ More</strong><br /><span style={{ color: '#8d6e63', fontSize: 14 }}>Join a class, create a class, load demo data</span></span><span>›</span>
              </button>
            </div>
            {moreOpen && (
              <div className="card">
                <button className="settings-row link-row" onClick={loadDemoData}>
                  <span><strong>Load demo data</strong><br /><span style={{ color: '#8d6e63', fontSize: 14 }}>Replace the classes and chats with the demo classes and dummy chats</span></span><span>›</span>
                </button>
                <h3>Join a class</h3>
                <div className="row">
                  <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Access code, e.g. DEMO-2026" style={{ flex: 1, minWidth: 180 }} />
                  <button className="btn small" onClick={joinByCode}>Join</button>
                </div>
                {canManage && (
                  <div>
                    <h3>Create a new class</h3>
                    <label>Class name</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Morning Class A" />
                    <label>Subject</label>
                    <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject you will teach" />
                    <label>Schedule</label>
                    <input type="text" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="e.g. Monday and Thursday, 4 pm" />
                    <label>Access code (leave blank for an automatic code)</label>
                    <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. CLASS-1234" />
                    <button className="btn" onClick={createClass}>Create class</button>
                    <p style={{ fontSize: 13, color: '#8d6e63' }}>Share the access code only with your female students. Do not share it publicly. No phone numbers are needed.</p>
                  </div>
                )}
              </div>
            )}
            <div className="bottomnav">
              <button className="active">Chats</button>
              <button onClick={() => setMainTab('calls')}>Calls</button>
              <button onClick={() => setScreen('settings')}>Settings</button>
            </div>
            <footer>Banat Connect — free for female students. No phone numbers, ever.</footer>
          </div>
        )}

        {screen === 'class' && user && currentClass && (
          <ClassView cls={currentClass} user={user} store={store} setStore={setStore} onBack={() => setScreen('home')} settings={settings} />
        )}

        {screen === 'settings' && user && (
          <div className="card" style={{ position: 'relative' }}>
            <CornerFlower />
            <h2>Settings</h2>
            <div className="settings-list">
              <div className="settings-row profile-row">
                <div className="avatar large">{user.name.charAt(0).toUpperCase()}</div>
                <div>
                  <strong>{user.name}</strong><br />
                  <span style={{ color: '#8d6e63', fontSize: 14 }}>{user.email} · {user.role}</span><br />
                  <span style={{ color: '#8d6e63', fontSize: 14 }}>{store.institute.name} — female-only, no phone numbers.</span>
                </div>
              </div>
            </div>
            <label>Institute name</label>
            <input type="text" value={instituteName} onChange={(e) => setInstituteName(e.target.value)} />
            <button className="btn small" onClick={() => { setStore((s) => ({ ...s, institute: { ...s.institute, name: instituteName.trim() || s.institute.name } })); alert('Institute name saved.') }}>Save institute name</button>
            <h3>Privacy &amp; live class</h3>
            <div className="settings-list">
              <label className="switch-row">Camera off by default
                <span><input type="checkbox" checked={settings.cameraOffByDefault} onChange={(e) => changeSettings({ ...settings, cameraOffByDefault: e.target.checked })} /><span className="switch" /></span>
              </label>
              <label className="switch-row">Mic muted when joining
                <span><input type="checkbox" checked={settings.micMutedOnJoin} onChange={(e) => changeSettings({ ...settings, micMutedOnJoin: e.target.checked })} /><span className="switch" /></span>
              </label>
              <label className="switch-row">Show first names (off = role only)
                <span><input type="checkbox" checked={settings.showFirstNames} onChange={(e) => changeSettings({ ...settings, showFirstNames: e.target.checked })} /><span className="switch" /></span>
              </label>
              <label className="switch-row">Read receipts (seen ✓✓)
                <span><input type="checkbox" checked={settings.readReceipts} onChange={(e) => changeSettings({ ...settings, readReceipts: e.target.checked })} /><span className="switch" /></span>
              </label>
              <label className="switch-row">Announcements on home screen
                <span><input type="checkbox" checked={settings.inAppNotifications} onChange={(e) => changeSettings({ ...settings, inAppNotifications: e.target.checked })} /><span className="switch" /></span>
              </label>
            </div>
            <p className="settings-note">Settings save on this device.</p>
            {syncBanner()}
            <div className="settings-list">
              <button className="settings-row link-row" onClick={() => setScreen('home')}>
                <span><strong>← Back to home</strong></span><span>›</span>
              </button>
              <button className="settings-row link-row danger-text" onClick={logout}>
                <span><strong>Logout</strong><br /><span style={{ color: '#8d6e63', fontSize: 14 }}>Sign out and return to the email login</span></span><span>›</span>
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#8d6e63' }}>Phase 2 (not built yet): exams / results, fee payment, parent dashboard, notifications. No buttons for these are shown as working.</p>
          </div>
        )}
      </div>
    </div>
  )
}
