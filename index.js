const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

const app = express();

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const TOKEN_PATH = path.join(__dirname, "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  try {
    let client = await loadSavedCredentialsIfExist();
    if (client !== null) {
      return client;
    }
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
    }
    return client;
  } catch (error) {
    console.log("rekjrelkarlkeanfjlkewnflke", error);
  }
}

async function listFolders(authClient) {
  const drive = google.drive({ version: "v3", auth: authClient });
  const res = await drive.files.list({
    pageSize: 10,
    fields: "nextPageToken, files(id, name)",
    q: "mimeType='application/vnd.google-apps.folder'",
  });
  const folders = res.data.files;
  if (folders.length === 0) {
    return "No folders found.";
  }

  return folders
}

async function listFiles(authClient) {
  const drive = google.drive({ version: "v3", auth: authClient });
  const res = await drive.files.list({
    // pageSize: 10,
    fields: "nextPageToken, files(id, name)",
    q: "mimeType contains 'image/'",
  });
  const files = res.data.files;
  if (files.length === 0) {
    return "No files found.";
  }

  console.log("filesfiles", files);

  return files;
}

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// Home page
app.get("/", async (req, res, next) => {
  // Initialize isAuthorized variable to false
  let isAuthorized = false;

  // Attempt to authorize
  const client = await authorize();

  // If authorization is successful, set isAuthorized to true
  if (client !== null) {
    isAuthorized = true;
  }

  // Construct data object to pass to the template
  const data = {
    title: "Welcome to My Google Drive Gallery",
    isAuthorized: isAuthorized,
    url: isAuthorized ? "/files" : "/auth",
  };

  // Render the "index.ejs" template and pass data to it
  res.render("index", { data });
});

// Authentication route
app.get("/auth", async (req, res, next) => {
  try {
    const client = await authorize();
    if (client !== null) {
      res.status(200).redirect("/files");
    }
  } catch (error) {
    console.log("sdalkndlkasnda", error);
    res.status(401).send("Authentication Required");
  }
});

// List files route
app.get("/files", async (req, res, next) => {
  try {
    const client = await authorize();
    const fileList = await listFiles(client);
    console.log("fileList", fileList);
    res.render("files", { files: fileList });
  } catch (error) {
    res.status(401).send("Authentication Required");
  }
});

// List folders route
app.get("/folders", async (req, res, next) => {
  try {
    const client = await authorize();
    const folderList = await listFolders(client);
    console.log("fileList", folderList);
    res.render("folder", { files: folderList });
  } catch (error) {
    console.log("dlahdlshlkdkas", error);
    res.status(401).send("Authentication Required");
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
