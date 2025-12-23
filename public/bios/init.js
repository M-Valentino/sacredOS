// Replaces site thumbnail on Neocities
const urlParams = new URLSearchParams(window.location.search);
if (navigator.userAgent.includes('Screenjesus')) {
  document.getElementsByTagName('body')[0].innerHTML = '<style>*{margin: 0;padding: 0;box-sizing: border-box;}img{width:100vw;height:100vh;image-rendering:pixelated;}</style><img src="outsideTheOS/neocitiesThumbnail.png">';
}

document.getElementById("help").addEventListener("click", function () {
  document.getElementById("helpDialog").style.display = "initial";
});

document.getElementById("closeHelp").addEventListener("click", function () {
  document.getElementById("helpDialog").style.display = "none";
});

document.getElementById("closeNoIDB").addEventListener("click", function () {
  document.getElementById("noIDBDialog").style.display = "none";
});

let powerOn = true;
document.getElementById("powerButton").addEventListener("click", function () {
  if (powerOn) {
    let powerButton = document.querySelector(".powerButtonOn");
    powerButton.classList.remove("powerButtonOn");
    powerButton.classList.add("powerButtonOff");
    // Makes boot screen black
    document.getElementById("bootScreen").style.filter = "brightness(0) saturate(100%)";
    // Disables bios buttons
    document.getElementById("scanLines").style.pointerEvents = "auto";
    powerOn = false
  } else {
    let powerButton = document.querySelector(".powerButtonOff");
    powerButton.classList.remove("powerButtonOff");
    powerButton.classList.add("powerButtonOn");
    document.getElementById("bootScreen").style.filter = "none";
    document.getElementById("scanLines").style.pointerEvents = "none";
    powerOn = true;
  }
});

////////// System Check Code //////////
document.getElementById("screenRes").innerHTML =
  "Screen Resolution: <b>" +
  window.innerWidth + "x" + window.innerHeight + "</b>.";
if (window.innerWidth < 720 || window.innerHeight < 720) {
  document.getElementById("screenResWarning").innerHTML = `<b>Warning</b> Sacred OS doesn't support screen resolutions smaller than 720x720`;
}

const message = window.matchMedia("(any-pointer: coarse)").matches ? "device without a mouse or trackpad" : "mouse or trackpad";
document.getElementById("inputDev").innerHTML = "Detected: <b>" + message + "</b>.";
if (message !== "mouse or trackpad") {
  document.getElementById("inputDevWarning").innerHTML = `<b>Warning</b> Sacred OS doesn't support your ${message}.`;
}

document.getElementById("CPU").innerHTML =
  "Detected: <b>" + navigator.hardwareConcurrency + " logical CPU cores</b>.";
if (navigator.hardwareConcurrency === 1) {
  document.getElementById("CPUWarning").innerHTML = `<b>Warning</b> Sacred OS might be really slow on your device.`;
}

document.getElementById("language").innerHTML =
  "Detected Language: <b>" + navigator.language + "</b>."
if (navigator.language !== "en-US") {
  document.getElementById("languageWarning").innerHTML = `<b>Warning</b> Sacred OS doesn't support the ${navigator.language} language.`;
}

const userAgent = window.navigator.userAgent;
document.getElementById("userAgent").innerHTML =
  "Detected User Agent: <b>" + window.navigator.userAgent; + "</b>.";
let userAgentWarning = document.getElementById("userAgentWarning");
if (userAgent.includes("Edg")) {
  // Do nothing
} else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
  userAgentWarning.innerHTML = `<b>Warning</b> Safari has graphical bugs and does not update the cursor type when it should.`;
} else if (userAgent.includes("Firefox")) {
  userAgentWarning.innerHTML = `<b>Warning</b> The retro styled scrollbars in Sacred OS aren't supported in Firefox.`;
}

let memLimitText = document.getElementById("memoryLimit");
if (performance && performance.memory) {
  const memoryLimit = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2);
  memLimitText.innerHTML = `Detected JS Heap Size Limit: <b>${memoryLimit} MB</b>`;

  if (performance.memory.jsHeapSizeLimit < 1024 * 1024 * 48) { // Less than 48MB
    document.getElementById("memoryLimitWarning").innerHTML = `<b>Warning</b> Your device has limited memory resources. Sacred OS may run slowly.`;
  }
} else {
  memLimitText.innerHTML = `No JS heap size limit detected.`;
}
////////// End of System Check Code //////////