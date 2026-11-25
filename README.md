# Fireworks Sky

A toddler-friendly fireworks game. Tap the night sky to launch a rocket; it bursts into a
heart, star, smiley, spiral, willow or other firework. Swipe to draw sparkler trails. The
sleepy moon sometimes winks or giggles, and every 20 taps a little finale fills the sky.
No menus, no game over — just a firework counter.

* `index.html` – the whole game in one offline file (open in any browser).
* `apk/FireworksSky.apk` – Android app (package `com.fireworkssky.game`, Android 7+, portrait and landscape).

Rebuild: `./build.sh` (HTML) then `android/build-apk.sh` (APK, plain SDK tools, no Gradle).

Sounds and the gentle background music are synthesized in the game with the Web Audio API
(no third-party recordings). Open the in-game “ⓘ sounds” button for the same note.
