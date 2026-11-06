# Memory Chapel 3D

A walkable 3D church built with Three.js, Vite, and Capacitor. The stained glass, vaulted nave, altar, pews, rigged female character, and dated memory doors are generated in the scene. Unsplash photos are used for memory paintings and need an internet connection.

## Start the game

Do not double-click `index.html`: this project imports Three.js as a JavaScript module, so opening it as a `file://` page causes a module-loading error. Start the local web server instead:

1. Open a terminal in this `memory-room-game` folder.
2. Run these commands:

   ```sh
   npm install
   npm run dev
   ```

3. Open the local URL printed by Vite (usually `http://localhost:5173`).

You can use `npm start` instead of `npm run dev` to start Vite and open the browser automatically.

To make the production web build, run `npm run build`. The generated app is in `dist/`.

## Controls

- Walk with arrow keys or WASD.
- Walk up to a dated door on the right side of the church and press **E** or **Space** to enter its walkable gallery.
- The bright gallery displays all three sample photos at once, each in a frame with its date, title, and full story on a wall plaque. Click/tap a painting, or walk close and press **E/A**, to open its readable details.
- Drag with a mouse or swipe on a touch screen to look around. Camera angle resets to a useful view when changing rooms.
- Controller: D-pad or left analog stick to walk, **A / Cross** (button 0) to enter/read/return, **B / Circle** (button 1) or **Escape** to close details or return to the church.
- Touch: use the on-screen D-pad and **A · ENTER** button.
- In the gallery, walk back to the entrance and press **E/A**, or use **B/Circle** or **Escape** to return to the church.

Some browsers expose a gamepad only after the player presses a controller button once. Pair Bluetooth controllers through Android settings before using them in the app.

## Package for Android with Capacitor

Requirements: Node.js 22+, Android Studio, and an Android SDK. Capacitor's Android project is managed through Android Studio.

1. Run `npm install` in this folder.
2. Create the native Android project (first time only):

   ```sh
   npx cap add android
   ```

3. Build the web app and copy it into the native project:

   ```sh
   npm run android:sync
   ```

4. Open Android Studio:

   ```sh
   npx cap open android
   ```

5. Wait for Gradle sync, select an emulator or connected device, then press **Run**.
6. To create an APK, choose **Build → Build Bundle(s) / APK(s) → Build APK(s)**. For a signed release, choose **Build → Generate Signed Bundle / APK** and follow the wizard.

After changing the game, run `npm run android:sync` again before rebuilding. Capacitor reads the Vite output from `dist`, as configured in `capacitor.config.json`.

See the [Three.js installation guide](https://threejs.org/manual/en/installation.html), [Capacitor installation guide](https://capacitorjs.com/docs/getting-started), and [Capacitor Android guide](https://capacitorjs.com/docs/android).

## Character asset

The bundled animated woman GLB is by Quaternius via [Poly Pizza](https://poly.pizza/m/nIItLV9nxS), released under CC0. The model and its walk/idle animations are stored in `public/models/animated-woman.glb` so they are packaged with the game.
