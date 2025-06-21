// DOM Elements
const imageUpload = document.getElementById('imageUpload');
const dropArea = document.getElementById('dropArea');
const previewImage = document.getElementById('previewImage');
const imagePreview = document.getElementById('imagePreview');
const startRecording = document.getElementById('startRecording');
const recordingStatus = document.getElementById('recordingStatus');
const voiceResult = document.getElementById('voiceResult');
const voiceText = document.getElementById('voiceText');
const textInput = document.getElementById('textInput');
const translateTextButton = document.getElementById('translateText');
const sourceLang = document.getElementById('sourceLang');
const targetLang = document.getElementById('targetLang');
const loadingIndicator = document.getElementById('loadingIndicator');
const translationResult = document.getElementById('translationResult');
const emptyState = document.getElementById('emptyState');
const originalText = document.getElementById('originalText');
const translatedText = document.getElementById('translatedText');
const contextText = document.getElementById('contextText');
const playAudio = document.getElementById('playAudio');
const copyText = document.getElementById('copyText');

// State
let recognition;
let isRecording = false;
let selectedImage = null;
let ttsVoices = [];

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    initDragAndDrop();
    initSpeechRecognition();
    loadVoices();
});

function initDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => dropArea.addEventListener(event, preventDefaults, false));
    ['dragenter', 'dragover'].forEach(event => dropArea.addEventListener(event, highlight, false));
    ['dragleave', 'drop'].forEach(event => dropArea.addEventListener(event, unhighlight, false));
    dropArea.addEventListener('drop', handleDrop, false);
    imageUpload.addEventListener('change', handleImageSelect);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}
function highlight() { dropArea.classList.add('border-indigo-500', 'bg-indigo-50'); }
function unhighlight() { dropArea.classList.remove('border-indigo-500', 'bg-indigo-50'); }
function handleDrop(e) { const files = e.dataTransfer.files; if (files.length) handleImageFile(files[0]); }
function handleImageSelect(e) { const files = e.target.files; if (files.length) handleImageFile(files[0]); }

function handleImageFile(file) {
    if (!file.type.match('image.*')) return alert('Please select an image file (JPEG, PNG)');
    const reader = new FileReader();
    reader.onload = e => {
        previewImage.src = e.target.result;
        imagePreview.classList.remove('hidden');
        selectedImage = e.target.result;
        extractTextFromImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

async function extractTextFromImage(imageData) {
    showLoading();
    const langCode = detectLanguageCode(sourceLang.value);
    const supported = ['eng', 'hin', 'kan', 'tam', 'tel', 'mal', 'ben', 'mar', 'guj', 'pan'];
    if (!supported.includes(langCode)) return alert(`OCR not supported for ${sourceLang.value}`);

    try {
        const { data: { text } } = await Tesseract.recognize(imageData, langCode);
        processExtractedText(text.trim());
    } catch (error) {
        console.error('OCR Error:', error);
        hideLoading();
        alert('Image processing failed.');
    }
}

function processExtractedText(text) {
    if (!text) return (hideLoading(), alert('No text found in image'));
    processInputText(text, 'image');
}

function initSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        startRecording.disabled = true;
        startRecording.title = 'Not supported';
        alert('Speech recognition not supported');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    updateRecognitionLanguage();

    recognition.onstart = () => {
        isRecording = true;
        startRecording.innerHTML = '<i class="fas fa-stop"></i> Stop';
        startRecording.classList.replace('bg-indigo-600', 'bg-red-600');
        recordingStatus.classList.remove('hidden');
    };

    recognition.onend = () => {
        isRecording = false;
        startRecording.innerHTML = '<i class="fas fa-microphone"></i> Speak Now';
        startRecording.classList.replace('bg-red-600', 'bg-indigo-600');
        recordingStatus.classList.add('hidden');
    };

    recognition.onresult = event => {
        const transcript = event.results[0][0].transcript;
        voiceText.textContent = transcript;
        voiceResult.classList.remove('hidden');
        processInputText(transcript, 'voice');
    };

    recognition.onerror = event => {
        console.error('Speech error', event.error);
        isRecording = false;
        hideLoading();
        alert(`Speech error: ${event.error}`);
    };
}

function updateRecognitionLanguage() {
    if (recognition) recognition.lang = detectLanguageCode(sourceLang.value);
}
sourceLang.addEventListener('change', updateRecognitionLanguage);
startRecording.addEventListener('click', () => {
    isRecording ? recognition.stop() : recognition.start();
});

translateTextButton.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) return alert('Enter some text');
    processInputText(text, 'text');
});

