// ═══════════════════════════════════
// BOOT — инициализация
// ═══════════════════════════════════

// ══════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════
if(S.onboardingDone){
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('appHdr').style.display='';
  document.getElementById('appNav').style.display='';
  document.getElementById('appMain').style.display='';
  initApp();
} else {
  // prefill name if saved
  if(S.name) document.getElementById('nameInput').value=S.name;
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('SW registered'))
    .catch(err => console.log('SW registration failed'));
}
