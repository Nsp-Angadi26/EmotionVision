let token = localStorage.getItem('ev_token');
let username = localStorage.getItem('ev_user');
let authMode = 'signin';
let stream = null;
let selectedFile = null;
let chart = null;

const $ = id => document.getElementById(id);


/* =========================
   PAGE NAVIGATION
   ========================= */

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });

  const page = $(id);

  if (!page) return;

  page.classList.add('active');

  document.querySelectorAll('.nav[data-page]').forEach(n => {
    n.classList.toggle('active', n.dataset.page === id);
  });

  if (id === 'history') {
    loadHistory();
  }

  if (id === 'stats') {
    loadStats();
  }
}


document.querySelectorAll('.nav[data-page]').forEach(b => {
  b.onclick = () => showPage(b.dataset.page);
});


/* =========================
   AUTHENTICATION UI
   ========================= */

function updateAuth() {

  $('authBtn').textContent =
    token ? 'Sign Out' : 'Sign In';

  $('userChip').textContent =
    token
      ? `Signed in as ${username}`
      : 'Not signed in';

  $('authBtn').onclick = () => {
    if (token) {
      logout();
    } else {
      openAuth();
    }
  };
}


/* =========================
   OPEN AUTH MODAL
   ========================= */

function openAuth() {

  const modal = $('authModal');

  modal.hidden = false;

  /*
   * IMPORTANT:
   * Some CSS can override the hidden attribute.
   * Therefore explicitly show the modal here.
   */
  modal.style.display = 'flex';

  $('authMessage').textContent = '';

  $('authMessage').className = 'status';

  authMode = 'signin';

  $('authTitle').textContent = 'Sign In';

  $('signInTab').classList.add('active');
  $('signUpTab').classList.remove('active');
}


/* =========================
   CLOSE AUTH MODAL
   ========================= */

function closeAuth() {

  const modal = $('authModal');

  /*
   * IMPORTANT:
   * Hide using BOTH hidden and display:none.
   * This guarantees the Sign In popup disappears
   * even if CSS has display:flex on the modal.
   */

  modal.hidden = true;
  modal.style.display = 'none';
}


/* =========================
   SIGN IN / SIGN UP TABS
   ========================= */

$('signInTab').onclick = () => {

  authMode = 'signin';

  $('authTitle').textContent = 'Sign In';

  $('signInTab').classList.add('active');
  $('signUpTab').classList.remove('active');

  $('authMessage').textContent = '';
  $('authMessage').className = 'status';
};


$('signUpTab').onclick = () => {

  authMode = 'signup';

  $('authTitle').textContent = 'Create account';

  $('signUpTab').classList.add('active');
  $('signInTab').classList.remove('active');

  $('authMessage').textContent = '';
  $('authMessage').className = 'status';
};


/* =========================
   AUTH MESSAGE
   ========================= */

function msg(text, type) {

  $('authMessage').textContent = text;

  $('authMessage').className =
    'status ' + type;
}


/* =========================
   SIGN IN / SIGN UP
   ========================= */

async function submitAuth() {

  const u = $('username').value.trim();
  const p = $('password').value;

  if (!u || !p) {

    msg(
      'Enter username and password.',
      'error'
    );

    return;
  }


  const button =
    document.querySelector('#authModal .primary');


  if (button) {

    button.disabled = true;

    button.textContent =
      authMode === 'signin'
        ? 'Signing In...'
        : 'Creating Account...';
  }


  try {

    const response = await fetch(
      '/api/' + authMode,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          username: u,
          password: p
        })
      }
    );


    let data;

    try {

      data = await response.json();

    } catch (error) {

      throw new Error(
        'Server returned an invalid response.'
      );
    }


    /* =========================
       AUTHENTICATION ERROR
       ========================= */

    if (!response.ok) {

      throw new Error(
        data.detail ||
        'Authentication failed.'
      );
    }


    /* =========================
       SIGN UP SUCCESS
       ========================= */

    if (authMode === 'signup') {

      token = null;
      username = null;

      localStorage.removeItem('ev_token');
      localStorage.removeItem('ev_user');


      /* Switch to Sign In */

      authMode = 'signin';

      $('authTitle').textContent =
        'Sign In';

      $('signInTab').classList.add('active');
      $('signUpTab').classList.remove('active');


      /* Clear password */

      $('password').value = '';


      /* Show account creation message */

      msg(
        'Account created successfully. Please sign in.',
        'ok'
      );


      /*
       * Keep the authentication window open.
       * User can now enter username/password
       * and sign in.
       */

      return;
    }


    /* =========================
       SIGN IN SUCCESS
       ========================= */

    token = data.token;
    username = data.username;


    /* Save login */

    localStorage.setItem(
      'ev_token',
      token
    );

    localStorage.setItem(
      'ev_user',
      username
    );


    /* Update normal website header */

    updateAuth();


    /*
     * IMPORTANT:
     * Close the Sign In popup completely.
     */
    closeAuth();


    /* Clear login fields */

    $('username').value = '';
    $('password').value = '';


    /*
     * IMPORTANT:
     * After successful login,
     * directly open Analyze page.
     */

    showPage('analyze');


    /* Analyze page message */

    $('status').textContent =
      'Welcome ' +
      username +
      '. Ready for image or webcam analysis.';


  } catch (error) {

    msg(
      error.message ||
      'Authentication failed.',
      'error'
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        'Continue';
    }
  }
}


