const videoElement = document.getElementById('webcam');
const gestureEmoji = document.getElementById('gesture-emoji');
const statusText = document.getElementById('status-text');
const timerText = document.getElementById('timer');

function flashField(field) {
  if (!field) return;
  field.classList.add('flash-border');
  setTimeout(() => field.classList.remove('flash-border'), 600);
}

let selectedField = null;
let lastGesture = null;
let gestureStartTime = null;
let deleteCooldown = 0;
let sendCooldown = 0;
let micEnabled = true;
let recognition = null;
let isLeft = false;
let camera = null;
let pendingField = null;

// -------- Voice Typing Setup --------
function initSpeechRecognition() {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = function (event) {
    if (selectedField && micEnabled) {
      let transcript = event.results[event.results.length - 1][0].transcript.trim();

      if (selectedField.id === 'receiver') {
        transcript = transcript.toLowerCase()
          .replace(/\s+/g, '')
          .replace(/attherate|at|at the rate|at-the-rate/gi, '@');
      }

      selectedField.value += selectedField.id === 'receiver' ? transcript : ' ' + transcript;
    }
  };

  recognition.onerror = (e) => console.error('Speech recognition error:', e);

  recognition.onend = () => {
    if (micEnabled) recognition.start();
  };

  recognition.start();
}

// -------- Gesture Setup --------
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});
hands.onResults(onResults);

camera = new Camera(videoElement, {
  onFrame: async () => {
    if (micEnabled) await hands.send({ image: videoElement });
  },
  width: 480,
  height: 360
});
camera.start();

function countExtendedFingers(landmarks) {
  const tips = [8, 12, 16, 20];
  const mcp = [5, 9, 13, 17];
  let count = 0;
  for (let i = 0; i < tips.length; i++) {
    if (landmarks[tips[i]].y < landmarks[mcp[i]].y) count++;
  }

  const thumbIsOpen = isLeft
    ? landmarks[4].x > landmarks[3].x
    : landmarks[4].x < landmarks[3].x;

  if (thumbIsOpen) count++;
  return count;
}

function onResults(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    gestureEmoji.innerText = '❌';
    statusText.innerText = micEnabled ? 'No hand detected' : 'Session Stopped';
    timerText.innerText = '';
    lastGesture = null;
    pendingField = null;
    return;
  }

  isLeft = results.multiHandedness[0]?.label === "Left";
  const landmarks = results.multiHandLandmarks[0];
  const count = countExtendedFingers(landmarks);

  let gesture = null, emoji = '❔';
  switch (count) {
    case 0: gesture = 'stop'; emoji = '✊'; break;
    case 1: gesture = 'receiver'; emoji = '☝️'; break;
    case 2: gesture = 'subject'; emoji = '✌️'; break;
    case 3: gesture = 'body'; emoji = '🤟'; break;
    case 4: gesture = 'delete'; emoji = '👊'; break;
    case 5: gesture = 'send'; emoji = '🖐️'; break;
  }

  const now = new Date();
  if (gesture !== lastGesture) {
    gestureStartTime = now;
    lastGesture = gesture;
    pendingField = null;
    deleteCooldown = 0;
  }

  const elapsed = (now - gestureStartTime) / 1000;
  gestureEmoji.innerText = emoji;
  timerText.innerText = elapsed >= 2 ? '⏱' : `⏳ ${elapsed.toFixed(1)}s`;

  // -------- Field Selection (after 2s hold) --------
  if (['receiver', 'subject', 'body'].includes(gesture)) {
    if (elapsed >= 2 && (!pendingField || pendingField !== gesture)) {
      selectedField = document.getElementById(gesture);
      selectedField.focus();
      pendingField = gesture;
      statusText.innerText = gesture.charAt(0).toUpperCase() + gesture.slice(1);
      flashField(selectedField);  // 👈 Flash visual effect
    } else {
      statusText.innerText = `Hold to select ${gesture}`;
    }
    return;
  }

  // -------- Delete Gesture --------
  if (gesture === 'delete') {
    if (elapsed >= 2 && deleteCooldown === 0 && selectedField) {
      let words = selectedField.value.trim().split(" ");
      words.pop();
      selectedField.value = words.join(" ");
      statusText.innerText = 'Deleted one word';
      deleteCooldown = 1;
      setTimeout(() => deleteCooldown = 0, 2000);
    } else {
      statusText.innerText = 'Hold to delete word';
    }
    return;
  }

  // -------- Send Gesture --------
  if (gesture === 'send') {
    if (elapsed >= 2 && sendCooldown === 0) {
      document.getElementById('email-form').submit();
      statusText.innerText = 'Email Sent!';
      sendCooldown = 1;
      setTimeout(() => sendCooldown = 0, 5000);
    } else if (sendCooldown === 1) {
      statusText.innerText = 'Cooldown... Please wait';
    } else {
      statusText.innerText = 'Hold to confirm send';
    }
    return;
  }

  // -------- Stop Gesture --------
  if (gesture === 'stop') {
    statusText.innerText = 'Stopping Mic & Webcam';
    if (elapsed >= 2 && micEnabled) {
      micEnabled = false;
      if (recognition) {
        recognition.onend = null;
        recognition.abort();
      }
      camera.stop();
      statusText.innerText = 'Session Stopped';
      timerText.innerText = '';
    }
    return;
  }

  // -------- Default Watching --------
  statusText.innerText = 'Watching...';
}

// -------- On Page Load --------
window.onload = () => {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => initSpeechRecognition())
    .catch(err => console.error("Mic permission denied:", err));
};
