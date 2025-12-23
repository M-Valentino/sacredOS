if ('caches' in window) {
    caches.keys().then(function (keyList) {
      return Promise.all(keyList.map(function (key) {
        return caches.delete(key);
      }));
    });
  }


  // These are the file paths for the OS to boot with a fresh install.
  // fileTable is now loaded from file_tree.json

  // Must be a var because other scripts appended to the DOM need access to it.
  var fileContents = "";
  let defaultFileContents = "";

  document.getElementById("uploadJson").addEventListener("click", function () {
    document.getElementById("fileInput").click();
  });

  document.getElementById("indexedDB").addEventListener("click", async function () {
    // Load IndexedDB wrapper first
    const indexedDBScript = document.createElement('script');
    indexedDBScript.src = 'system/indexeddb.js';
    await new Promise((resolve, reject) => {
      indexedDBScript.onload = resolve;
      indexedDBScript.onerror = reject;
      document.head.appendChild(indexedDBScript);
    });

    // Check if IndexedDB has data
    const hasIndexedDBData = await hasData();
    
    if (!hasIndexedDBData) {
      // Check if there's old localStorage data to migrate
      const oldLocalStorageData = localStorage.getItem("SacredSession");
      if (oldLocalStorageData) {
        try {
          fileContents = JSON.parse(oldLocalStorageData);
          // Migrate from localStorage to IndexedDB
          await importFromObject(fileContents);
          // Continue with boot
          await afterFileContentLoaded();
          return;
        } catch (error) {
          console.error("Error migrating from localStorage:", error);
        }
      }
      // No data found
      document.getElementById("noIDBDialog").style.display = "initial";
    } else {
      // Load data from IndexedDB
      fileContents = await exportToObject();
      await afterFileContentLoaded();
    }
  });

  document.getElementById("fileInput").addEventListener("change", async function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async function (e) {
        // Load IndexedDB wrapper first
        const indexedDBScript = document.createElement('script');
        indexedDBScript.src = 'system/indexeddb.js';
        await new Promise((resolve, reject) => {
          indexedDBScript.onload = resolve;
          indexedDBScript.onerror = reject;
          document.head.appendChild(indexedDBScript);
        });

        // Parse JSON file
        fileContents = JSON.parse(e.target.result);
        
        // Clear all existing IndexedDB data
        await clearAll();
        
        // Import the JSON data into IndexedDB
        await importFromObject(fileContents);
        
        // Boot from the imported data
        await afterFileContentLoaded();
      };
      reader.readAsText(file);
    }
  });

  document.getElementById("defaultSettings").addEventListener("click", async function () {
    const bootOptions = document.getElementById("bootOptions");
    bootOptions.remove()
    
    // Load IndexedDB wrapper first
    const indexedDBScript = document.createElement('script');
    indexedDBScript.src = 'system/indexeddb.js';
    await new Promise((resolve, reject) => {
      indexedDBScript.onload = resolve;
      indexedDBScript.onerror = reject;
      document.head.appendChild(indexedDBScript);
    });
    
    // Fetch file_tree.json
    const fileTableResponse = await fetch('system/file_tree.json');
    const fileTable = await fileTableResponse.json();
    
    // Clear all existing IndexedDB data for fresh install
    await clearAll();
    
    defaultFileContents = await loadfileContents(fileTable);
    fileContents = defaultFileContents;
    await afterFileContentLoaded();
  });

  async function fetchContent(fileURL) {
    try {
      let time = new Date().getTime();
      const response = await fetch(`${fileURL}?t=${time}`);

      if (response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        const extension = fileURL.split('.').pop().toLowerCase();
        // Determine if the file is of a type that we handle as text
        if (['html', 'css', 'json', 'js', 'txt'].includes(extension)) {
          return await response.text();
        } else {
          const arrayBuffer = await response.arrayBuffer();
          const binaryContent = new Uint8Array(arrayBuffer);
          let base64String = "";
          // In Safari, String.fromCharCode supports a max arg length of 65535
          for (let i = 0; i < binaryContent.length; i += 65535) {
            base64String += btoa(
              String.fromCharCode(...binaryContent.slice(i, i + 65535))
            );
          }

          return base64String;
        }
      } else {
        console.error(`Error fetching file ${fileURL}: HTTP status ${response.status}`);
      }
    } catch (err) {
      console.error(`Error fetching file ${fileURL}: ${err}`);
    }
  }

  let lineCount = 0;
  const compileElement = document.getElementById("compile");

  async function loadfileContents(fileTable, basePath = '') {
    document.getElementById("sysChecks").style.display = "none";
    document.getElementById("freshInstallInfo").style.display = "initial";
    let tempFileContent = {};
    let tempObjectContent = {};

    for (let key in fileTable) {
      if (Array.isArray(fileTable[key])) {
        tempFileContent[key] = {};
        for (let item of fileTable[key]) {
          if (typeof item === 'string') {
            let fileURL = `${basePath}${key}/${item}`;
            let content = await fetchContent(fileURL);

            compileElement.innerHTML += `<div>Loaded: ${fileURL}</div>`;
            lineCount++;

            while (lineCount > 20) {
              compileElement.removeChild(compileElement.firstChild);
              lineCount--;
            }

            tempFileContent[key][item] = content;
          } else if (typeof item === 'object') {
            for (let nestedKey in item) {
              tempObjectContent = tempFileContent;
              tempObjectContent[key][nestedKey] = await loadfileContents({ [nestedKey]: item[nestedKey] }, `${basePath}${key}/`);
              tempFileContent[key][nestedKey] = tempObjectContent[key][nestedKey][nestedKey];
            }
          }
        }
      }
    }

    return tempFileContent;
  }

  async function afterFileContentLoaded() {
    // Load IndexedDB wrapper first (if not already loaded)
    if (typeof initDB === 'undefined') {
      const indexedDBScript = document.createElement('script');
      indexedDBScript.src = 'system/indexeddb.js';
      await new Promise((resolve, reject) => {
        indexedDBScript.onload = resolve;
        indexedDBScript.onerror = reject;
        document.head.appendChild(indexedDBScript);
      });
    }

    // Migrate fileContents to IndexedDB (only if we have fileContents from fresh install)
    // Note: JSON backups handle their own clearing and importing before calling this function
    if (fileContents && Object.keys(fileContents).length > 0) {
      // Check if IndexedDB already has data - if so, don't overwrite (unless it's a fresh install)
      const hasIndexedDBData = await hasData();
      if (!hasIndexedDBData) {
        await importFromObject(fileContents);
      }
    }

    // Check if fileContents are loaded
    if (fileContents && fileContents.system) {
      if (fileContents.system['gui.frag.html']) {
        let guiHTML = document.createElement('div');
        guiHTML.innerHTML = fileContents.system['gui.frag.html'];
        document.body.appendChild(guiHTML);
        // Hide user prompt and show main menu
        document.getElementById("crtAndBootContainer").style.display = "none";
        document.getElementById("scanLines").style.display = "none";
      }
      if (fileContents.system['gui.css']) {
        let styleElement = document.createElement('style');
        styleElement.type = 'text/css';
        styleElement.innerText = fileContents.system['gui.css'];
        document.head.appendChild(styleElement);
      }
      if (fileContents.system['kernel.js']) {
        let kernelScript = document.createElement('script');
        kernelScript.type = 'text/javascript';
        kernelScript.textContent = fileContents.system['kernel.js'];
        document.body.appendChild(kernelScript);
      }
      if (fileContents.system['gui.js']) {
        let guiScript = document.createElement('script');
        guiScript.type = 'text/javascript';
        guiScript.textContent = fileContents.system['gui.js'];
        document.body.appendChild(guiScript);
        // Wait a bit for scripts to load, then start GUI
        setTimeout(() => guiStart(), 100);
      }
      if (fileContents.system['desktop.js']) {
        let kernelScript = document.createElement('script');
        kernelScript.type = 'text/javascript';
        kernelScript.textContent = fileContents.system['desktop.js'];
        document.body.appendChild(kernelScript);
      }
    }
  }