# Cave Story Sound Test

[Try the demo online!](https://castholm.github.io/cave-story-sound-test-demo)

This is a web reimplementation the audio engine used by *Cave Story*, written in TypeScript and with no external
production dependencies.

## Background

*Cave Story* (originally released as <ruby>洞窟物語 <rp>(</rp><rt>Dōkutsu Monogatari</rt><rp>)</ruby>) is a 2004
freeware PC game developed and published by Daisuke "Pixel" Amaya of Studio Pixel and has been cited by many as being
one of the core titles that ended up kickstarting what is now the modern indie game scene. You can download and play
the game through the [*Cave Story Tribute Site*](https://www.cavestory.org/download/cave-story.php).

Notably, instead of playing back plain audio files or using MIDI, *Cave Story* opted to use a custom audio engine for
its sound effects and music, lending the game a very characteristic and distinctive retro sound. Said audio engine
consists of [*PixTone*](https://www.cavestory.org/pixels-works/pixtone.php), which synthesizes sound effects, and
[*Organya*](https://www.cavestory.org/pixels-works/org-maker.php), which plays back sequenced music. In 2018, [the
source code for an updated version of *Organya*](https://github.com/shbow/organya) was published to GitHub.

In early 2021, I began development on a reimplementation of the entire *Cave Story* game engine for the web, inspired
by projects such as [*doukutsu-rs*](https://github.com/doukutsu-rs/doukutsu-rs) and the (sadly taken down) *CSE2*
engine. While I did manage to get some very rudimentary gameplay going, I eventually lost interest in the herculean
task that would be reimplementing the entire game and decided to scope down to just focus on the audio engine, which
intrigued me and presented a good opportunity to learn my way around the modern Web Audio API.

## Developing and building the project

After cloning this repo, run `npm install` to install all dependencies necessary to develop and build the web app.

**This repo does not include the proprietary *Cave Story* sound effect and music binary data that is required for the
web app to function correctly.** Instead, you must manually extract this data from the *Cave Story* executable to the
appropriate location in `src` by following these steps:

1. Download the [Japanese](https://studiopixel.jp/binaries/dou_1006.zip) or [English
   pre-patched](https://www.cavestory.org/downloads/cavestoryen.zip) version of *Cave Story* and extract the files.
2. Open the extracted `Doukutsu.exe` using 7zip or an equivalent tool and extract the contents of `.rsrc/1041/WAVE`
   and `.rsrc/1041/ORG` to `src/data/WAVE` and `src/data/ORG` respectively.
3. Copy `ExtractPixToneParameters.ps1` from the `scripts` directory to the directory in which `Doukutsu.exe` resides
   and run it using PowerShell. A file named `PIXTONEPARAMETERS` will be created. Move or copy it to `src/data`.

To test the web app while developing, run `npm run dev` to start a development server on port 3000 on localhost which
will watch the `src` directory for changes and serve the most recent version of all files.

To build a minified and optimized build, run `npm run build`, which will output everything to `dist`, ready to be
published. To preview this build, run `npm run preview` to open a server on port 5000 on localhost.
