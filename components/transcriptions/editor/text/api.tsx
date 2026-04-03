/**
 * Tiptap-based EditorAPI Implementation
 *
 * This provides the same EditorAPI interface but backed by Tiptap editor
 * instead of a plain contentEditable div. This allows us to leverage
 * Tiptap's transaction system while maintaining compatibility with existing code.
 */

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { Editor } from "@tiptap/react";
import EventEmitter from "events";
import _ from "lodash";
import { segmentsToHtml } from "./utils/html";

/**
 * Creates an EditorAPI instance backed by a Tiptap editorRef.current.
 */
export class EditorAPI extends EventEmitter {
  private activeSegmentIndex = -1;
  private segmentChangesCallbacks = [] as Array<() => void>;
  private onFocusHandler: (() => void) | null = null;
  private onBlurHandler: (() => void) | null = null;

  private editorRef: { current: Editor | null } = { current: null };
  private segmentsRef: { current: TranscriptionSegment[] } = { current: [] };
  private speakersRef: { current: Array<{ id: string; name?: string }> } = {
    current: [],
  };

  constructor() {
    super();
  }

  init(
    editorRef: { current: Editor | null },
    segmentsRef: { current: TranscriptionSegment[] },
    speakers: Array<{ id: string; name?: string }>,
  ) {
    this.editorRef = editorRef;
    this.segmentsRef = segmentsRef;
    this.speakersRef.current = speakers;

    (window as any).editorAPI = this; // Expose for debugging

    // Set up focus/blur event listeners on the TipTap editor
    this.setupEditorEventListeners();

    this.emit("segmentsChange");
    this.emit("speakersChange");
    this.emit("change");
  }

  getEditor() {
    return this.editorRef.current;
  }

  private setupEditorEventListeners() {
    if (!this.editorRef.current) return;

    // Clean up previous listeners if they exist
    this.cleanupEditorEventListeners();

    // Create handler functions
    this.onFocusHandler = () => {
      this.emit("focus");
    };

    this.onBlurHandler = () => {
      this.emit("blur");
    };

    // Subscribe to TipTap's focus and blur events
    this.editorRef.current.on("focus", this.onFocusHandler);
    this.editorRef.current.on("blur", this.onBlurHandler);
  }

  private cleanupEditorEventListeners() {
    if (!this.editorRef.current) return;

    if (this.onFocusHandler) {
      this.editorRef.current.off("focus", this.onFocusHandler);
      this.onFocusHandler = null;
    }

    if (this.onBlurHandler) {
      this.editorRef.current.off("blur", this.onBlurHandler);
      this.onBlurHandler = null;
    }
  }

  destroy() {
    // Clean up event listeners
    this.cleanupEditorEventListeners();
    this.removeAllListeners();
  }

  ready() {
    return this.editorRef.current !== null;
  }

  isFocused() {
    return this.editorRef.current?.isFocused ?? false;
  }

  blur() {
    this.editorRef.current?.commands.blur();
  }

  focus(segmentIndex?: number, selectContent: boolean = false) {
    if (!this.editorRef.current) return;

    segmentIndex = segmentIndex ?? this.activeSegmentIndex ?? 0;

    if (segmentIndex !== undefined && segmentIndex >= 0) {
      console.log(
        `[TiptapEditorAPI] Focusing segment ${segmentIndex} (selectContent=${selectContent})`,
      );

      // Calculate character offset for this segment
      let charOffset = 0;
      for (
        let i = 0;
        i < segmentIndex && i < this.segmentsRef.current.length;
        i++
      ) {
        charOffset += this.segmentsRef.current[i].text.length;
      }

      const segmentLength =
        this.segmentsRef.current[segmentIndex]?.text.length ?? 0;

      // Use Tiptap's setTextSelection command
      if (selectContent) {
        this.editorRef.current.commands.setTextSelection({
          from: charOffset + 1, // +1 for Tiptap's 1-based indexing
          to: charOffset + segmentLength + 1,
        });
      } else {
        this.editorRef.current.commands.setTextSelection(charOffset + 1);
      }
    }

    this.editorRef.current.commands.focus();
  }

  getSegments() {
    return this.segmentsRef.current || [];
  }

  getSpeakers() {
    return this.speakersRef.current || [];
  }

