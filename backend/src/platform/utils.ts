import axios from "axios";
import heicConvert from "heic-convert";
import sharp from "sharp";

async function checkHEIC(buffer: Buffer) {
  console.log("Checking HEIC");
  if (!buffer || buffer.length < 24) {
    return false;
  }
  // Console log first x items
  const headers = buffer.toString("ascii", 0, 24);
  return headers.includes("ftypheic");
}

export const ensureJpg = async (file: Buffer) => {
  if (await checkHEIC(file)) {
    console.log("Converting HEIC to JPEG");
    const heic = await heicConvert({
      buffer: file,
      format: "JPEG",
      quality: 1,
    });
    const heicBuffer = Buffer.from(heic);
    return heicBuffer;
  }
  return file;
};

export const getFileFromUrl = async (fileUrl: string) => {
  let image = await axios.get(fileUrl, {
    responseType: "arraybuffer",
  });
  if (image.status !== 200) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    image = await axios.get(fileUrl, {
      responseType: "arraybuffer",
    });
  }
  if (image.status !== 200) {
    throw new Error("Failed to fetch image from URL");
  }
  return Buffer.from(image.data);
};

export const getImageFromUrl = async (imageUrl: string) => {
  let imageBuffer: Buffer;
  if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
    let image = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    if (image.status !== 200) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      image = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
    }
    imageBuffer = Buffer.from(image.data);
  } else if (typeof (imageUrl as any).toBuffer === "function") {
    imageBuffer = (imageUrl as any).toBuffer("image/jpeg", {
      quality: 1,
    });
  } else {
    return null;
  }

  // Check file size (20MB limit -> Upscaled images will be about 15MB)
  if (imageBuffer.length > 20 * 1024 * 1024) {
    throw new Error("File size exceeds 20MB limit");
  }

  // Validate the file is an image using sharp
  try {
    await sharp(imageBuffer).metadata();
  } catch (error) {
    throw new Error("Invalid image file");
  }

  return imageBuffer;
};
