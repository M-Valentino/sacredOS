// IndexedDB wrapper for Sacred OS file system
// Stores files and folders in a hierarchical structure

const DB_NAME = 'SacredOS';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let db = null;

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'path' });
        objectStore.createIndex('path', 'path', { unique: true });
      }
    };
  });
}

// Convert path array to string key
function pathToKey(pathArray) {
  return pathArray.length === 0 ? '/' : '/' + pathArray.join('/');
}

// Convert path string to array
function pathToArray(pathString) {
  if (!pathString || pathString === '/' || pathString === '') {
    return [];
  }
  return pathString.split('/').filter(p => p !== '');
}

// Get file or folder at path
async function getPath(pathArray) {
  await initDB();
  const key = pathToKey(pathArray);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get path: ${key}`));
    };
  });
}

// Set file or folder at path
async function setPath(pathArray, value) {
  await initDB();
  const key = pathToKey(pathArray);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ path: key, value: value });

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to set path: ${key}`));
    };
  });
}

// Delete file or folder at path
async function deletePath(pathArray) {
  await initDB();
  const key = pathToKey(pathArray);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete path: ${key}`));
    };
  });
}

// Check if path exists
async function pathExists(pathArray) {
  const value = await getPath(pathArray);
  return value !== null;
}

// Get all paths (for migration/debugging)
async function getAllPaths() {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error('Failed to get all paths'));
    };
  });
}

// Check if IndexedDB has any data
async function hasData() {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result > 0);
    };

    request.onerror = () => {
      reject(new Error('Failed to check for data'));
    };
  });
}

// Clear all data
async function clearAll() {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to clear database'));
    };
  });
}

// Helper function to convert base64 string to Uint8Array
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert nested object structure to IndexedDB
async function importFromObject(obj, basePath = []) {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  async function traverse(currentObj, currentPath) {
    for (const key in currentObj) {
      if (currentObj.hasOwnProperty(key)) {
        const newPath = [...currentPath, key];
        let value = currentObj[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Check if it's a Uint8Array (already bytes)
          if (value instanceof Uint8Array) {
            // It's already a Uint8Array, store as-is
            await new Promise((resolve, reject) => {
              const request = store.put({ path: pathToKey(newPath), value: value });
              request.onsuccess = () => resolve();
              request.onerror = () => reject(new Error(`Failed to import file: ${pathToKey(newPath)}`));
            });
          } else if (Object.keys(value).length === 0) {
            // It's a folder (empty object)
            await new Promise((resolve, reject) => {
              const request = store.put({ path: pathToKey(newPath), value: {} });
              request.onsuccess = () => resolve();
              request.onerror = () => reject(new Error(`Failed to import folder: ${pathToKey(newPath)}`));
            });

            // Recursively traverse folder contents
            await traverse(value, newPath);
          } else {
            // It's a folder (object with keys)
            await new Promise((resolve, reject) => {
              const request = store.put({ path: pathToKey(newPath), value: {} });
              request.onsuccess = () => resolve();
              request.onerror = () => reject(new Error(`Failed to import folder: ${pathToKey(newPath)}`));
            });

            // Recursively traverse folder contents
            await traverse(value, newPath);
          }
        } else if (typeof value === 'string') {
          // It's a string - could be text or base64
          // For backward compatibility: if it looks like base64 (long string without newlines for binary files),
          // convert it to Uint8Array. Otherwise, convert text to Uint8Array.
          // We'll convert all strings to Uint8Array to be consistent
          const extension = key.split('.').pop().toLowerCase();
          if (['html', 'css', 'json', 'js', 'txt'].includes(extension)) {
            // Text file - convert string to Uint8Array using UTF-8 encoding
            const encoder = new TextEncoder();
            value = encoder.encode(value);
          } else {
            // Binary file - assume it's base64 and convert to Uint8Array
            // Check if it's valid base64
            try {
              value = base64ToUint8Array(value);
            } catch (e) {
              // If base64 decode fails, treat as text and encode to bytes
              const encoder = new TextEncoder();
              value = encoder.encode(value);
            }
          }
          await new Promise((resolve, reject) => {
            const request = store.put({ path: pathToKey(newPath), value: value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to import file: ${pathToKey(newPath)}`));
          });
        } else {
          // It's some other type - store as-is (shouldn't happen normally)
          await new Promise((resolve, reject) => {
            const request = store.put({ path: pathToKey(newPath), value: value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to import file: ${pathToKey(newPath)}`));
          });
        }
      }
    }
  }

  await traverse(obj, basePath);
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve();
  });
}

// Helper function to convert Uint8Array to base64 string
function uint8ArrayToBase64(uint8Array) {
  let binaryString = "";
  // In Safari, String.fromCharCode supports a max arg length of 65535
  for (let i = 0; i < uint8Array.length; i += 65535) {
    binaryString += String.fromCharCode(...uint8Array.slice(i, i + 65535));
  }
  return btoa(binaryString);
}

// Convert IndexedDB to nested object structure (for backward compatibility)
async function exportToObject() {
  await initDB();
  const allPaths = await getAllPaths();
  const result = {};

  function setNestedValue(obj, pathArray, value) {
    let current = obj;
    for (let i = 0; i < pathArray.length - 1; i++) {
      const key = pathArray[i];
      if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }
    const finalKey = pathArray[pathArray.length - 1];
    // If it's a folder (empty object), set it as empty object
    // If it's a file, set the value
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value instanceof Uint8Array) {
        // Convert Uint8Array based on file type
        const extension = finalKey.split('.').pop().toLowerCase();
        if (['html', 'css', 'json', 'js', 'txt'].includes(extension)) {
          // Text file - decode to string
          const decoder = new TextDecoder('utf-8');
          current[finalKey] = decoder.decode(value);
        } else {
          // Binary file - convert to base64 string for JSON export
          current[finalKey] = uint8ArrayToBase64(value);
        }
      } else if (Object.keys(value).length === 0) {
        // It's a folder - ensure it exists as empty object
        if (!current[finalKey] || typeof current[finalKey] !== 'object') {
          current[finalKey] = {};
        }
      } else {
        // It's some other object - store as-is
        current[finalKey] = value;
      }
    } else {
      // It's a file - set the value (should be string or other primitive)
      current[finalKey] = value;
    }
  }

  for (const item of allPaths) {
    const pathArray = pathToArray(item.path);
    if (pathArray.length > 0) {
      setNestedValue(result, pathArray, item.value);
    }
  }

  return result;
}

// Find file contents (compatible with existing API)
async function findFileContents(directoryPath, fileName) {
  const pathArray = directoryPath === '' ? [] : pathToArray(directoryPath);
  const fullPath = [...pathArray, fileName];
  const value = await getPath(fullPath);
  return value ? structuredClone(value) : null;
}

// Make folder (compatible with existing API)
async function makeFolder(directoryPath, folderName) {
  if (folderName === '') {
    throw new Error('Invalid folder name!');
  }

  const pathArray = directoryPath === '' || directoryPath === '/' ? [] : pathToArray(directoryPath);
  const folderPath = [...pathArray, folderName];

  if (await pathExists(folderPath)) {
    throw new Error('A folder with that name already exists!');
  }

  await setPath(folderPath, {});
}

// Make file (compatible with existing API)
async function makeFile(directoryPath, fileName) {
  if (fileName === '') {
    throw new Error('Invalid file name!');
  }

  const pathArray = directoryPath === '' ? [] : pathToArray(directoryPath);
  const filePath = [...pathArray, fileName];

  if (await pathExists(filePath)) {
    throw new Error('A file with that name already exists!');
  }

  await setPath(filePath, '');
}

// Save file contents (compatible with existing API)
async function saveFileContentsRecursive(directoryPath, fileName, fileContent) {
  const pathArray = directoryPath === '' ? [] : pathToArray(directoryPath);
  const filePath = [...pathArray, fileName];
  await setPath(filePath, fileContent);
}

// Delete file or folder (compatible with existing API)
async function deleteFile(directoryPath, fileName) {
  const pathArray = directoryPath === '' ? [] : pathToArray(directoryPath);
  const filePath = [...pathArray, fileName];

  // Check if it's a folder and delete all children
  const value = await getPath(filePath);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // It's a folder, need to delete all children
    const allPaths = await getAllPaths();
    const filePathStr = pathToKey(filePath);
    
    for (const item of allPaths) {
      if (item.path.startsWith(filePathStr + '/')) {
        await deletePath(pathToArray(item.path));
      }
    }
  }

  await deletePath(filePath);
}

// Rename file or folder
async function renamePath(directoryPath, oldName, newName) {
  const pathArray = directoryPath === '' ? [] : pathToArray(directoryPath);
  const oldPath = [...pathArray, oldName];
  const newPath = [...pathArray, newName];

  // Get the old value
  const value = await getPath(oldPath);
  if (value === null) {
    throw new Error('File or folder not found');
  }

  // Check if new path already exists
  if (await pathExists(newPath)) {
    throw new Error('A file or folder with that name already exists!');
  }

  // If it's a folder, we need to move all children
  if (typeof value === 'object' && !Array.isArray(value)) {
    const allPaths = await getAllPaths();
    const oldPathStr = pathToKey(oldPath);
    const newPathStr = pathToKey(newPath);

    // First, create the new folder
    await setPath(newPath, {});

    // Then move all children
    for (const item of allPaths) {
      if (item.path.startsWith(oldPathStr + '/')) {
        const relativePath = item.path.substring(oldPathStr.length + 1);
        const newItemPath = newPathStr + '/' + relativePath;
        await setPath(pathToArray(newItemPath), item.value);
        await deletePath(pathToArray(item.path));
      }
    }
  } else {
    // It's a file, just move it
    await setPath(newPath, value);
  }

  // Delete the old path
  await deletePath(oldPath);
}

