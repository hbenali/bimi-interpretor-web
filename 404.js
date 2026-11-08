(function() {
  // BIMI facts
  var facts = [
    'BIMI works with Gmail, Apple Mail, and Yahoo!',
    'Requires DMARC p=quarantine or p=reject',
    'SVG must be Tiny 1.2 profile',
    'VMC certificates add a verified checkmark',
    'Logos must be square (1:1 aspect ratio)'
  ];

  var factTrigger = document.getElementById('factTrigger');
  var factText = document.getElementById('factText');

  function showRandomFact() {
    var randomFact = facts[Math.floor(Math.random() * facts.length)];
    factText.textContent = randomFact;
  }

  if (factTrigger) {
    factTrigger.addEventListener('click', showRandomFact);
  }

  var svgHint = document.getElementById('svgHint');
  if (svgHint) {
    svgHint.addEventListener('click', function() {
      window.location.href = '/#upload';
    });
  }
})();
