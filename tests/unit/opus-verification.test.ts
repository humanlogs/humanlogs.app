import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { isOggOpusFile } from "@/lib/audio/audio-processing";

/**
 * The upload flags a file as "already converted to opus by the browser" with a
 * form field, and the server skips its own ffmpeg pass when it sees it. When
 * the browser conversion in fact failed and the raw file was uploaded, that
 * flag must not be believed — otherwise the unconverted source is what gets
 * stored and transcribed.
 */
describe("isOggOpusFile", () => {
  const write = async (name: string, bytes: Buffer) => {
    const dir = await mkdtemp(join(tmpdir(), "opus-test-"));
    const path = join(dir, name);
    await writeFile(path, bytes);
    return path;
  };

  /** Minimal stand-in for the first Ogg page of an opus stream. */
  const oggOpusPage = () => {
    const page = Buffer.alloc(64);
    page.write("OggS", 0, "latin1");
    page.write("OpusHead", 28, "latin1");
    return page;
  };

  it("accepts a file whose first page is an opus identification header", async () => {
    expect(await isOggOpusFile(await write("a.opus", oggOpusPage()))).toBe(true);
  });

  it("rejects an mp3, however it is named", async () => {
    // ID3 tag then an MPEG frame sync: what a raw upload actually looks like.
    const mp3 = Buffer.concat([
      Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00", "latin1"),
      Buffer.from([0xff, 0xfb, 0x90, 0x00]),
      Buffer.alloc(64),
    ]);
    expect(await isOggOpusFile(await write("a.opus", mp3))).toBe(false);
  });

  it("rejects Ogg Vorbis, which shares the container but not the codec", async () => {
    const page = Buffer.alloc(64);
    page.write("OggS", 0, "latin1");
    page.write("vorbis", 29, "latin1");
    expect(await isOggOpusFile(await write("a.ogg", page))).toBe(false);
  });

  it("rejects an empty file", async () => {
    expect(await isOggOpusFile(await write("a.opus", Buffer.alloc(0)))).toBe(
      false,
    );
  });

  it("rejects a missing file instead of throwing", async () => {
    expect(await isOggOpusFile(join(tmpdir(), "does-not-exist-1234.opus"))).toBe(
      false,
    );
  });
});
