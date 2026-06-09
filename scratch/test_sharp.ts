import { downloadMediaBuffer } from "../src/Library/s3.ts";
import sharp from "sharp";

async function testSharpHang() {
  const keys = [
    "uploads/cmq2p8dnv0000io9pz0g9x3ng/1780978052997-Picsart_26-06-08_08-42-51-015.jpg.jpeg",
    "uploads/cmq2p8dnv0000io9pz0g9x3ng/1780977984282-Picsart_26-06-08_08-52-09-455.jpg.jpeg",
    "uploads/cmq2p8dnv0000io9pz0g9x3ng/1780978011334-Picsart_26-06-08_08-45-50-782.jpg.jpeg"
  ];

  for (const key of keys) {
    console.log(`Downloading ${key}...`);
    try {
      const buffer = await downloadMediaBuffer(key);
      console.log(`Downloaded ${buffer.length} bytes. Running sharp...`);
      
      const promise = sharp(buffer)
        .resize(1080, 1080, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
        
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("SHARP_TIMEOUT")), 5000));
      
      await Promise.race([promise, timeoutPromise]);
      console.log(`Sharp finished successfully for ${key}`);
    } catch (err) {
      console.error(`Error for ${key}:`, err);
    }
  }
}

testSharpHang().catch(console.error);
