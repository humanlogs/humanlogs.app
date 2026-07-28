---
title: Navigation
description: Correcting a transcript with the audio: playback, speakers, search and version history.
order: 3
status: live
updated: 2026-07-28
related: transcribe/keyboard-shortcuts, organize/comments, transcribe/export
---

An automatic transcript is a draft. The editor exists to make correcting that draft fast, a different problem from writing text, which is why it does not look like a word processor.

## The two halves

**The audio player**: at the top: waveform, play controls, speed. The waveform is clickable.

**The transcript**: below: the text, speakers in a column on the left, comments in a rail on the right.

They are one thing, not two. The segment being played is highlighted as it goes, and **clicking any word moves the audio to that exact moment**. That single link is what makes correction fast: you never hunt for the passage you just heard.

## Playing while you type

The space bar inserts spaces when you are typing, so playback moves to **Alt/Ctrl + Space** while editing. Outside the text, **Space** or **Tab** plays and pauses.

Speed is held, not toggled: hold **Alt** for 0.5×, **Ctrl** for 2×, **Alt + Ctrl** for 4×. In practice you hold Ctrl through the parts you have already checked and Alt through the mumbled ones, without ever opening a menu.

Arrow keys move word by word, **Shift + arrows** sentence by sentence, **Enter** goes into edit mode and **Escape** comes back out. The full list is in [Keyboard shortcuts](/docs/transcribe/keyboard-shortcuts).

## Correcting text

Click into the text and type. Formatting is standard: **⌘B** bold, **⌘I** italic, **⌘U** underline, **⌘⇧X** strikethrough, useful for marking uncertain passages by convention.

Saving is automatic and continuous. The status next to the document name shows *Saving…* then *Saved*, and tells you when you are offline. There is no save button because there is nothing to forget.

## Speakers

Each segment carries a speaker, shown in the left column.

- **Rename**: click the name and change it. It applies everywhere in the document, so "Speaker 1" becomes "Interviewer" once.
- **Reassign**: change the speaker on a misattributed segment, or assign a speaker detection missed entirely.
- **Speaker options**: document-wide operations, for when detection split one person in two or merged two into one.

Speaker names travel with every export, and the text export can extract a single speaker's contributions, that is how you produce an interviewee-only transcript.

## Search and replace

The search bar finds text across the document; **Enter** goes to the next match, **Shift + Enter** to the previous. Three options matter in practice:

- **Match case**: distinguishes `Interview` from `interview`.
- **Whole word**: `car` stops matching `carbon`.
- **Ignore accents**: `etudiant` finds `étudiant`, for the very common case of a transcript being more careful with accents than your typing.

Replace substitutes matches one by one or all at once; the button shows how many will be affected. Replacing is a normal edit: saved, visible to collaborators in real time, and undoable.

## Version history

Every document keeps a history of its versions, with how many words were added, removed and changed in each. Open **Version history** from the document actions to browse it, and restore an earlier version if you need to, the current state is itself kept as a version, so restoring is reversible.

History is per document, not per person. If several people are working at once, restoring affects everyone: say so in a comment first.

## Everything else

Comments live in the right rail, see [Comments](/docs/organize/comments). Exports, sharing, renaming, assigning to a study and deleting are all in the document actions menu, next to the document name.
