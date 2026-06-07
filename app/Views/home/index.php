<?php ob_start(); ?>
<div class="hero">
  <h1 class="hero__title">Edit PDFs — Free</h1>
  <p class="hero__sub">All tools run in your browser. Pay ₱50 to download your file.</p>

  <div class="tool-tabs">
    <?php $first = true; foreach ($tabs as $key => $tab): ?>
    <button class="tab-btn <?= $first ? 'active' : '' ?>"
            data-tab="<?= htmlspecialchars($key) ?>"
            onclick="switchTab('<?= htmlspecialchars($key) ?>')">
      <?= htmlspecialchars($tab['label']) ?>
    </button>
    <?php $first = false; endforeach; ?>
  </div>

  <?php $first = true; foreach ($tabs as $key => $tab): ?>
  <div class="tool-grid tab-panel <?= $first ? '' : 'hidden' ?>" id="tab-<?= htmlspecialchars($key) ?>">
    <?php foreach ($tab['tools'] as $t): ?>
    <a href="/editor/<?= htmlspecialchars($t['slug']) ?>" class="tool-card glass">
      <div class="tool-card__icon"><?= $t['icon'] ?></div>
      <div class="tool-card__label"><?= htmlspecialchars($t['label']) ?></div>
    </a>
    <?php endforeach; ?>
  </div>
  <?php $first = false; endforeach; ?>
</div>

<script>
function switchTab(key) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === key));
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('hidden', p.id !== 'tab-' + key));
  localStorage.setItem('pdf-editor-tab', key);
}
const _saved = localStorage.getItem('pdf-editor-tab');
if (_saved && document.getElementById('tab-' + _saved)) switchTab(_saved);
</script>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
