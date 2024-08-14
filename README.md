# Sacred OS

Sacred OS is a simulated operating system that runs in your browser. It is a Windows 9x inspired OS, and every
HTML file is executable. Sacred OS is written in vanilla JavaScript. Sacred OS uses a bootloader so you can
use the OS with your saved settings, programs, files, etc.
<img src="https://i.imgur.com/79paNsU.png">

## How it works

Sacred OS runs off a JavaScript object which is essentially the "hard disk". The GUI, the kernal, programs,
and more are all stored here. The bootloader writes to this object either by uploading a disk backup or by
fetching all the necessary files and storing them (what happens when you boot from a fresh install).

In Sacred OS, HTML files are executable. When you execute an HTML file, it is loaded into a window which
contains an iframe of the HTML file. These HTML files can communicate with the kernel, such as requesting
the system's main style sheet or writing to the disk.

## Running Locally

In order for Sacred OS to function properly in a local environment, the files need to have an origin to them.
Otherwise, you will expirience CORS errors. One solution is to use Node.js to create an http server.

#### Starting the http Server

After cloning the repo, go into your terminal and change the current directory to `public` and run

`npx http-server --cors`.

## Developing in Sacred OS

## Communicating with the kernel

To see an incomplete list of kernel commands, <a href="https://sacred.neocities.org/outsideTheOS/about">Click here</a>.

### Requesting System styling for a program

What isn't planned on being changed is how programs can receive system CSS styling for things like buttons and inputs.
The system styling is stored in `gui.css`. Below is how you would send a mesage to the kernel to get the styling and apply it to the current program:

```
window.top.postMessage("REQ:SS", "*");
    window.onmessage = function (e) {
      if (e.data.startsWith("SS:")) {
        const stylesheet = e.data.substring(3);
        try {
          const styleElement = document.createElement('style');
          styleElement.type = 'text/css';
          styleElement.innerText = stylesheet;
          document.head.appendChild(styleElement);
        } catch (error) {
          console.error("Error requesting stylesheet:", error);
        }
        return;
      }
    };
```

### Publishing an app in the app store

If you have a good single page web app or game that can be contained in an HTML file, I'm accepting pull requests
to add it into my OS's app store. You will need to add your app inside the `appStore/apps` directory and update
`appStoreData.json`. You will need an `install.js` file. You can simply copy and paste the code from an existing one and then modify it. Your icon should be square shaped. I do ask that assets from external URLs should only be used for fonts and coding libraries from
well known organizations like Tailwind CSS and Google Fonts for example.

### Sacred OS HTML Program Headers

If you want to assign a specific default window size to a program or disable resizing, you must put a comment
at the top of the HTML file that follows this structure:
`<!--width="160" height="144" noRS-->`.

- `width` and `height`: window size in CSS pixel units.
- `noRS`: stands for "no resize". This disables a maximize button from appearing on the program.

## Deploying

### Easy Deployment

Deploying Sacred OS to any site is really simple. All you have to do is copy all the files inside the `public`
folder.

### Automatic Deployment to Neocities

For my personal deployment on Neocities, I use a GitHub action to automatically upload changed files in
the `public` folder after every merge to the <b>main</b> branch. The reason why the `public` folder exists is
because Neocities only allows specific file types, and this repo has some files that aren't uploadable, so they
are stored in the root of this repo. To learn more about deploying to Neocities, read this guide:
https://liassica.codeberg.page/posts/0002-neocities-github/
