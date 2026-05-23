const mysql = require("mysql2/promise");
const crypto = require("crypto");
const { ImageXClient } = require("@volcengine/imagex-openapi");

const VOLC_ACCESS_KEY = process.env.VOLC_ACCESS_KEY || "";
const VOLC_SECRET_KEY = process.env.VOLC_SECRET_KEY || "";
const SHORT_ID = "699z2ac540";
const CUSTOM_DOMAIN = "voic.51webjs.com";

async function uploadBase64ToCdn(base64Data) {
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid base64 format");
  
  const buffer = Buffer.from(matches[2], "base64");
  const fileName = `migrate_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.png`;
  const storeKey = `user/${fileName}`;

  const client = new ImageXClient({
    accessKey: VOLC_ACCESS_KEY,
    secretKey: VOLC_SECRET_KEY,
    region: "cn-north-1",
    host: "imagex.volcengineapi.com",
  });

  const applyRes = await client.ApplyImageUpload({
    ServiceId: SHORT_ID,
    UploadNum: 1,
    StoreKeys: [storeKey],
  });

  if (!applyRes.Result?.UploadAddress?.StoreInfos?.length) {
    throw new Error("Failed to get upload token");
  }

  await client.DoUpload(
    [buffer],
    applyRes.Result.UploadAddress.UploadHosts[0],
    applyRes.Result.UploadAddress.StoreInfos
  );

  return `https://${CUSTOM_DOMAIN}/${SHORT_ID}/user%2F${fileName}~tplv-${SHORT_ID}-image.png`;
}

(async () => {
  const pool = mysql.createPool({
    host: "127.0.0.1",
    port: 16033,
    user: "mrl",
    password: "SYDPHJB8aGBn83Eh",
    database: "mrl",
  });

  const [rows] = await pool.query(
    "SELECT id, images FROM content_generation_requests WHERE images LIKE \"%base64%\""
  );
  console.log(`Found ${rows.length} records with base64 images`);

  for (const row of rows) {
    try {
      const images = JSON.parse(row.images);
      const newImages = [];
      let changed = false;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.startsWith("data:image/") && img.includes("base64")) {
          console.log(`  Record ${row.id}: migrating base64 image ${i + 1}/${images.length} (${Math.round(img.length / 1024)}KB)...`);
          try {
            const cdnUrl = await uploadBase64ToCdn(img);
            newImages.push(cdnUrl);
            changed = true;
            console.log(`  -> ${cdnUrl.slice(0, 80)}...`);
          } catch (e) {
            console.error(`  Upload failed, keeping base64: ${e.message}`);
            newImages.push(img);
          }
        } else {
          newImages.push(img);
        }
      }

      if (changed) {
        const newImagesJson = JSON.stringify(newImages);
        await pool.query(
          "UPDATE content_generation_requests SET images = ? WHERE id = ?",
          [newImagesJson, row.id]
        );
        const savedMB = Math.round((row.images.length - newImagesJson.length) / 1024 / 1024 * 100) / 100;
        console.log(`  Record ${row.id}: updated, saved ${savedMB}MB`);
      }
    } catch (e) {
      console.error(`Error processing record ${row.id}:`, e.message);
    }
  }

  console.log("Migration complete!");
  await pool.end();
})();