  getSegmentNode(segmentIndex?: number) {
    // In Tiptap, we don't have individual segment nodes in the same way
    // Return the editor DOM element
    return this.editorRef.current?.view.dom as HTMLElement | null;
  }

  getSegmentBounds(segmentIndex: number) {
    if (
      !this.editorRef.current ||
      segmentIndex < 0 ||
      segmentIndex >= this.segmentsRef.current.length
    ) {
      return null;
    }

    // Calculate character offset for this segment
    let charOffset = 0;
    for (let i = 0; i < segmentIndex; i++) {
      charOffset += this.segmentsRef.current[i].text.length;
    }

    const segmentLength = this.segmentsRef.current[segmentIndex].text.length;

    // Use Tiptap's coordsAtPos to get the bounds
    try {
      const from = this.editorRef.current.view.coordsAtPos(charOffset + 1);
      const to = this.editorRef.current.view.coordsAtPos(
        charOffset + segmentLength + 1,
      );

      return new DOMRect(
        from.left,
        from.top,
        to.right - from.left,
        to.bottom - from.top,
      );
    } catch (e) {
      console.error("[TiptapEditorAPI] Error getting segment bounds:", e);
      return null;
    }
  }

  setActiveSegment(segmentIndex: number) {
    this.activeSegmentIndex = segmentIndex;
  }

  clearActiveSegments() {
    this.activeSegmentIndex = -1;
  }

  setSpeakers(speakers: Array<{ id: string; name?: string }>) {
    this.speakersRef.current = speakers;
    this.emit("speakersChange");
    this.emit("change");
  }

  setSegments(segments: TranscriptionSegment[]) {
    if (
      segments.map((s) => s.text).join("") ===
        this.editorRef.current?.getText() &&
      segments.map((s) => s.modifiers?.join("")).join("") ===
        this.segmentsRef.current.map((s) => s.modifiers?.join("")).join("")
    ) {
      // No change in text content, skip update to avoid disrupting cursor position
      this.segmentsRef.current = segments;
      this.emit("segmentsChange");
      this.emit("change");
      return;
    }
    this.segmentsRef.current = segments;
    this.emit("segmentsChange");
    this.emit("change");

    if (this.editorRef.current) {
      this.editorRef.current.commands.setContent(segmentsToHtml(segments), {
        emitUpdate: false,
      });
    }
  }

  onSegmentsChange(callback: () => void) {
    this.segmentChangesCallbacks.push(callback);
  }

  offSegmentsChange(callback: () => void) {
    this.segmentChangesCallbacks = this.segmentChangesCallbacks.filter(
      (cb) => cb !== callback,
    );
  }

  getSelectionOffsets() {
    if (!this.editorRef.current) return null;

    const { from, to } = this.editorRef.current.state.selection;

    // Tiptap uses 1-based indexing, convert to 0-based
    return {
      start: from - 1,
      end: to - 1,
    };
  }

  restoreSelection(start: number, end: number) {
    if (!this.editorRef.current) return;

    // Convert 0-based to 1-based for Tiptap
    this.editorRef.current.commands.setTextSelection({
      from: start + 1,
      to: end + 1,
    });
  }

  getSpeakerPositions() {
    if (!this.editorRef.current) return [];

    const editorElement = this.editorRef.current.view.dom;
    const editorRect = editorElement.getBoundingClientRect();

    // Get all paragraph elements from the editor DOM
    const paragraphs = editorElement.querySelectorAll("p[data-speaker-id]");

    const positions: Array<{
      speakerId: string;
      index: number;
      top: number;
    }> = [];

    let previousSpeakerId: string | null = null;
    let speakerIndex = 0;

    paragraphs.forEach((paragraph) => {
      const speakerId = paragraph.getAttribute("data-speaker-id");

      if (!speakerId) return;

      // Only add position when speaker changes (new speaker turn)
      const paraRect = paragraph.getBoundingClientRect();

      // Calculate position relative to editor top + scroll offset
      const relativeTop =
        paraRect.top - editorRect.top + editorElement.scrollTop;

      // Only include positions that are in or near the viewport for performance
      const visible =
        relativeTop >= window.scrollY - window.innerHeight &&
        relativeTop <= window.scrollY + window.innerHeight * 2;

      if (visible) {
        positions.push({
          speakerId,
          index: speakerIndex,
          top: relativeTop,
        });
      }

      speakerIndex++;
      previousSpeakerId = speakerId;
    });

    return positions;
  }

