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

    for (let key in fileTable) {
      if (Array.isArray(fileTable[key])) {
        tempFileContent[key] = {};
        
        // Separate files and nested objects
        const fileItems = [];
        const nestedItems = [];
        
        for (let item of fileTable[key]) {
          if (typeof item === 'string') {
            fileItems.push(item);
          } else if (typeof item === 'object') {
            nestedItems.push(item);
          }
        }
        
        // Fetch all files in parallel
        if (fileItems.length > 0) {
          const fetchPromises = fileItems.map(async (item) => {
            let fileURL = `${basePath}${key}/${item}`;
            let content = await fetchContent(fileURL);
            return { item, content, fileURL };
          });
          
          const results = await Promise.all(fetchPromises);
          
          // Process results and update UI
          for (const { item, content, fileURL } of results) {
            compileElement.innerHTML += `<div>Loaded: ${fileURL}</div>`;
            lineCount++;

            while (lineCount > 20) {
              compileElement.removeChild(compileElement.firstChild);
              lineCount--;
            }

            tempFileContent[key][item] = content;
          }
        }
        
        // Handle nested objects in parallel
        if (nestedItems.length > 0) {
          const nestedPromises = nestedItems.map(async (item) => {
            const nestedResults = {};
            for (let nestedKey in item) {
              const result = await loadfileContents({ [nestedKey]: item[nestedKey] }, `${basePath}${key}/`);
              nestedResults[nestedKey] = result[nestedKey];
            }
            return nestedResults;
          });
          
          const nestedResults = await Promise.all(nestedPromises);
          
          // Merge nested results into tempFileContent
          for (const nestedResult of nestedResults) {
            for (let nestedKey in nestedResult) {
              tempFileContent[key][nestedKey] = nestedResult[nestedKey];
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

    // Play startup audio from IndexedDB or fileContents
    async function playStartupAudio() {
      try {
        let audioData = null;
        
        // Try to get from IndexedDB first
        if (typeof findFileContents !== 'undefined') {
          audioData = await findFileContents('system', 'sacred_startup.mp3');
        }
        
        // Fallback to fileContents if not in IndexedDB yet (fresh install)
        if (!audioData && fileContents && fileContents.system && fileContents.system['sacred_startup.mp3']) {
          audioData = fileContents.system['sacred_startup.mp3'];
        }
        
        if (audioData) {
          // Convert base64 string to blob
          const binaryString = atob(audioData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(blob);
          
          // Create and play audio
          const audio = new Audio(audioUrl);
          audio.play().catch(err => {
            console.log('Could not play startup audio:', err);
          });
          
          // Clean up the object URL after audio ends
          audio.addEventListener('ended', () => {
            URL.revokeObjectURL(audioUrl);
          });
        }
      } catch (error) {
        console.log('Could not load startup audio:', error);
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
        
        // Play startup audio with 1 second delay
        setTimeout(() => playStartupAudio(), 1000);
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
        setTimeout(() => guiStart(), 800);
      }
      if (fileContents.programs['default']['files.html']) {
        // Wait for loadFont to complete before creating iframe so it gets the updated CSS with font src
        async function createDesktopIframe() {
          // Wait for gui.js to be loaded and loadFont to be available
          while (typeof loadFont === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          // Load font before creating iframe so CSS has the font src
          await loadFont();
          let desktop = document.createElement('iframe');
          modifiedData = fileContents.programs['default']['files.html'];
          modifiedData = modifiedData.replace(
            "const initialMode = MODES.OPEN;",
            "const initialMode = MODES.DESKTOP;"
          );
          modifiedData = modifiedData.replace(
            "--displayTopRowControls: initial;",
            "--displayTopRowControls: none;"
          );
          modifiedData = modifiedData.replace(
            "--scrollObjectsY: auto;",
            "--scrollObjectsY: none;"
          );
          desktop.srcdoc = modifiedData;
          desktop.style = "border: 0; position:fixed; top:0; left:0; right:0; bottom:0; width:100%; height:100%;"
          document.body.appendChild(desktop);
        }
        createDesktopIframe();
      }
    }
  }