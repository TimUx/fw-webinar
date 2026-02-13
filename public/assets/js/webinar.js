const API_BASE = '/api';
const MINIMUM_SLIDE_DURATION = 10000; // 10 seconds in milliseconds

let currentWebinar = null;
let currentSlideIndex = 0;
let currentQuestionIndex = 0;
let userAnswers = [];
let ttsService = null; // Piper TTS Service instance
let speechRate = 1.0;
let speechErrorCount = 0;
let narrationComplete = false;
let slideMinimumTimePassed = false;
let isMuted = false;
let revealInstance = null; // Store Reveal.js instance

// Load settings and webinars on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize TTS Service
  ttsService = new PiperTTSService(API_BASE);
  await loadPublicSettings();
  await loadWebinarList();
  await checkTTSService();
});

// Load public settings (header, logo)
async function loadPublicSettings() {
  try {
    const response = await fetch(`${API_BASE}/webinar/settings`);
    const settings = await response.json();
    
    document.getElementById('headerTitle').textContent = settings.headerTitle || 'Webinar Platform';
    
    if (settings.logoPath) {
      const logo = document.getElementById('headerLogo');
      logo.src = settings.logoPath;
      logo.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Load list of available webinars
async function loadWebinarList() {
  try {
    const response = await fetch(`${API_BASE}/webinar/list`);
    const webinars = await response.json();
    
    const loading = document.getElementById('loadingWebinars');
    const list = document.getElementById('webinarList');
    
    loading.classList.add('hidden');
    
    if (webinars.length === 0) {
      list.innerHTML = '<p>Derzeit sind keine Webinare verfügbar.</p>';
      return;
    }
    
    list.innerHTML = webinars.map(webinar => `
      <div class="webinar-card" onclick="loadWebinar('${webinar.id}')">
        <h3>${webinar.title}</h3>
        <p>Erstellt: ${new Date(webinar.createdAt).toLocaleDateString('de-DE')}</p>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading webinars:', error);
    document.getElementById('loadingWebinars').innerHTML = 
      '<p style="color: #e74c3c;">Fehler beim Laden der Webinare.</p>';
  }
}

// Load and start a specific webinar
async function loadWebinar(id) {
  try {
    const response = await fetch(`${API_BASE}/webinar/${id}`);
    currentWebinar = await response.json();
    
    document.getElementById('webinarTitle').textContent = currentWebinar.title;
    
    // Hide welcome, show presentation
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('presentation-section').classList.remove('hidden');
    
    // Load presentation
    if (currentWebinar.slides && currentWebinar.slides.length > 0) {
      loadPresentation();
    } else {
      // No slides, go directly to confirmation
      document.getElementById('presentation-section').classList.add('hidden');
      document.getElementById('confirmation-section').classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading webinar:', error);
    alert('Fehler beim Laden des Webinars.');
  }
}

// Load presentation slides
async function loadPresentation() {
  try {
    // Fetch slides HTML from API
    const response = await fetch(`${API_BASE}/webinar/${currentWebinar.id}/slides-html`);
    const data = await response.json();
    
    // Insert slides HTML into reveal container
    const slidesContainer = document.getElementById('revealSlides');
    slidesContainer.innerHTML = data.slidesHtml;
    
    // Initialize Reveal.js
    if (!revealInstance) {
      revealInstance = new Reveal({
        hash: false,
        slideNumber: false,
        showSlideNumber: 'none',
        center: true,
        transition: 'slide',
        plugins: [ RevealNotes, RevealHighlight ],
        controls: false,  // Disable built-in controls, we use custom ones
        keyboard: false,  // Disable keyboard navigation, we control it
        touch: false,     // Disable touch navigation
        progress: false   // Disable progress bar, we have custom one
      });
      
      await revealInstance.initialize();
      
      // Listen to slide change events from Reveal.js
      revealInstance.on('slidechanged', (event) => {
        // Update our tracking when Reveal.js changes slides
        // Note: We only use horizontal slides (indexh), no vertical slides
        currentSlideIndex = event.indexh;
        updateSlideCounter();
      });
    } else {
      // If already initialized, sync and rebuild
      await revealInstance.sync();
    }
    
    // Force layout and go to first slide
    currentSlideIndex = 0;
    revealInstance.slide(0, 0);
    revealInstance.layout();
    updateSlideCounter();
    
    // Start narration for first slide if not muted
    setTimeout(() => {
      if (!isMuted) {
        speakSlideNote(0);
      }
    }, 1000);
    
    // Show quiz button when all slides are viewed
    document.getElementById('startQuizBtn').style.display = 'none';
  } catch (error) {
    console.error('Error loading presentation:', error);
    alert('Fehler beim Laden der Präsentation.');
  }
}

// Navigation functions
function nextSlide() {
  // Check if minimum time has passed (10 seconds)
  if (!slideMinimumTimePassed) {
    return; // Don't advance if minimum time not met
  }
  
  const totalSlides = currentWebinar.slides.length;
  
  if (currentSlideIndex < totalSlides - 1) {
    currentSlideIndex++;
    
    // Use Reveal.js API to navigate
    if (revealInstance) {
      revealInstance.next();
    }
    
    updateSlideCounter();
    if (!isMuted) {
      speakSlideNote(currentSlideIndex);
    } else {
      handleMutedSlideTransition();
    }
  } else {
    // Last slide reached, show confirmation section
    stopSpeaking();
    document.getElementById('presentation-section').classList.add('hidden');
    document.getElementById('confirmation-section').classList.remove('hidden');
  }
}

function previousSlide() {
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    
    // Use Reveal.js API to navigate
    if (revealInstance) {
      revealInstance.prev();
    }
    
    updateSlideCounter();
    if (!isMuted) {
      speakSlideNote(currentSlideIndex);
    } else {
      handleMutedSlideTransition();
    }
  }
}

function updateSlideCounter() {
  const totalSlides = currentWebinar.slides?.length || 1;
  document.getElementById('currentSlide').textContent = currentSlideIndex + 1;
  document.getElementById('totalSlides').textContent = totalSlides;
  
  const progress = ((currentSlideIndex + 1) / totalSlides) * 100;
  document.getElementById('progressFill').style.width = `${progress}%`;
  
  // Previous button: always enabled except on first slide
  document.getElementById('prevSlideBtn').disabled = currentSlideIndex === 0;
  
  // Next button logic
  const isLastSlide = currentSlideIndex >= totalSlides - 1;
  const canAdvance = slideMinimumTimePassed;
  
  // On last slide: show different text and enable when conditions are met
  const nextBtn = document.getElementById('nextSlideBtn');
  if (isLastSlide) {
    nextBtn.textContent = 'Zur Lernkontrolle →';
    nextBtn.disabled = !canAdvance;
  } else {
    nextBtn.textContent = 'Weiter ▶';
    nextBtn.disabled = !canAdvance;
  }
  
  // Update status message
  updateNextButtonStatus(canAdvance);
}

// Update status message for the next button
function updateNextButtonStatus(canAdvance) {
  const statusElement = document.getElementById('nextSlideStatus');
  if (!statusElement) return;
  
  if (canAdvance) {
    statusElement.textContent = '';
    return;
  }
  
  // Show why button is disabled
  if (!slideMinimumTimePassed) {
    statusElement.textContent = '⏳ Bitte warten Sie noch einen Moment...';
  }
}

// Check TTS service health and show warning if unavailable
async function checkTTSService() {
  if (!ttsService) {
    console.error('TTS service not initialized');
    return;
  }
  
  try {
    const isHealthy = await ttsService.checkHealth();
    if (isHealthy) {
      console.log('TTS service is available');
      hideTTSControls(false); // Show TTS controls
    } else {
      console.warn('TTS service is not available');
      showTTSWarning();
      hideTTSControls(true); // Hide voice/speed controls as they're not applicable
    }
  } catch (error) {
    console.error('TTS service check failed:', error);
    showTTSWarning();
    hideTTSControls(true);
  }
}

// Hide or show TTS controls (deprecated - controls removed)
function hideTTSControls(hide) {
  // Voice controls have been removed from UI
  // Function kept for compatibility
}

// Show TTS service warning
function showTTSWarning() {
  // Check if already shown in this session
  if (sessionStorage.getItem('ttsWarningShown') === 'true') {
    return;
  }
  
  // Create notice element
  const notice = document.createElement('div');
  notice.id = 'ttsWarningNotice';
  notice.className = 'browser-recommendation-notice';
  notice.style.backgroundColor = '#f39c12';
  notice.innerHTML = `
    <div class="notice-content">
      <span class="notice-icon">⚠️</span>
      <div class="notice-text">
        <strong>Sprachausgabe nicht verfügbar:</strong>
        <p>Der Text-to-Speech-Dienst ist momentan nicht erreichbar. Die automatische Sprachausgabe wird nicht funktionieren.</p>
      </div>
      <button class="notice-close" onclick="closeTTSWarning()">×</button>
    </div>
  `;
  
  const presentationSection = document.getElementById('presentation-section');
  if (presentationSection) {
    presentationSection.insertBefore(notice, presentationSection.firstChild);
  }
  
  sessionStorage.setItem('ttsWarningShown', 'true');
}

// Close TTS warning notice
function closeTTSWarning() {
  const notice = document.getElementById('ttsWarningNotice');
  if (notice) {
    notice.style.display = 'none';
  }
}

// Dummy function for compatibility (voice controls removed)
function changeVoice() {
  // Voice selection not applicable with Piper TTS (uses fixed German Thorsten model)
  // Voice controls have been removed from UI
  console.log('Voice selection not available');
}

// Change speech rate (deprecated - control removed from UI)
function changeSpeechRate() {
  // Speed control has been removed from UI
  // Function kept for compatibility
  console.log('Speech rate control not available in UI');
}

// Helper to check if narration should be restarted when unmuting
function shouldRestartNarration() {
  return currentWebinar && 
         currentWebinar.slides && 
         currentSlideIndex >= 0 && 
         (currentSlideIndex > 0 || slideMinimumTimePassed);
}

// Toggle mute
function toggleMute() {
  isMuted = !isMuted;
  const muteBtn = document.getElementById('muteBtn');
  
  if (isMuted) {
    stopSpeaking();
    muteBtn.textContent = '🔇 Stumm';
    muteBtn.classList.add('muted');
  } else {
    muteBtn.textContent = '🔊 Ton';
    muteBtn.classList.remove('muted');
    // Restart narration if appropriate
    if (shouldRestartNarration()) {
      speakSlideNote(currentSlideIndex);
    }
  }
}

// Improved text chunking for better pronunciation
function chunkText(text) {
  // Split by sentences and respect natural pauses
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  
  for (const sentence of sentences) {
    // If sentence is very long, split by commas or semicolons
    if (sentence.length > 200) {
      const parts = sentence.split(/[,;]+/);
      chunks.push(...parts.map(p => p.trim()).filter(p => p.length > 0));
    } else {
      chunks.push(sentence.trim());
    }
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

// Helper function to handle slide transition when muted
function handleMutedSlideTransition() {
  narrationComplete = true;
  slideMinimumTimePassed = false;
  updateSlideCounter();
  
  // Still enforce minimum time even when muted
  setTimeout(() => {
    slideMinimumTimePassed = true;
    updateSlideCounter();
  }, MINIMUM_SLIDE_DURATION);
}

// Speech synthesis for narration using Piper TTS
async function speakSlideNote(slideIndex) {
  stopSpeaking();
  
  // Reset narration state for new slide
  narrationComplete = false;
  slideMinimumTimePassed = false;
  updateSlideCounter();
  
  // Start minimum time timer
  setTimeout(() => {
    slideMinimumTimePassed = true;
    updateSlideCounter();
  }, MINIMUM_SLIDE_DURATION);
  
  // If muted or no content, mark as complete
  const slide = currentWebinar.slides[slideIndex];
  if (isMuted || !slide || !slide.speakerNote) {
    narrationComplete = true;
    updateSlideCounter();
    return;
  }
  
  const text = slide.speakerNote;
  const chunks = chunkText(text);
  
  // Reset error count for new slide
  speechErrorCount = 0;
  
  // Show narration indicator
  const indicator = document.getElementById('narrationIndicator');
  indicator.classList.remove('hidden');
  indicator.classList.add('speaking');
  
  // Use Piper TTS to speak chunks (quality defaults to 'medium')
  try {
    await ttsService.speakChunks(
      chunks,
      'medium',  // Use medium quality by default
      () => {
        // On complete callback
        completeNarration();
      },
      (error) => {
        // On error callback
        console.error('TTS error:', error);
        speechErrorCount++;
        
        if (speechErrorCount >= 3) {
          console.error('Too many TTS errors, stopping narration');
          completeNarration();
        }
      }
    );
  } catch (error) {
    console.error('Error in speakSlideNote:', error);
    completeNarration();
  }
}

// Helper function to complete narration and update UI
function completeNarration() {
  const indicator = document.getElementById('narrationIndicator');
  indicator.classList.add('hidden');
  indicator.classList.remove('speaking');
  
  narrationComplete = true;
  updateSlideCounter();
}

function stopSpeaking() {
  if (ttsService) {
    ttsService.stop();
  }
  
  const indicator = document.getElementById('narrationIndicator');
  indicator.classList.add('hidden');
  indicator.classList.remove('speaking');
}

// Update confirmation button state
function updateConfirmationButton() {
  const checkbox = document.getElementById('confirmationCheckbox');
  const button = document.getElementById('proceedToQuizBtn');
  button.disabled = !checkbox.checked;
}

// Proceed to quiz after confirmation
function proceedToQuiz() {
  document.getElementById('confirmation-section').classList.add('hidden');
  startQuiz();
}

// Start quiz
function startQuiz() {
  stopSpeaking();
  
  document.getElementById('presentation-section').classList.add('hidden');
  document.getElementById('confirmation-section').classList.add('hidden');
  document.getElementById('quiz-section').classList.remove('hidden');
  
  currentQuestionIndex = 0;
  userAnswers = new Array(currentWebinar.questions.length).fill(null);
  
  displayQuestion();
}

// Display current question
function displayQuestion() {
  const question = currentWebinar.questions[currentQuestionIndex];
  const totalQuestions = currentWebinar.questions.length;
  
  const quizContent = document.getElementById('quizContent');
  quizContent.innerHTML = `
    <div class="question-box">
      <div class="question-number">Frage ${currentQuestionIndex + 1} von ${totalQuestions}</div>
      <div class="question-text">${question.question}</div>
      <div class="answers">
        ${question.answers.map((answer, index) => `
          <div class="answer-option ${userAnswers[currentQuestionIndex] === index ? 'selected' : ''}" 
               onclick="selectAnswer(${index})">
            ${answer}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Update navigation buttons
  document.getElementById('prevQuestionBtn').style.display = 
    currentQuestionIndex > 0 ? 'inline-block' : 'none';
  
  const isLastQuestion = currentQuestionIndex >= totalQuestions - 1;
  document.getElementById('nextQuestionBtn').style.display = 
    !isLastQuestion ? 'inline-block' : 'none';
  document.getElementById('finishQuizBtn').style.display = 
    isLastQuestion ? 'inline-block' : 'none';
}

function selectAnswer(answerIndex) {
  userAnswers[currentQuestionIndex] = answerIndex;
  displayQuestion();
}

function nextQuestion() {
  if (currentQuestionIndex < currentWebinar.questions.length - 1) {
    currentQuestionIndex++;
    displayQuestion();
  }
}

function previousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayQuestion();
  }
}

function finishQuiz() {
  // Check if all questions are answered
  const unanswered = userAnswers.findIndex(a => a === null);
  if (unanswered !== -1) {
    alert(`Bitte beantworten Sie alle Fragen. Frage ${unanswered + 1} ist noch offen.`);
    return;
  }
  
  // Show participant form
  document.getElementById('quiz-section').classList.add('hidden');
  document.getElementById('participant-section').classList.remove('hidden');
}

// Submit participant data and results
document.getElementById('participantForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('participantName').value;
  const email = document.getElementById('participantEmail').value;
  
  try {
    const response = await fetch(`${API_BASE}/webinar/${currentWebinar.id}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        email,
        answers: userAnswers,
        confirmed: true  // User has confirmed via checkbox
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Fehler beim Absenden');
    }
    
    const data = await response.json();
    
    // Show result
    displayResult(data.result);
  } catch (error) {
    alert('Fehler: ' + error.message);
  }
});

// Display result
function displayResult(result) {
  document.getElementById('participant-section').classList.add('hidden');
  document.getElementById('result-section').classList.remove('hidden');
  
  const passed = result.passed;
  
  document.getElementById('resultIcon').textContent = passed ? '✅' : '❌';
  document.getElementById('resultTitle').textContent = passed ? 'Herzlichen Glückwunsch!' : 'Nicht bestanden';
  
  const scoreElement = document.getElementById('resultScore');
  scoreElement.textContent = `${result.percentage}%`;
  scoreElement.className = 'result-score ' + (passed ? 'passed' : 'failed');
  
  document.getElementById('correctAnswers').textContent = result.score;
  document.getElementById('totalQuestions').textContent = result.totalQuestions;
  document.getElementById('percentage').textContent = result.percentage;
  
  const messageElement = document.getElementById('resultMessage');
  if (passed) {
    messageElement.className = 'result-message success';
    messageElement.innerHTML = `
      <strong>Glückwunsch!</strong> Sie haben die Lernkontrolle erfolgreich bestanden.<br>
      Sie erhalten in Kürze eine Bestätigungs-E-Mail mit Ihrem Ergebnis.
    `;
  } else {
    messageElement.className = 'result-message info';
    messageElement.innerHTML = `
      <strong>Leider nicht bestanden.</strong><br>
      Sie können das Webinar jederzeit wiederholen, um Ihr Wissen zu vertiefen.<br>
      Sie erhalten eine E-Mail mit Ihrem Ergebnis.
    `;
  }
}
