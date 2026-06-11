const form = document.querySelector('#resumeForm');
const fileInput = document.querySelector('#resumeFile');
const fileName = document.querySelector('#fileName');
const button = document.querySelector('#analyzeBtn');
const sourcePill = document.querySelector('#sourcePill');
const scoreValue = document.querySelector('#scoreValue');
const scoreRing = document.querySelector('#scoreRing');
const verdict = document.querySelector('#verdict');
const detailsList = document.querySelector('#detailsList');
const improvementList = document.querySelector('#improvementList');
const gapList = document.querySelector('#gapList');
const keywordList = document.querySelector('#keywordList');

fileInput.addEventListener('change', () => {
  fileName.textContent = fileInput.files[0]?.name || 'PDF, DOCX, or TXT up to 8 MB';
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  setLoading(true);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: new FormData(form)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not analyze this resume.');
    renderReport(data);
  } catch (error) {
    verdict.textContent = error.message;
    sourcePill.textContent = 'Needs input';
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Analyzing...' : 'Analyze resume';
  sourcePill.textContent = isLoading ? 'Processing' : sourcePill.textContent;
}

function renderReport(report) {
  const degrees = Math.round((report.score / 100) * 360);
  scoreValue.textContent = report.score;
  scoreRing.style.background = `conic-gradient(var(--green) ${degrees}deg, #e4ebe7 ${degrees}deg)`;
  verdict.textContent = report.verdict;
  sourcePill.textContent = report.source === 'LLM API' ? 'LLM API' : 'Local backup';

  const details = [
    ['Name', report.extracted.name],
    ['Email', report.extracted.email],
    ['Phone', report.extracted.phone],
    ['Location', report.extracted.location],
    ['Target role', report.extracted.targetRole],
    ['Experience', report.extracted.experienceLevel],
    ['Top skills', join(report.extracted.topSkills)],
    ['Education', join(report.extracted.education)],
    ['Certifications', join(report.extracted.certifications)],
    ['Achievements', join(report.extracted.achievements)]
  ];

  detailsList.innerHTML = details.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || 'Not found')}</dd>`).join('');
  improvementList.innerHTML = renderList(report.improvements);
  gapList.innerHTML = report.gapsChecklist.length ? report.gapsChecklist.map(renderGap).join('') : '<p class="empty">No checklist items returned.</p>';
  keywordList.innerHTML = report.keywordSuggestions.length ? report.keywordSuggestions.map(item => `<span class="chip">${escapeHtml(item)}</span>`).join('') : '<p class="empty">No extra keywords suggested.</p>';
}

function renderList(items) {
  return items.length ? items.map(item => `<li>${escapeHtml(item)}</li>`).join('') : '<li class="empty">No improvements returned.</li>';
}

function renderGap(item) {
  return `
    <div class="gap-item">
      <div class="gap-head">
        <span>${escapeHtml(item.item)}</span>
        <span class="tag ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
      </div>
      <p>${escapeHtml(item.advice)}</p>
    </div>
  `;
}

function join(items) {
  return Array.isArray(items) && items.length ? items.join(', ') : '';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}