/* =========================
   MAKE FUNCTION AVAILABLE
   TO HTML BUTTON
   ========================= */

window.submitAuth = submitAuth;


/* =========================
   LOGOUT
   ========================= */

function logout() {

  token = null;
  username = null;

  localStorage.removeItem('ev_token');
  localStorage.removeItem('ev_user');

  updateAuth();

  showPage('home');
}


/* =========================
   AUTH CHECK
   ========================= */

function needAuth() {

  if (!token) {

    openAuth();

    return false;
  }

  return true;
}


/* =========================
   ANALYSIS MODE
   ========================= */

function selectMode(mode) {

  if (!needAuth()) {
    return;
  }

  if (mode === 'upload') {

    $('fileInput').click();

  } else {

    startCamera();
  }
}


/* =========================
   IMAGE UPLOAD
   ========================= */

$('fileInput').onchange = e => {

  selectedFile = e.target.files[0];

  if (!selectedFile) {
    return;
  }


  const url =
    URL.createObjectURL(selectedFile);


  $('previewImg').src = url;

  $('previewImg').hidden = false;

  $('video').hidden = true;

  $('emptyState').hidden = true;

  $('analyzeBtn').hidden = false;

  $('captureBtn').hidden = true;

  $('stopBtn').hidden = true;

  $('status').textContent =
    'Image selected. Click Analyze Image.';
};


/* =========================
   ANALYZE UPLOADED IMAGE
   ========================= */

$('analyzeBtn').onclick = async () => {

  if (!selectedFile) {

    $('status').textContent =
      'Please select an image first.';

    return;
  }


  const fd = new FormData();

  fd.append(
    'file',
    selectedFile
  );


  await analyze(
    '/api/analyze',
    {
      method: 'POST',

      headers: {
        Authorization:
          'Bearer ' + token
      },

      body: fd
    }
  );
};


/* =========================
   WEBCAM
   ========================= */

async function startCamera() {

  try {

    stream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });


    $('video').srcObject =
      stream;


    $('video').hidden = false;

    $('previewImg').hidden = true;

    $('emptyState').hidden = true;

    $('captureBtn').hidden = false;

    $('stopBtn').hidden = false;

    $('analyzeBtn').hidden = true;


    $('status').textContent =
      'Camera live. Position your face and capture.';

  } catch (error) {

    $('status').textContent =
      'Camera permission was not available.';
  }
}


$('stopBtn').onclick =
  stopCamera;


function stopCamera() {

  if (stream) {

    stream.getTracks().forEach(
      track => track.stop()
    );
  }

  stream = null;

  $('video').hidden = true;

  $('captureBtn').hidden = true;

  $('stopBtn').hidden = true;

  $('emptyState').hidden = false;
}


/* =========================
   WEBCAM CAPTURE
   ========================= */

$('captureBtn').onclick =
  async () => {

    const video = $('video');

    const canvas = $('canvas');


    if (
      !video.videoWidth ||
      !video.videoHeight
    ) {

      $('status').textContent =
        'Camera is not ready yet.';

      return;
    }


    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;


    const context =
      canvas.getContext('2d');


    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );


    const imageData =
      canvas.toDataURL(
        'image/jpeg',
        0.92
      );


    $('previewImg').src =
      imageData;

    $('previewImg').hidden =
      false;


    await analyze(
      '/api/analyze',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            'Bearer ' + token
        },

        body: JSON.stringify({
          image: imageData
        })
      }
    );
  };


/* =========================
   ANALYZE
   ========================= */

async function analyze(url, options) {

  $('status').textContent =
    'Detecting face and running EfficientNet-B0...';


  try {

    const response =
      await fetch(
        url,
        options
      );


    let data;

    try {

      data =
        await response.json();

    } catch (error) {

      throw new Error(
        'Server returned an invalid analysis response.'
      );
    }


    if (!response.ok) {

      throw new Error(
        data.detail ||
        'Analysis failed.'
      );
    }


    renderResult(data);


    $('status').textContent =
      'Analysis complete. Result saved to history.';

  } catch (error) {

    $('status').textContent =
      error.message ||
      'Analysis failed.';
  }
}


