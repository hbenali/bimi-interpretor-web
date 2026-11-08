(function() {
  // DOM elements
  const domainInput = document.getElementById('domainInput');
  const selectorInput = document.getElementById('selectorInput');
  const checkBtn = document.getElementById('checkBtn');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');
  const resultContainer = document.getElementById('resultContainer');
  const placeholderState = document.getElementById('placeholderState');
  const recordsContainer = document.getElementById('recordsContainer');
  const errorContainer = document.getElementById('errorContainer');

  // SVG Upload elements
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const svgResults = document.getElementById('svgResults');

  // Tab elements (ARIA tabs pattern: roving tabindex + arrow-key navigation)
  const tabButtons = ['tabOverview', 'tabSpecs', 'tabVMC', 'tabExamples'].map(id => document.getElementById(id));
  const tabPanels = ['overviewTab', 'specsTab', 'vmcTab', 'examplesTab'].map(id => document.getElementById(id));

  function switchTab(index) {
    tabButtons.forEach((btn, i) => {
      const active = i === index;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
      tabPanels[i].classList.toggle('active', active);
    });
  }

  tabButtons.forEach((btn, i) => {
    if (!btn) return;
    btn.addEventListener('click', () => switchTab(i));
    btn.addEventListener('keydown', (e) => {
      let target = null;
      if (e.key === 'ArrowRight') target = (i + 1) % tabButtons.length;
      else if (e.key === 'ArrowLeft') target = (i - 1 + tabButtons.length) % tabButtons.length;
      else if (e.key === 'Home') target = 0;
      else if (e.key === 'End') target = tabButtons.length - 1;
      else return;
      e.preventDefault();
      tabButtons[target].focus();
      switchTab(target);
    });
  });

  // Helper functions
  function setActiveView(view) {
    if (placeholderState) placeholderState.style.display = 'none';
    if (recordsContainer) recordsContainer.style.display = 'none';
    if (errorContainer) errorContainer.style.display = 'none';

    if (view === 'placeholder' && placeholderState) {
      placeholderState.style.display = 'block';
    } else if (view === 'records' && recordsContainer) {
      recordsContainer.style.display = 'block';
    } else if (view === 'error' && errorContainer) {
      errorContainer.style.display = 'block';
    }
  }

  setActiveView('placeholder');

  // Status marker: the word carries the meaning, colour only reinforces it.
  const STATUS_LABEL = { valid: 'Pass', invalid: 'Fail', warning: 'Warning' };
  function badge(kind, text) {
    return `<span class="validation-badge ${kind}"><span class="st">${STATUS_LABEL[kind]}</span> ${escapeHtml(text)}</span>`;
  }

  // Check DMARC status (prerequisite for BIMI)
  async function checkDMARC(domain) {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const url = `https://dns.google/resolve?name=${encodeURIComponent(dmarcDomain)}&type=TXT`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.Answer) {
        for (const answer of data.Answer) {
          if (answer.type === 16 && answer.data) {
            const record = answer.data.replace(/^"|"$/g, '');
            if (record.includes('v=DMARC1')) {
              if (record.includes('p=quarantine')) return { valid: true, policy: 'quarantine' };
              if (record.includes('p=reject')) return { valid: true, policy: 'reject' };
              return { valid: false, policy: 'none' };
            }
          }
        }
      }
      return { valid: false, policy: null };
    } catch (e) {
      return { valid: false, policy: null };
    }
  }

  // Fetch and display logo from URL. Loaded directly as an <img> — no CORS/proxy
  // needed to *display* an image, only to read its pixels, which we don't do.
  function fetchLogo(url, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="logo-loading" role="status" aria-label="Loading logo"></div>';

    if (!/^https:\/\//i.test(url)) {
      container.innerHTML = `
        <div class="logo-placeholder">Not loaded</div>
        <div class="logo-error">Logo URL is not HTTPS</div>
      `;
      return;
    }

    const img = new Image();
    img.alt = 'BIMI logo preview';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      container.innerHTML = '';
      container.appendChild(img);
    };
    img.onerror = () => {
      container.innerHTML = `
        <div class="logo-placeholder">Not loaded</div>
        <div class="logo-error">Failed to load logo — <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">open directly</a></div>
      `;
    };
    img.src = url;
  }

  // Parse BIMI record
  function parseBIMI(record) {
    const tags = {};
    const cleanRecord = record.replace(/^"|"$/g, '');
    const parts = cleanRecord.split(';');

    parts.forEach(part => {
      part = part.trim();
      if (!part) return;

      const match = part.match(/^([a-zA-Z]+)=(.+)$/);
      if (match) {
        tags[match[1]] = match[2].trim();
      }
    });

    return tags;
  }

  // Validate BIMI record
  function validateBIMI(tags) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!tags.v) {
      validation.valid = false;
      validation.errors.push('Missing v= tag');
    } else if (tags.v !== 'BIMI1') {
      validation.valid = false;
      validation.errors.push('v= must be BIMI1');
    }

    if (!tags.l) {
      validation.valid = false;
      validation.errors.push('Missing l= (logo URL)');
    } else {
      if (!tags.l.startsWith('https://')) {
        validation.warnings.push('Logo URL should use HTTPS');
      }
    }

    if (tags.a && !tags.a.startsWith('https://')) {
      validation.warnings.push('VMC URL should use HTTPS');
    }

    return validation;
  }

  // Render BIMI result
  async function renderBIMIResult(domain, selector, record) {
    const tags = parseBIMI(record);
    const validation = validateBIMI(tags);
    const dmarcStatus = await checkDMARC(domain);

    let tagsHtml = '';
    for (const [key, value] of Object.entries(tags)) {
      tagsHtml += `
        <span class="tag">
          <span class="tag-key">${escapeHtml(key)}</span>=<span class="tag-value">${escapeHtml(value)}</span>
        </span>
      `;
    }

    let validationHtml = '';
    if (validation.valid) {
      validationHtml += badge('valid', 'Valid BIMI record');
    } else {
      validationHtml += badge('invalid', 'Invalid BIMI record');
    }

    validation.errors.forEach(err => {
      validationHtml += badge('invalid', err);
    });

    validation.warnings.forEach(warning => {
      validationHtml += badge('warning', warning);
    });

    // DMARC Status
    let dmarcHtml = '';
    if (dmarcStatus.valid) {
      dmarcHtml = `
        <div class="dmarc-status">
          ${badge('valid', 'DMARC ' + dmarcStatus.policy)}
          <span class="dmarc-note valid">BIMI ready!</span>
        </div>
      `;
    } else {
      dmarcHtml = `
        <div class="dmarc-status">
          ${badge('invalid', 'DMARC not ready')}
          <span class="dmarc-note invalid">Requires p=quarantine or p=reject</span>
        </div>
      `;
    }

    const bimiDomain = `${selector}._bimi.${domain}`;

    if (recordsContainer) {
      recordsContainer.innerHTML = `
        <div class="result-header">
          <h3>BIMI record for</h3>
          <span class="badge-domain">${escapeHtml(bimiDomain)}</span>
          <button class="share-btn" id="shareLinkBtn" type="button">Share Link</button>
        </div>

        <div class="record-meta">
          <span class="meta-item">Domain: ${escapeHtml(domain)}</span>
          <span class="meta-item">Selector: ${escapeHtml(selector)}</span>
        </div>

        ${dmarcHtml}

        <div class="logo-preview-section">
          <div class="logo-display">
            <div class="logo-box" id="logoPreviewContainer">
              <div class="logo-placeholder">No logo</div>
            </div>
            <div class="logo-caption">Logo Preview</div>
          </div>
          <div class="logo-info">
            <span class="logo-meta">Logo: ${escapeHtml(tags.l) || 'No logo URL'}</span>
            ${tags.a ? `<span class="logo-meta">VMC: ${escapeHtml(tags.a)}</span>` : ''}
            <p class="logo-hint">Upload your SVG below to test compatibility</p>
          </div>
        </div>

        <div class="tag-list">
          ${tagsHtml}
        </div>

        <div class="validation-list">
          ${validationHtml}
        </div>

        <div class="record-card">${escapeHtml(record)}</div>

        <div class="dns-line">
          <strong>DNS lookup:</strong> ${escapeHtml(bimiDomain)} IN TXT
        </div>
      `;

      // Fetch and display the logo if URL exists
      if (tags.l) {
        fetchLogo(tags.l, 'logoPreviewContainer');
      }

      const shareBtn = document.getElementById('shareLinkBtn');
      if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
          const params = new URLSearchParams({ domain });
          if (selector && selector !== 'default') params.set('selector', selector);
          const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

          const header = shareBtn.closest('.result-header');
          try {
            await navigator.clipboard.writeText(shareUrl);
            flashInlineFeedback(header, 'Shareable link copied to clipboard!');
          } catch (e) {
            flashInlineFeedback(header, "Couldn't copy automatically — copy it manually: " + shareUrl);
          }
        });
      }
    }
  }

  // shows a small transient inline confirmation instead of a blocking alert()
  function flashInlineFeedback(container, message) {
    if (!container) return;
    let note = container.querySelector('.inline-feedback');
    if (!note) {
      note = document.createElement('span');
      note.className = 'inline-feedback';
      note.setAttribute('role', 'status');
      container.appendChild(note);
    }
    note.textContent = message;
    clearTimeout(note._hideTimer);
    note._hideTimer = setTimeout(() => { note.textContent = ''; }, 2500);
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[&<>"]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return m;
    });
  }

  function errorBox(title, message) {
    return `
      <div class="error-message" role="alert">
        <div><strong>${escapeHtml(title)}</strong><br>${escapeHtml(message)}</div>
      </div>
    `;
  }

  function setLoading(isLoading) {
    if (checkBtn) checkBtn.disabled = isLoading;
    if (btnText) btnText.textContent = isLoading ? 'Checking' : 'Check BIMI';
    if (btnLoader) {
      btnLoader.style.display = isLoading ? 'inline-block' : 'none';
      btnLoader.className = isLoading ? 'loader' : '';
    }
  }

  // BIMI lookup function
  async function queryBIMI(domain, selector) {
    let cleanDomain = domain.trim().replace(/\.+$/, '');
    let cleanSelector = selector.trim().replace(/\.+$/, '') || 'default';

    if (!cleanDomain) throw new Error('Please enter a domain');

    const bimiDomain = `${cleanSelector}._bimi.${cleanDomain}`;

    const url = `https://dns.google/resolve?name=${encodeURIComponent(bimiDomain)}&type=TXT`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`DNS query failed (HTTP ${response.status})`);

    const data = await response.json();

    if (data.Status === 3) {
      throw new Error(`No BIMI record found for "${bimiDomain}"`);
    } else if (data.Status !== 0) {
      const reason = data.Comment || `DNS error code ${data.Status}`;
      throw new Error(`DNS lookup error: ${reason}`);
    }

    const answers = data.Answer || [];

    // Find BIMI records (TXT records starting with v=BIMI1)
    const bimiRecords = answers.filter(r => {
      if (r.type === 16 && r.data) {
        const txt = r.data.replace(/^"|"$/g, '');
        return txt.startsWith('v=BIMI1');
      }
      return false;
    });

    if (bimiRecords.length === 0) {
      throw new Error(`No BIMI record found for "${bimiDomain}"`);
    }

    if (bimiRecords.length > 1) {
      throw new Error(`Multiple BIMI records found`);
    }

    let record = bimiRecords[0].data.replace(/^"|"$/g, '');

    return {
      domain: cleanDomain,
      selector: cleanSelector,
      record: record,
      raw: bimiRecords[0]
    };
  }

  // Main lookup function
  async function performLookup() {
    if (!domainInput) return;

    const domain = domainInput.value.trim();
    const selector = selectorInput ? selectorInput.value.trim() : 'default';

    if (!domain) {
      setActiveView('error');
      if (errorContainer) {
        errorContainer.innerHTML = errorBox('Missing information', 'Please enter a domain');
      }
      return;
    }

    setLoading(true);
    try {
      const result = await queryBIMI(domain, selector);
      await renderBIMIResult(result.domain, result.selector, result.record);
      setActiveView('records');
    } catch (err) {
      console.error('BIMI lookup error:', err);
      if (errorContainer) {
        errorContainer.innerHTML = errorBox('Error checking BIMI', err.message);
      }
      setActiveView('error');
    } finally {
      setLoading(false);
    }
  }

  // SVG Upload handling
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleSVGFile(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleSVGFile(e.target.files[0]);
      }
    });
  }

  // SVG file handler
  function handleSVGFile(file) {
    if (!file.type.includes('svg') && !file.name.toLowerCase().endsWith('.svg')) {
      svgResults.style.display = 'block';
      svgResults.innerHTML = errorBox('Wrong file type', 'Please upload an SVG file');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const svgContent = e.target.result;

      // Basic SVG validation
      const isValidSVG = svgContent.includes('<svg') && svgContent.includes('</svg>');
      const isTinySVG = svgContent.includes('baseProfile="tiny"') || !svgContent.includes('script');

      svgResults.style.display = 'block';
      svgResults.innerHTML = `
        <h3 class="svg-title">SVG Analysis</h3>
        <div class="svg-analysis">
          <div class="logo-display">
            <div class="logo-box">
              ${svgContent.includes('<svg') ?
                '<div class="logo-placeholder ok">SVG found</div>' :
                '<div class="logo-placeholder bad">No SVG</div>'}
            </div>
          </div>
          <div class="svg-checks">
            <div class="validation-list">
              ${isValidSVG ? badge('valid', 'Valid SVG') : badge('invalid', 'Invalid SVG')}
              ${isTinySVG ? badge('valid', 'Tiny profile') : badge('warning', 'Check Tiny 1.2')}
            </div>
            <p class="svg-size">
              File size: ${(file.size / 1024).toFixed(2)}KB ${file.size > 32768 ?
                '<span class="invalid">(Exceeds 32KB limit)</span>' :
                '<span class="valid">(Within limit)</span>'}
            </p>
          </div>
        </div>
      `;
    };
    reader.readAsText(file);
  }

  // Event listeners
  if (checkBtn) checkBtn.addEventListener('click', performLookup);
  if (domainInput) {
    domainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performLookup();
    });
  }

  // Handle URL parameters
  function handleUrlParameter() {
    if (!domainInput) return;

    const urlParams = new URLSearchParams(window.location.search);
    const domainParam = urlParams.get('domain');
    const selectorParam = urlParams.get('selector');

    if (domainParam) domainInput.value = domainParam;
    if (selectorParam && selectorInput) selectorInput.value = selectorParam;

    if (domainParam) {
      setTimeout(() => performLookup(), 100);
    }
  }

  window.addEventListener('load', handleUrlParameter);
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
