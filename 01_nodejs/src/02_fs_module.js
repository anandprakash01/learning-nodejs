const fs = require("fs");
const fSystem = require("fs/promises");

// Ground Rule (Applies to ALL fs methods)
// Callback Pattern:
// (err, result) => {}
// err → error object (if failed)
// result → operation output (if any)

// Return Value:
// Callback API → returns undefined
// Promise API → returns Promise
// Sync API → returns actual value (blocking)

// Options:
// {
//   recursive: true,  // create nested dirs
//   mode: 0o777       // permissions (Unix)
// }

// Method        Returns (callback)     Callback Signature
// ------------------------------------------------------
// mkdir         undefined              (err)
// rm            undefined              (err)
// readdir       undefined              (err, files[])
// readFile      undefined              (err, data)
// writeFile     undefined              (err)
// appendFile    undefined              (err)
// unlink        undefined              (err)

const fileName = "log.txt";
const fileContent = "Hello this is a file created by node js File System module :)🥳\n";
const path = "./src/log/" + fileName;

// --------------writeFile--------------------------
// fs.writeFile(path, data, options?, callback)
// fs.promises.writeFile(path, data, options?)

// options
// {
//   encoding: "utf-8",
//   mode: 0o666,
//   flag: "w" // overwrite
// }

// ===== Callback API (Old but core)
// fs.writeFile(filePath, fileContent, callbackFun)
const writeFile = () => {
  // Asynchronous type
  fs.writeFile(path, fileContent, error => {
    if (error) {
      console.log("Error while writing a file: ", error);
      return;
    }

    console.log("File created successfully: ");
  });
};
const writeFileSync = () => {
  // blocks entire event loop, synchronous
  fs.writeFileSync(path, fileContent, error => {
    console.log("Inside");
    if (error) {
      console.log("Error while writing a file: ", error);
      return;
    }

    console.log("File created successfully: ");
  });
};

// ===== Promise API (Enterprise Standard)
// only works for require("fs/promises")

const writeFileAsync = async () => {
  try {
    // const data = await fSystem.writeFile(path, fileContent);
    // console.log(data)

    await fSystem.writeFile(path, fileContent);
    console.log("File written successfully via Promise API");
  } catch (err) {
    console.log("Error writing via Promises API:", err);
  }
};
// writeFile();
// writeFileSync();
// writeFileAsync();
// if the file name given is already exist, it will override that file and its content

// ------------------Update File-----------------
// ===== Callback API (Old but core)
// fs.appendFile(path, data, options?, (err)=>{})

const appendFile = () => {
  // if there is no such file named <fileName> , it will create file
  console.log(new Date());
  const msg = `at ${new Date().toLocaleString()} user login activity\n`;
  fs.appendFile(path, msg, err => {
    if (err) {
      console.log("Unable to update file: ", error);
      return;
    }

    console.log("File updated successfully: ");
  });
};
// synchronous type
// fs.appendFileSync(fileName, msg);

// ===== Promise API (Enterprise Standard)
const appendFileAsync = async () => {
  const msg = `at ${new Date().toLocaleString()} user login activity\n`;

  try {
    fSystem.appendFile(path, msg);
    console.log("File updated successfully: ");
  } catch (err) {
    console.log("Unable to update file: ", error);
    return;
  }
};

// appendFile();
// appendFileAsync();

// --------------readFile---------------------
// fs.readFile(path, options, callback)
// fs.readFileSync(path, options)
// fs.promises.readFile(path, options)

// fs.readdir(path, options, callback)
// returns files → array of names
// options
// {
// encoding: "utf-8",
// withFileTypes: true // returns Dirent objects
// }
// ===== Callback API (Old but core)
const readFile = () => {
  const readText = fs.readFile(path, (err, data) => {
    if (err) {
      //if fileName does not exist then it will give error
      console.log("ERROR WHILE READING FILE: ", error);
      return;
    }
    console.log("Buffer data: ", data); // this is buffer data

    console.log("File read successfully: ", data.toString()); //this is text data

    // reading big data
    // const stream = fs.createReadStream("bigfile.txt", {
    //   encoding: "utf-8",
    // });

    // stream.on("data", chunk => {
    //   console.log(chunk);
    // });
  });
  console.log("Data outside callback: ", readText); // this will give undefined because it asynchronous
};

const readFileSync = () => {
  const readText2 = fs.readFileSync(path, (err, data) => {
    if (err) {
      console.log("ERROR WHILE READING FILE: ", err);
      return;
    }
    console.log("File read successfully: ", data.toString()); //this is text data
  });
  console.log(`File read successfully outside cb:\n${readText2.toString()}`); //this is text data, synchronous thats why it is giving data
};

// ===== Promise API (Enterprise Standard)
// only works for require("fs/promises")

const readFileAsync = async () => {
  try {
    // const data = await fSystem.readFile(path);
    const data = await fSystem.readFile(path, "utf-8");
    // passing "utf-8" will convert to string data
    console.log(`Data read successfully via Promise API:\n${data}`);
  } catch (err) {
    console.log("ERROR WHILE READING FILE via Promises API: ", err);
    return;
  }
};

readFile();
// readFileSync();
// readFileAsync();

// --------------------deleteFile-----------------
// fs.unlink(path, callback)        // delete file
// fs.rm(path, { recursive: true })
const deleteFile = () => {
  fs.unlink(path, err => {
    if (err) {
      console.log("Error while deleting file: ", error);
      return;
    }
    console.log(`File ${fileName} Deleted SUCCESSFULLY!`);
  });
};

const deleteFileAsync = async () => {
  try {
    const data = await fSystem.unlink(path);
    console.log(`File ${fileName} Deleted SUCCESSFULLY VIA PROMISES API! `, data);
  } catch (err) {
    console.log("Error while deleting file: ", err);
  }
};
// deleteFile();
// deleteFileAsync();

// -------------------createFolder-------------
// fs.mkdir(path)
// fs.rmdir(path)
// fs.readdir(path)
// fs.promises.mkdir(path, { recursive: true })
// No result returns.

const createFolder = () => {
  const folderName = "test-folder";
  // if file already exists gives error
  fs.mkdir("./src/log/" + folderName, err => {
    if (err) {
      console.log("ERROR CREATING FOLDER", err);
      return;
    }
    console.log("Folder created successfully");
  });
};

const createFolderAsync = async () => {
  const folder = "test";
  try {
    await fSystem.mkdir("./src/log/" + folder);
  } catch (err) {
    console.log(err);
  }
};
// createFolder();
// createFolderAsync();

// ---------------check folder/file exists--------------

const exists = fs.existsSync("./src/log");
// console.log("Is folder Exist:", exists);
