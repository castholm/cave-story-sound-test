import { Lazy } from "./utils/Lazy"
import { readPixToneParameters } from "./pixTone/readPixToneParameters"
import { renderPixToneSample } from "./pixTone/renderPixToneSample"
import { OrganyaMusicPlayer } from "./organya/OrganyaMusicPlayer"
import type { OrganyaSong } from "./organya/OrganyaSong"
import { readOrganyaSong } from "./organya/readOrganyaSong"

const audioContext = new Lazy(() => new AudioContext({ latencyHint: "interactive" }))

// Init SFX controls.

const sfxControlsTemplate = document.getElementById("sfx-controls-template") as HTMLTemplateElement
const sfxControlsClone = sfxControlsTemplate.content.cloneNode(true) as DocumentFragment
const sfxControls = sfxControlsClone.firstElementChild as HTMLFormElement
const sfxOptions = sfxControls.querySelector<HTMLSelectElement>(".options")!

const sfxSamples = new Map<string, AudioBuffer>()
await (async () => {
  const res = await fetch("data/PIXTONEPARAMETERS")
  if (!res.ok) {
    throw new Error("Failed to fetch PixTone parameters.")
  }

  const parameters = readPixToneParameters(await res.arrayBuffer())

  function register(key: string, start: number, channels: number): void {
    sfxSamples.set(key, renderPixToneSample(parameters[start]!, ...parameters.slice(start + 1, start + channels)))
  }

  // The information used below can be found between offsets 0x115F8 and 0x11DE1 in the Cave Story executable.
  register("001",  33, 1)
  register("002",  38, 1)
  register("003", 136, 1)
  register("004",  35, 1)
  register("005",  30, 1)
  register("006", 137, 1)
  register("007", 138, 1)
  register("011",  32, 1)
  register("012",  44, 2)
  register("014",  39, 1)
  register("015",   6, 1)
  register("016",  23, 2)
  register("017",  25, 3)
  register("018",  34, 1)
  register("020",  36, 2)
  register("021",  43, 1)
  register("022",  31, 1)
  register("023",   8, 1)
  register("024",   7, 1)
  register("025",  46, 2)
  register("026",  41, 2)
  register("027",  48, 1)
  register("028",  54, 2)
  register("029",  56, 1)
  register("030",  86, 1)
  register("031",  59, 1)
  register("032",   0, 2)
  register("033",   2, 2)
  register("034",   4, 2)
  register("035",  49, 3)
  register("037", 107, 2)
  register("038",  57, 2)
  register("039",  52, 3)
  register("040", 105, 2)
  register("041", 105, 2)
  register("042",  60, 1)
  register("043",  61, 1)
  register("044",  62, 3)
  register("045",  65, 1)
  register("046",  66, 1)
  register("047",  68, 1)
  register("048",  69, 1)
  register("049",  70, 2)
  register("050",   9, 2)
  register("051",  11, 2)
  register("052",  13, 2)
  register("053",  28, 2)
  register("054",  76, 2)
  register("055", 122, 2)
  register("056", 103, 2)
  register("057", 109, 2)
  register("058", 120, 2)
  register("059", 126, 1)
  register("060", 127, 1)
  register("061", 128, 1)
  register("062", 129, 2)
  register("063", 131, 2)
  register("064", 133, 2)
  register("065", 135, 1)
  register("070",  15, 2)
  register("071",  17, 2)
  register("072",  19, 2)
  register("100",  72, 1)
  register("101",  73, 3)
  register("102",  78, 2)
  register("103",  80, 2)
  register("104", 116, 1)
  register("104",  81, 1)
  register("105",  82, 1) // Woof!
  register("106",  83, 2)
  register("107",  85, 1)
  register("108",  87, 1)
  register("109",  88, 1)
  register("110",  89, 1)
  register("111",  90, 1)
  register("112",  91, 1)
  register("113",  92, 1)
  register("114",  93, 2)
  register("115", 113, 3)
  register("116", 117, 3)
  register("117", 124, 2)
  register("150",  95, 2)
  register("151",  97, 2)
  register("152",  99, 1)
  register("153", 100, 1)
  register("154", 101, 2)
  register("155", 111, 2)
  // The following three samples are present as parameter data but are never actually rendered and used.
  register("X21",  21, 2) // Sounds similar to 053.
  register("X40",  40, 1)
  register("X67",  67, 1)
})()

for (const keys of sfxSamples.keys()) {
  const option = document.createElement("option")
  option.textContent = keys
  option.value = keys
  sfxOptions.add(option)
}
sfxOptions.selectedIndex = 0