async function processInputText(text, source) {
    showLoading();
    try {
        const targetLangCode = targetLang.value;
        const translation = await fetchTranslation(text, targetLangCode);
        const context = await simulateContextExplanation(text, translation, source === 'image' ? sourceLang.value : detectLanguage(text), targetLangCode);
        showResults(text, translation, context);
    } catch (error) {
        console.error('Translation error:', error);
        showResults(text, 'Translation failed.', '');
    }
}

function detectLanguage(text) {
    return sourceLang.value === 'auto' ? 'en' : sourceLang.value;
}
function detectLanguageCode(lang) {
    const map = { 'auto': 'eng', 'en': 'eng', 'hi': 'hin', 'kn': 'kan', 'ta': 'tam', 'te': 'tel', 'ml': 'mal', 'bn': 'ben', 'mr': 'mar', 'gu': 'guj', 'pa': 'pan' };
    return map[lang] || 'eng';
}

async function fetchTranslation(text, targetLang) {
    try {
        const response = await fetch('https://cors-anywhere.herokuapp.com/https://libretranslate.de/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ q: text, source: 'auto', target: targetLang })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        return data.translatedText || 'No translation';
    } catch (err) {
        console.error('API Error:', err);
        return `Translation error: ${err.message}`;
    }
}

function showLoading() {
    loadingIndicator.classList.remove('hidden');
    translationResult.classList.add('hidden');
    emptyState.classList.add('hidden');
}
function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

function showResults(original, translation, context) {
    const cleanOriginal = original.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ').trim();
    const cleanTranslation = translation.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ').trim();
    originalText.textContent = cleanOriginal || 'No text recognized';
    translatedText.textContent = cleanTranslation || 'Translation not available';
    contextText.textContent = context || 'No context available';
    hideLoading();
    translationResult.classList.remove('hidden');
    emptyState.classList.add('hidden');
}

async function simulateContextExplanation(originalText, translatedText, sourceLang, targetLang) {
    return `This is a ${sourceLang} phrase that translates to "${translatedText}" in ${targetLang}.`;
}

copyText.addEventListener('click', () => {
    const text = translatedText.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        const original = copyText.innerHTML;
        copyText.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => copyText.innerHTML = original, 2000);
    }).catch(err => console.error('Copy failed:', err));
});

function loadVoices() {
    ttsVoices = speechSynthesis.getVoices();
    if (!ttsVoices.length) setTimeout(loadVoices, 100);
}
speechSynthesis.onvoiceschanged = loadVoices;

playAudio.addEventListener('click', () => {
    const text = translatedText.textContent;
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang.value === 'hi' ? 'hi-IN' : `${targetLang.value}-US`;
    utterance.rate = 0.9;
    const voice = ttsVoices.find(v => v.lang.includes(targetLang.value) && (v.name.includes('India') || v.name.includes('Indian')));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
});

// Add click-to-audio functionality
document.querySelectorAll('[data-word]').forEach(item => {
    item.addEventListener('click', () => {
        const word = item.getAttribute('data-word');
        speakWord(word, item.getAttribute('data-lang'));
    });
});

function speakWord(word, lang) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'bn' ? 'bn-IN' : 'en-IN';
    speechSynthesis.speak(utterance);
}

fetch("https://libretranslate.de/translate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    q: input,
    source: "auto",
    target: "en",
    format: "text"
  })
})
.then(res => res.json())
.then(data => {
  loadingIndicator.classList.add("hidden");
  translationResult.classList.remove("hidden");
  originalText.textContent = input;
  translatedText.textContent = data.translatedText;
  contextText.textContent = "This translation was processed via LibreTranslate API.";
})
.catch(err => {
  loadingIndicator.classList.add("hidden");
  alert("Translation failed: " + err.message);
});