  getEditorElement() {
    return (this.editorRef.current?.view.dom as HTMLElement) ?? null;
  }

  execCommand(command: string, value?: string) {
    if (!this.editorRef.current) return;

    // Map generic commands to Tiptap commands
    switch (command) {
      case "bold":
        this.editorRef.current.commands.toggleBold();
        break;
      case "italic":
        this.editorRef.current.commands.toggleItalic();
        break;
      case "underline":
        this.editorRef.current.commands.toggleUnderline();
        break;
      case "strikethrough":
        this.editorRef.current.commands.toggleStrike();
        break;
      case "insertText":
        this.editorRef.current.commands.insertContent(value || "");
        break;
      case "delete":
        this.editorRef.current.commands.deleteSelection();
        break;
      // Add more command mappings as needed
      default:
        console.warn(`[TiptapEditorAPI] Unknown command: ${command}`);
    }
  }

  getBoundingClientRect() {
    return (
      this.editorRef.current?.view.dom.getBoundingClientRect() ?? new DOMRect()
    );
  }

  getRangeRect(start: number, end: number) {
    if (!this.editorRef.current) return null;

    try {
      const view = this.editorRef.current.view;
      // TipTap uses 1-based positions
      const from = start + 1;
      const to = end + 1;

      // Get DOM nodes and offsets for the range
      const startPos = view.domAtPos(from);
      const endPos = view.domAtPos(to);

      if (startPos && endPos) {
        const range = document.createRange();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
        return range.getBoundingClientRect();
      }
    } catch (e) {
      console.error("[TiptapEditorAPI] Error getting range rect:", e);
    }

    return null;
  }

  /**
   * Changes the speaker for a specific paragraph in the editor.
   * @param paragraphIndex The 0-based index of the paragraph (speaker turn)
   * @param newSpeakerId The ID of the speaker to assign
   */
  changeParagraphSpeaker(paragraphIndex: number, newSpeakerId: string) {
    if (!this.editorRef.current) return;

    const editorElement = this.editorRef.current.view.dom;
    const paragraphs = editorElement.querySelectorAll("p[data-speaker-id]");

    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) {
      console.warn(
        `[EditorAPI] Invalid paragraph index: ${paragraphIndex} (total: ${paragraphs.length})`,
      );
      return;
    }

    const paragraph = paragraphs[paragraphIndex];

    // Find the position of this paragraph in the document
    const view = this.editorRef.current.view;
    let targetPos = -1;

    // Walk through the document to find the paragraph node
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph") {
        // Check if this is our target paragraph by comparing DOM elements
        const domNode = view.domAtPos(pos + 1).node;
        if (
          domNode === paragraph ||
          domNode.parentElement === paragraph ||
          (domNode as any).parentNode?.parentNode === paragraph
        ) {
          targetPos = pos;
          return false; // Stop traversal
        }
      }
      return true;
    });

    if (targetPos === -1) {
      console.warn("[EditorAPI] Could not find paragraph in document");
      return;
    }

    // Update the paragraph's speakerId attribute using Tiptap's command system
    this.editorRef.current
      .chain()
      .focus()
      .setNodeSelection(targetPos)
      .updateAttributes("paragraph", { speakerId: newSpeakerId })
      .run();

    this.emit("change");
    this.emit("segmentsChange");
  }

  /**
   * Creates a new speaker and adds it to the speaker list.
   * @param name Optional name for the speaker. If not provided, generates a default name.
   * @returns The ID of the newly created speaker
   */
  createSpeaker(name?: string): string {
    // Generate a unique speaker ID
    const newId = `speaker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Generate a default name if not provided
    const speakerName =
      name || `Speaker ${this.speakersRef.current.length + 1}`;

    // Add to speakers list
    const newSpeakers = [
      ...this.speakersRef.current,
      { id: newId, name: speakerName },
    ];

    this.setSpeakers(newSpeakers);

    return newId;
  }

  /**
   * Renames an existing speaker.
   * @param speakerId The ID of the speaker to rename
   * @param newName The new name for the speaker
   */
  renameSpeaker(speakerId: string, newName: string) {
    const updatedSpeakers = this.speakersRef.current.map((speaker) =>
      speaker.id === speakerId ? { ...speaker, name: newName } : speaker,
    );

    this.setSpeakers(updatedSpeakers);
  }
}