/* =========================
   RESULT
   ========================= */

function renderResult(d) {

  const emoji = {

    happy: '😊',

    sad: '😔',

    angry: '😠',

    surprise: '😮',

    fear: '😨',

    disgust: '🤢',

    neutral: '😐'

  }[d.emotion] || '🙂';


  const probs =
    Object.entries(
      d.probabilities
    )
    .map(
      ([emotion, value]) => `

        <div class="prob">

          <b>${emotion}</b>

          <span class="bar">
            <i style="width:${value}%"></i>
          </span>

          <strong>
            ${value.toFixed(1)}%
          </strong>

        </div>

      `
    )
    .join('');


  const info =
    d.image_info;


  $('result').hidden =
    false;


  $('result').innerHTML = `

    <div class="result-top">

      <div>

        <p class="eyebrow">
          PREDICTED EMOTION
        </p>

        <div class="emotion">
          ${emoji} ${d.emotion}
        </div>

        <small>
          Model: ${d.model} · ${d.model_mode}
        </small>

      </div>


      <div class="confidence">
        ${d.confidence.toFixed(1)}%
      </div>

    </div>


    <div class="prob-grid">
      ${probs}
    </div>


    <div class="info">

      <p class="eyebrow">
        IMAGE INFORMATION
      </p>


      <div class="info-grid">

        <div>
          <b>${info.width}px</b>
          <small>Width</small>
        </div>


        <div>
          <b>${info.height}px</b>
          <small>Height</small>
        </div>


        <div>
          <b>${info.format}</b>
          <small>Format</small>
        </div>


        <div>
          <b>${info.faces_detected}</b>
          <small>Faces detected</small>
        </div>


        <div>
          <b>
            ${info.face_crop_used ? 'Yes' : 'No'}
          </b>

          <small>
            Face crop
          </small>
        </div>

      </div>

    </div>
  `;


  $('result').scrollIntoView({
    behavior: 'smooth',
    block: 'nearest'
  });
}


/* =========================
   HISTORY
   ========================= */

async function loadHistory() {

  if (!needAuth()) {
    return;
  }


  try {

    const response =
      await fetch(
        '/api/history',
        {
          headers: {
            Authorization:
              'Bearer ' + token
          }
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.detail ||
        'Unable to load history.'
      );
    }


    $('historyList').innerHTML =
      data.length

      ? data.map(
          item => `

            <div class="history-item">

              <div>

                <b>
                  ${item.emotion}
                </b>

                <br>

                <small>
                  ${item.created_at || ''}
                </small>

              </div>


              <strong>
                ${item.confidence}
              </strong>

            </div>

          `
        ).join('')

      : `
        <div class="status">
          No predictions yet.
        </div>
      `;

  } catch (error) {

    $('historyList').innerHTML =
      `
        <div class="status error">
          ${error.message}
        </div>
      `;
  }
}


/* =========================
   STATISTICS
   ========================= */

async function loadStats() {

  if (!needAuth()) {
    return;
  }


  try {

    const response =
      await fetch(
        '/api/statistics',
        {
          headers: {
            Authorization:
              'Bearer ' + token
          }
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.detail ||
        'Unable to load statistics.'
      );
    }


    $('total').textContent =
      data.total;


    $('statRows').innerHTML =
      data.labels
      .map(
        (emotion, index) => {

          const percentage =
            data.total
              ? (
                  data.values[index] /
                  data.total
                ) * 100
              : 0;


          return `

            <div class="stat-row">

              <b>
                ${emotion}
              </b>


              <span class="bar">

                <i
                  style="width:${percentage}%">
                </i>

              </span>


              <strong>
                ${data.values[index]}
              </strong>

            </div>

          `;
        }
      )
      .join('');


    const canvas =
      $('chart');


    if (chart) {
      chart.destroy();
    }


    chart =
      new Chart(
        canvas,
        {
          type: 'doughnut',

          data: {

            labels:
              data.labels,

            datasets: [
              {
                data:
                  data.values
              }
            ]
          },

          options: {

            responsive: true,

            plugins: {

              legend: {
                position: 'bottom'
              }

            }
          }
        }
      );

  } catch (error) {

    $('statRows').innerHTML =
      `
        <div class="status error">
          ${error.message}
        </div>
      `;
  }
}


/* =========================
   INITIALIZE
   ========================= */

updateAuth();

if (token) {

  showPage('analyze');

  if ($('status')) {

    $('status').textContent =
      'Signed in. Ready for image or webcam analysis.';
  }
}