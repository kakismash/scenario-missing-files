const express = require("express");
const multer = require("multer");
const yauzl = require("yauzl");
const fs = require("fs");
const cors = require("cors")

const app = express();
const upload = multer({ dest: "uploads/" }); // Set the destination folder for uploaded files

app.use(cors())

app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file provided" });
  }
  // Process the file as needed
  await checkFile(file, res);
});

app.listen(8082, () => {
  console.log("Server is running on port 8082");
});

const checkFile = async (file, res) => {
  yauzl.open(file.path, { lazyEntries: true }, (err, zipfile) => {
    if (err) {
      console.error("Error opening zip file:", err);
      return res.status(500).json({ error: "Error opening zip file" });
    }

    const scenesFilesName = [];
    const mediaFilesName = [];
    let scenarioJSON = undefined;
    const missing = [];

    zipfile.readEntry();
    zipfile.on("entry", (entry) => {
      if (/\/$/.test(entry.fileName)) {
        console.log("Directory:", entry.fileName);
        zipfile.readEntry();
      } else {
        console.log("File:", entry.fileName);
        if (entry.fileName.includes("scene/")) {
          scenesFilesName.push(entry.fileName);
        } else if (entry.fileName.includes("media/")) {
          mediaFilesName.push(entry.fileName);
        }

        if (entry.fileName.endsWith("scenario.json")) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error("Error reading zip entry:", err);
              return res.status(500).json({ error: "Error reading zip entry" });
            }

            let content = "";
            readStream.on("data", (chunk) => {
              content += chunk;
            });

            readStream.on("end", () => {
              try {
                const jsonData = JSON.parse(content);
                scenarioJSON = jsonData;
              } catch (error) {
                console.error("Error parsing JSON:", error);
              }

              zipfile.readEntry();
            });
          });
        } else {
          zipfile.readEntry();
        }
      }
    });

    zipfile.on("end", () => {
      console.log("Zip file read successfully");

      console.log("JSON Data:", scenarioJSON);
      const scenes = scenarioJSON.scenes;
      scenes.forEach(scene => {

        const scenePath = scene.video ? scene.video : scene.image;
        const sceneExists = scenesFilesName.includes(scenePath);
        console.log(`${scenePath} exists: ${sceneExists}`);
        if (!sceneExists) {
          if (missing.some(m => m.path === scenePath)) {
            const mm = missing.find(m => m.path === scenePath);
            mm.assetIds.push(scene.assetId);
            mm.assetNames.push(scene.assetName);
          } else {
            missing.push({
              type: scene.video ? 'video' : 'image',
              path: scenePath,
              assetIds: [scene.assetId],
              assetNames: [scene.assetName]
            });
          }
        }

        if (scene.objects) {
          const objects = scene.objects;
          doObjectsCheck(objects, missing, mediaFilesName);
        }
      });

      removeFiles();
      res.json({ missing });
      // Delete the file

    });
  });
};


const doObjectsCheck = (objects, missing, mediaFilesName) => {
  objects.forEach(obj => {
    if (obj.src && obj.src.startsWith('media')) {
      const objectPath = obj.src;
      const objectExists = mediaFilesName.includes(objectPath);
      console.log(`${objectPath} exists: ${objectExists}`);
      if (!objectExists) {
        if (missing.some(m => m.path === objectPath)) {
          const mm = missing.find(m => m.path === objectPath);
          mm.assetIds.push(obj.assetId);
          mm.assetNames.push(obj.assetName);
        } else {
          missing.push({
            type: "object",
            path: objectPath,
            assetIds: [obj.assetId],
            assetNames: [obj.assetName]
          });
        }
      }
    }
    if (obj.objects && obj.objects.length > 0) {
      doObjectsCheck(obj.objects, missing, mediaFilesName);
    }
  });
}

const removeFiles = () => {
  const folderPath = './uploads';

  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
    }

    // Iterate over each file and delete it
    files.forEach(file => {
      const filePath = `${folderPath}/${file}`;

      fs.unlink(filePath, err => {
        if (err) {
          console.error('Error deleting file:', err);
        } else {
          console.log('File deleted:', file);
        }
      });
    });

  });
};