function playSelectedSfx(): void {
  const soundNode = audioContext.value.createBufferSource()
  soundNode.buffer = sfxSamples.get(sfxOptions.value)!
  soundNode.connect(audioContext.value.destination)
  soundNode.start()
}

sfxOptions.addEventListener("change", playSelectedSfx)
sfxControls.addEventListener("submit", e => {
  e.preventDefault()
  playSelectedSfx()
})

// Init music controls.

const musicControlsTemplate = document.getElementById("music-controls-template") as HTMLTemplateElement
const musicControlsClone = musicControlsTemplate.content.cloneNode(true) as DocumentFragment
const musicControls = musicControlsClone.firstElementChild as HTMLFormElement
const musicStatus = musicControls.querySelector<HTMLSpanElement>(".status")!
const musicOptions = musicControls.querySelector<HTMLSelectElement>(".options")!
const musicStop = musicControls.querySelector<HTMLInputElement>(".stop")!

const songKeys = [
  'ACCESS', 'ANZEN', 'BALCONY', 'BALLOS', 'BDOWN', 'CEMETERY', 'CURLY', 'DR', 'ENDING', 'ESCAPE', 'FANFALE1',
  'FANFALE2', 'FANFALE3', 'FIREEYE', 'GAMEOVER', 'GINSUKE', 'GRAND', 'GRAVITY', 'HELL', 'IRONH', 'JENKA', 'JENKA2',
  'KODOU', 'LASTBT3', 'LASTBTL', 'LASTCAVE', 'MARINE', 'MAZE', 'MDOWN2', 'MURA', 'OSIDE', 'PLANT', 'QUIET', 'REQUIEM',
  'TOROKO', 'VIVI', 'WANPAK2', 'WANPAKU', 'WEED', 'WHITE', 'XXXX', 'ZONBIE',
]
for (const key of songKeys) {
  const option = document.createElement("option")
  option.textContent = key
  option.value = key
  musicOptions.add(option)
}
musicOptions.selectedIndex = 0

const melodyWaveformData = await (async () => {
  const res = await fetch("data/WAVE/WAVE100")
  if (!res.ok) {
    throw new Error("Failed to fetch melody waveform data.")
  }

  return await res.arrayBuffer()
})()

const percussionSamples = [
  sfxSamples.get("150"),
  sfxSamples.get("151"),
  sfxSamples.get("152"),
  sfxSamples.get("153"),
  sfxSamples.get("154"),
  sfxSamples.get("155"),
]

const musicPlayer = new Lazy<OrganyaMusicPlayer>(() => {
  const musicPlayer = new OrganyaMusicPlayer(audioContext.value, melodyWaveformData, percussionSamples)

  const gainNode = audioContext.value.createGain()
  gainNode.gain.value = .75
  musicPlayer.connect(gainNode)
  gainNode.connect(audioContext.value.destination)

  function updateStatusText() {
    musicStatus.textContent = musicPlayer.position.toFixed(3)
    requestAnimationFrame(updateStatusText)
  }
  updateStatusText()

  return musicPlayer
})

const songCache = new Map<string, OrganyaSong>()

async function setSelectedSong(): Promise<void> {
  const selectedSongKey = musicOptions.value
  let song = songCache.get(selectedSongKey)
  if (song == undefined) {
    const res = await fetch(`data/ORG/${selectedSongKey}`)
    if (!res.ok) {
      throw new Error("Failed to fetch Organya song.")
    }
    song = readOrganyaSong(await res.arrayBuffer(), (level, message) => {
      if (level === "warning") {
        console.warn(message)
      } else {
        console.error(message)
      }
    })
    // In Cave Story, percussion instrument types are fixed (unlike in other Organya implementations), so we need to
    // modify the percussion tracks to get the expected sounds.
    for (let i = 8; i < song.tracks.length; i++) {
      ;(song.tracks[i] as { instrument: number }).instrument = i - 8
    }
    songCache.set(selectedSongKey, song)
  }
  if (musicPlayer.value.song !== song) {
    musicPlayer.value.song = song
  }
}

musicOptions.addEventListener("change", setSelectedSong)
musicControls.addEventListener("submit", async e => {
  e.preventDefault()
  await setSelectedSong()
  if (e.submitter === musicStop) {
    musicPlayer.value.pause()
    musicPlayer.value.position = 0
  } else {
    musicPlayer.value.state === "paused" ? musicPlayer.value.play() : musicPlayer.value.pause()
  }
})

// Insert SFX and music controls.

const soundTestContainer = document.getElementById("sound-test") as HTMLElement
for (const childNode of soundTestContainer.childNodes) {
  childNode.remove()
}
soundTestContainer.append(sfxControls)
soundTestContainer.append(musicControls)
