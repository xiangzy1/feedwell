import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'

interface Props {
  url: string
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3]

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PodcastPlayer({ url }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(() => {
    const saved = localStorage.getItem('podcast-playback-speed')
    return saved ? parseFloat(saved) : 1
  })
  const [loaded, setLoaded] = useState(false)

  // Create audio element on mount / url change
  useEffect(() => {
    const audio = new Audio(url)
    audio.preload = 'metadata'
    audioRef.current = audio

    // Set initial speed
    audio.defaultPlaybackRate = speed
    audio.playbackRate = speed

    const onLoadedMetadata = () => {
      setDuration(audio.duration)
      setLoaded(true)
      audio.playbackRate = speed
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setCurrentTime(0)

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.src = ''
      audioRef.current = null
      setPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setLoaded(false)
    }
  }, [url])

  // Sync playback speed rate when the speed setting changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = speed
      audioRef.current.playbackRate = speed
    }
  }, [speed])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [])

  // Seek on progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrentTime(audio.currentTime)
  }, [duration])

  // Spacebar shortcut for play/pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle spacebar, ignore if user is typing in an input/textarea
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return
      e.preventDefault()
      togglePlay()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="podcast-player">
      <button
        className="podcast-player-play"
        onClick={togglePlay}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
      </button>

      <span className="podcast-player-time">{formatTime(currentTime)}</span>

      <div
        ref={progressRef}
        className="podcast-player-progress"
        onClick={handleProgressClick}
        role="progressbar"
        aria-valuenow={currentTime}
        aria-valuemin={0}
        aria-valuemax={duration}
      >
        <div className="podcast-player-progress-fill" style={{ width: `${progress}%` }} />
        <div className="podcast-player-progress-thumb" style={{ left: `${progress}%` }} />
      </div>

      <span className="podcast-player-time">{loaded ? formatTime(duration) : '--:--'}</span>

      <div className="podcast-player-speed-wrapper">
        <select
          className="podcast-player-speed-select"
          value={speed}
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            setSpeed(val)
            if (audioRef.current) {
              audioRef.current.playbackRate = val
            }
            localStorage.setItem('podcast-playback-speed', val.toString())
          }}
          title="Playback speed"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
        <span className="podcast-player-speed-arrow">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </div>
    </div>
  )
}

